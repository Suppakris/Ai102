import os
from supabase import create_client, Client

SUPABASE_URL    = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")   # service role key (not anon)
BUCKET_NAME     = os.environ.get("SUPABASE_BUCKET", "presentations")

_client: Client | None = None


def get_client() -> Client:
    """Return a cached Supabase client."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "Supabase is not configured. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def upload_pptx(file_path: str, job_id: str) -> str:
    """
    Upload a .pptx file to Supabase Storage.
    Returns the public URL of the uploaded file.
    """
    client = get_client()
    storage_path = f"{job_id}.pptx"

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # Upload to Supabase bucket
    client.storage.from_(BUCKET_NAME).upload(
        path=storage_path,
        file=file_bytes,
        file_options={
            "content-type": (
                "application/vnd.openxmlformats-officedocument"
                ".presentationml.presentation"
            ),
            "upsert": "true",
        },
    )

    # Get public URL
    result = client.storage.from_(BUCKET_NAME).get_public_url(storage_path)
    return result


def delete_pptx(job_id: str):
    """Delete a .pptx file from Supabase Storage (optional cleanup)."""
    try:
        client = get_client()
        client.storage.from_(BUCKET_NAME).remove([f"{job_id}.pptx"])
    except Exception as e:
        print(f"Supabase delete warning: {e}")


def is_configured() -> bool:
    """Check if Supabase env vars are set."""
    return bool(SUPABASE_URL and SUPABASE_KEY)