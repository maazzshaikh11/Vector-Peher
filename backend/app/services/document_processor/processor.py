"""Document extraction with Docling (primary) and a pypdf fallback.

Docling preserves page numbers, headings, paragraphs and tables where
possible. If Docling is not installed / fails to load, pypdf is used as a
fallback so the pipeline still works; the extractor used is recorded in the
document's chunk metadata and in processing logs.
"""
import time
from dataclasses import dataclass, field

from app.core.config import get_settings


@dataclass
class PageText:
    page_number: int
    text: str


@dataclass
class ExtractionResult:
    pages: list[PageText] = field(default_factory=list)
    page_count: int = 0
    extractor: str = "unknown"
    duration_seconds: float = 0.0

    @property
    def full_text(self) -> str:
        return "\n\n".join(p.text for p in self.pages if p.text.strip())


def _artifacts_path():
    """Local Docling model artifacts dir (pre-downloaded layout model).

    Docling normally downloads layout/table models from HuggingFace on first
    use; on networks where the HF client cannot reach huggingface.co, point
    it at a local copy instead. Returns None when absent (Docling then tries
    its own download and the caller falls back to pypdf on failure).
    """
    from pathlib import Path

    candidates = [
        Path(__file__).resolve().parent.parent.parent.parent / ".docling-models",
        Path.home() / ".cache" / "docling-models",
    ]
    for cand in candidates:
        if (cand / "model_artifacts" / "layout" / "model.safetensors").exists():
            return cand
    return None


def extract_with_docling(file_path: str) -> ExtractionResult:
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    artifacts = _artifacts_path()
    pipeline_options = PdfPipelineOptions(
        artifacts_path=artifacts,
        do_table_structure=False,  # tableformer weights not bundled; avoids a 145MB+ download
        do_ocr=False,  # scanned PDFs yield no text here; pypdf fallback handles them
    )
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    result = converter.convert(file_path)
    doc = result.document
    pages: list[PageText] = []
    # Docling export_to_markdown loses page boundaries; iterate text items
    # with their provenance (page number) instead.
    page_texts: dict[int, list[str]] = {}
    for item, _level in doc.iterate_items():
        text = getattr(item, "text", None)
        if not text:
            continue
        page_no = 1
        prov = getattr(item, "prov", None)
        if prov:
            try:
                page_no = int(prov[0].page_no)
            except Exception:
                page_no = 1
        page_texts.setdefault(page_no, []).append(text)
    if not page_texts:
        # Fallback: whole-document markdown on page 1.
        md = doc.export_to_markdown()
        if md.strip():
            page_texts[1] = [md]
    for page_no in sorted(page_texts):
        joined = "\n".join(page_texts[page_no]).strip()
        if joined:
            pages.append(PageText(page_number=page_no, text=joined))
    return ExtractionResult(
        pages=pages,
        page_count=max((p.page_number for p in pages), default=0),
        extractor="docling",
    )


def extract_with_pypdf(file_path: str) -> ExtractionResult:
    from pypdf import PdfReader

    reader = PdfReader(file_path)
    pages: list[PageText] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append(PageText(page_number=i, text=text.strip()))
    return ExtractionResult(
        pages=pages,
        page_count=len(reader.pages),
        extractor="pypdf",
    )


def extract_document(file_path: str) -> ExtractionResult:
    """Extract text per page. Tries Docling first, falls back to pypdf."""
    started = time.monotonic()
    settings = get_settings()
    prefer_docling = True
    try:
        result = extract_with_docling(file_path)
        if result.pages:
            result.duration_seconds = time.monotonic() - started
            return result
        prefer_docling = False
    except Exception as exc:  # Docling unavailable or failed on this file
        print(f"[document_processor] docling failed ({exc}); using pypdf fallback")
        prefer_docling = False
    if not prefer_docling:
        result = extract_with_pypdf(file_path)
        result.duration_seconds = time.monotonic() - started
        return result
    # Docling ran but found no text (e.g. scanned PDF): still try pypdf.
    result = extract_with_pypdf(file_path)
    result.duration_seconds = time.monotonic() - started
    return result
