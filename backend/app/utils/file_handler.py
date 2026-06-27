import os
import uuid
import shutil
from pathlib import Path

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


def save_upload(file_content: bytes, original_filename: str) -> str:
    """Save uploaded PDF and return its path."""
    file_id = str(uuid.uuid4())
    ext = Path(original_filename).suffix or ".pdf"
    path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    with open(path, "wb") as f:
        f.write(file_content)
    return path


def get_output_path(file_id: str) -> str:
    """Return output path for a generated .pptx file."""
    return os.path.join(OUTPUT_DIR, f"{file_id}.pptx")


def cleanup_upload(path: str):
    """Delete temp upload file."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def cleanup_old_outputs(max_age_hours: int = 1):
    """Remove .pptx files older than max_age_hours."""
    import time
    now = time.time()
    for fname in os.listdir(OUTPUT_DIR):
        fpath = os.path.join(OUTPUT_DIR, fname)
        if os.path.isfile(fpath):
            age_hours = (now - os.path.getmtime(fpath)) / 3600
            if age_hours > max_age_hours:
                os.remove(fpath)