"""Attached source material: validation and text extraction (report section 20)."""

import io
import re
import zipfile
from xml.etree import ElementTree

MAX_BYTES = 10 * 1024 * 1024
MAX_FILES_PER_PROJECT = 20
MAX_TEXT_CHARS = 60_000

TYPES = {
    ".txt": "text", ".md": "text", ".fountain": "text",
    ".pdf": "pdf",
    ".docx": "docx",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image",
}


class DocumentError(ValueError):
    pass


def classify(filename: str) -> str:
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in TYPES:
        raise DocumentError("Attach a PDF, Word (.docx), text (.txt, .md) or image (PNG, JPG, WebP) file.")
    return TYPES[ext]


def _check_signature(kind: str, data: bytes) -> None:
    """Don't trust the extension alone."""
    ok = {
        "pdf": data.startswith(b"%PDF"),
        "docx": data.startswith(b"PK"),
        "image": data[:8].startswith(b"\x89PNG") or data[:3] == b"\xff\xd8\xff" or (data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
        "text": b"\x00" not in data[:4096],
    }[kind]
    if not ok:
        raise DocumentError("The file's contents don't match its type.")


def extract_text(kind: str, data: bytes) -> tuple[str, str]:
    """Return (text, source_reference)."""
    if kind == "text":
        for enc in ("utf-8", "utf-16", "latin-1"):
            try:
                return data.decode(enc).strip()[:MAX_TEXT_CHARS], ""
            except UnicodeDecodeError:
                continue
    if kind == "pdf":
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(data))
            pages = [(p.extract_text() or "").strip() for p in reader.pages]
        except Exception as e:  # malformed / encrypted PDF
            raise DocumentError("This PDF couldn't be read. Is it password-protected?") from e
        text = "\n\n".join(t for t in pages if t)
        return text[:MAX_TEXT_CHARS], f"{len(pages)} page{'s' if len(pages) != 1 else ''}"
    if kind == "docx":
        try:
            xml = zipfile.ZipFile(io.BytesIO(data)).read("word/document.xml")
        except (zipfile.BadZipFile, KeyError) as e:
            raise DocumentError("This Word file couldn't be read.") from e
        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        root = ElementTree.fromstring(xml)
        paras = ["".join(t.text or "" for t in p.iter(f"{ns}t")) for p in root.iter(f"{ns}p")]
        return "\n".join(p for p in paras if p.strip())[:MAX_TEXT_CHARS], ""
    return "", ""  # images: kept as visual reference (no OCR provider connected yet)


def validate_and_extract(filename: str, data: bytes) -> tuple[str, str, str]:
    if not data:
        raise DocumentError("The file is empty.")
    if len(data) > MAX_BYTES:
        raise DocumentError("Files can be up to 10 MB.")
    kind = classify(filename)
    _check_signature(kind, data)
    text, ref = extract_text(kind, data)
    return kind, re.sub(r"[ \t]+\n", "\n", text), ref


def source_material(docs) -> str:
    """Combine attached documents into the brief's source material."""
    parts = []
    for d in docs:
        if d.extracted_text:
            parts.append(f"--- {d.filename} ---\n{d.extracted_text}")
        elif d.type == "image":
            parts.append(f"--- {d.filename} --- (reference image attached)")
    return "\n\n".join(parts)[:24_000]
