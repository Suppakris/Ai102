import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from app.services.pdf_parser import extract_text_by_page, get_pdf_metadata
from app.services.groq_service import summarize_page_to_slide, generate_presentation_title
from app.services.slide_builder import build_pptx
from app.services.supabase_service import upload_pptx, is_configured as supabase_ready
from app.utils.file_handler import save_upload, get_output_path, cleanup_upload
from app.models.schemas import ConvertResponse

router = APIRouter()

MAX_PAGES = 20        # Groq free tier safety cap
MAX_FILE_SIZE_MB = 20


@router.post("/convert", response_model=ConvertResponse)
async def convert_pdf_to_slides(file: UploadFile = File(...)):
    """
    Upload a PDF and receive a .pptx presentation.
    Pipeline: Upload → Parse → Groq AI → Build PPTX → Upload to Supabase → Return URL
    """

    # ── Validate ───────────────────────────────────────────────
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_FILE_SIZE_MB}MB.")

    if len(content) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty or corrupted.")

    # ── Save PDF temp ──────────────────────────────────────────
    pdf_path = save_upload(content, file.filename)
    output_path = None

    try:
        # ── Extract text ───────────────────────────────────────
        pages = extract_text_by_page(pdf_path)
        if not pages:
            raise HTTPException(
                status_code=422,
                detail="No readable text found in PDF. It may be image-only."
            )
        pages = pages[:MAX_PAGES]

        # ── PDF metadata ───────────────────────────────────────
        metadata    = get_pdf_metadata(pdf_path)
        pdf_title   = metadata.get("title", "") or file.filename.replace(".pdf", "")

        # ── Groq: page → slide ─────────────────────────────────
        slides_data = []
        for page in pages:
            slide = summarize_page_to_slide(page["text"], page["page_number"])
            if slide:
                slides_data.append(slide)

        if not slides_data:
            raise HTTPException(
                status_code=422,
                detail="AI could not extract meaningful content from this PDF."
            )

        # ── Groq: presentation title ───────────────────────────
        presentation_title = generate_presentation_title(pdf_title, pages[0]["text"])

        # ── Build .pptx locally ────────────────────────────────
        job_id      = str(uuid.uuid4())
        output_path = get_output_path(job_id)
        build_pptx(slides_data, output_path, presentation_title)

        # ── Upload to Supabase Storage ─────────────────────────
        if supabase_ready():
            download_url = upload_pptx(output_path, job_id)
        else:
            # Fallback: serve from local disk (dev mode)
            base_url     = os.environ.get("BASE_URL", "http://localhost:8000")
            download_url = f"{base_url}/outputs/{job_id}.pptx"

        return ConvertResponse(
            job_id=job_id,
            slide_count=len(slides_data),
            presentation_title=presentation_title,
            download_url=download_url,
            slides_preview=slides_data,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    finally:
        cleanup_upload(pdf_path)
        # Clean up local .pptx after uploading to Supabase
        if output_path and supabase_ready():
            try:
                import os as _os
                if _os.path.exists(output_path):
                    _os.remove(output_path)
            except Exception:
                pass


@router.get("/download/{job_id}")
def download_pptx(job_id: str):
    """
    Fallback local download (used in dev when Supabase is not configured).
    In production, the client downloads directly from Supabase public URL.
    """
    path = get_output_path(job_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found or expired.")
    return FileResponse(
        path,
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".presentationml.presentation"
        ),
        filename="presentation.pptx",
    )


@router.get("/health")
def health():
    return {
        "status": "ok",
        "groq_key_set":     bool(os.environ.get("GROQ_API_KEY")),
        "supabase_ready":   supabase_ready(),
    }