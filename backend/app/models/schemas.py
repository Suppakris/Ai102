from pydantic import BaseModel
from typing import Optional


class SlideContent(BaseModel):
    page: int
    title: str
    bullets: list[str]


class ConvertResponse(BaseModel):
    job_id: str
    slide_count: int
    presentation_title: str
    download_url: str
    slides_preview: list[SlideContent]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None