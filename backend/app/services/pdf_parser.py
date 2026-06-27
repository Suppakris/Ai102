import fitz  # PyMuPDF


def extract_text_by_page(pdf_path: str) -> list[dict]:
    """
    Extract text from each page of a PDF.
    Returns a list of dicts with page number and text content.
    """
    doc = fitz.open(pdf_path)
    pages = []

    for i, page in enumerate(doc):
        text = page.get_text().strip()
        if text:  # skip blank pages
            pages.append({
                "page_number": i + 1,
                "text": text[:3000]  # cap per page to stay within Groq token limits
            })

    doc.close()
    return pages


def get_pdf_metadata(pdf_path: str) -> dict:
    """Extract PDF title and basic metadata."""
    doc = fitz.open(pdf_path)
    meta = doc.metadata
    doc.close()
    return {
        "title": meta.get("title", "Untitled Document"),
        "author": meta.get("author", ""),
        "page_count": doc.page_count if not doc.is_closed else len(fitz.open(pdf_path))
    }