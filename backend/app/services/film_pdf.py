"""The full-length film's screenplay as a PDF — readable in every language the studio writes in.

Indian scripts need proper shaping (conjuncts, vowel signs), so the PDF uses fpdf2 with HarfBuzz text shaping and the
bundled Noto Sans fonts (SIL Open Font License, see app/fonts/OFL.txt): Latin plus Devanagari (Hindi, Marathi),
Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati and Gurmukhi (Punjabi). Mixed text (an English shot
description, a Hindi line) falls back font by font.
"""

from functools import lru_cache
from pathlib import Path

from fontTools.ttLib import TTFont
from fpdf import FPDF

from app.models import FilmProduction

FONTS = Path(__file__).resolve().parent.parent / "fonts"
SCRIPTS = ["Devanagari", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Gurmukhi"]
GOLD, INK, GREY, LIGHT = (176, 134, 50), (24, 24, 27), (100, 100, 110), (150, 150, 160)


class _Screenplay(FPDF):
    title_text = ""

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_xy(self.l_margin, -12)
        self.set_text_color(*LIGHT)
        for font, part in runs(f"{self.title_text}  ·  {self.page_no()}"):
            self.set_font(font, "", 8)
            self.write(4, part)


def _setup() -> _Screenplay:
    pdf = _Screenplay(format="A4")
    pdf.set_margins(22, 20, 22)
    pdf.set_auto_page_break(True, margin=18)
    pdf.add_font("Noto", "", str(FONTS / "NotoSans-Regular.ttf"))
    pdf.add_font("Noto", "B", str(FONTS / "NotoSans-Bold.ttf"))
    for s in SCRIPTS:
        pdf.add_font(f"Noto{s}", "", str(FONTS / f"NotoSans{s}-Regular.ttf"))
        pdf.add_font(f"Noto{s}", "B", str(FONTS / f"NotoSans{s}-Bold.ttf"))
    pdf.set_text_shaping(True)
    return pdf


@lru_cache
def _cmaps() -> dict[str, frozenset[int]]:
    files = {"Noto": "NotoSans-Regular.ttf", **{f"Noto{s}": f"NotoSans{s}-Regular.ttf" for s in SCRIPTS}}
    return {name: frozenset(TTFont(str(FONTS / f)).getBestCmap()) for name, f in files.items()}


def runs(text: str) -> list[tuple[str, str]]:
    """Split text into runs that one font can draw: Latin in Noto Sans, each Indian script in its own Noto font.
    Spaces and joiners stay with the run they're in, so words and conjuncts are shaped whole."""
    cmaps, out = _cmaps(), []
    font, buf = "Noto", ""
    for ch in text:
        code = ord(ch)
        if ch.isspace() or code in (0x200C, 0x200D) or (font != "Noto" and code in cmaps[font] and not ch.isascii()):
            pick = font if code in cmaps[font] else "Noto"
        else:
            pick = next((f for f in cmaps if code in cmaps[f]), "Noto")
        if pick != font and buf:
            out.append((font, buf))
            buf = ""
        font = pick
        buf += ch
    if buf:
        out.append((font, buf))
    return out


def _text(pdf: FPDF, text: str, size: float = 10.5, bold: bool = False, color=INK, gap: float = 1.5, indent: float = 0):
    """A paragraph that wraps across the page, switching fonts run by run (mixed English and Indian scripts)."""
    pdf.set_text_color(*color)
    left = pdf.l_margin
    pdf.set_left_margin(left + indent)
    pdf.set_x(left + indent)
    for font, part in runs(text.strip() or " "):
        pdf.set_font(font, "B" if bold else "", size)
        pdf.write(size * 0.5, part)
    pdf.set_left_margin(left)
    pdf.ln(size * 0.5 + gap)


def screenplay_pdf(prod: FilmProduction, title: str) -> bytes:
    pdf = _setup()
    pdf.title_text = title
    pdf.set_title(title)
    pdf.set_creator("Cinéma AI")
    bible = prod.story_bible or {}
    minutes = round(prod.target_seconds / 60)
    length = f"{minutes // 60} h {minutes % 60:02d} min" if minutes >= 60 else f"{minutes} min"

    # Title page
    pdf.add_page()
    pdf.ln(70)
    _text(pdf, title, size=28, bold=True, gap=6)
    _text(pdf, f"A feature film · {length} · {len(prod.scenes)} scenes", size=11, color=GREY, gap=2)
    if bible.get("genre") or bible.get("tone"):
        _text(pdf, " · ".join(x for x in (bible.get("genre", ""), bible.get("tone", "")) if x), size=10, color=GREY)
    if bible.get("logline"):
        pdf.ln(8)
        _text(pdf, bible["logline"], size=11, color=INK)

    # Story and cast
    if bible.get("story") or bible.get("characters"):
        pdf.add_page()
    if bible.get("story"):
        _text(pdf, "STORY", size=9, bold=True, color=GOLD, gap=3)
        for para in [p for p in bible["story"].split("\n\n") if p.strip()]:
            _text(pdf, para, size=10.5, gap=3)
        pdf.ln(4)
    if bible.get("characters"):
        _text(pdf, "CHARACTERS", size=9, bold=True, color=GOLD, gap=3)
        for c in bible["characters"]:
            from app.services.scene_generator import language_name
            facts = ", ".join(x for x in (c.get("age", ""), c.get("gender", ""), c.get("role", ""), c.get("family", ""),
                                          language_name(c.get("language", ""))) if x)
            _text(pdf, f"{c.get('name', '')}{f'  ({facts})' if facts else ''}", size=10.5, bold=True, gap=0.5)
            if c.get("personality") or c.get("appearance"):
                _text(pdf, " ".join(x for x in (c.get("personality", ""), c.get("appearance", "")) if x), size=9.5, color=GREY, gap=2.5)

    # Scenes
    for sc in prod.scenes:
        pdf.add_page() if sc.number == 1 else pdf.ln(6)
        if pdf.get_y() > pdf.h - 60:
            pdf.add_page()
        _text(pdf, f"SCENE {sc.number}  ·  ACT {sc.act}", size=8.5, bold=True, color=GOLD, gap=1)
        _text(pdf, sc.title, size=13, bold=True, gap=1)
        if sc.location:
            _text(pdf, sc.location, size=9.5, color=GREY, gap=3)
        if sc.script.strip():
            for line in sc.script.strip().split("\n"):
                # scene headings and character names (written in capitals) in bold — only Latin text has capitals
                upper = any("A" <= ch <= "Z" for ch in line) and not any("a" <= ch <= "z" for ch in line)
                _text(pdf, line or " ", size=10.5, bold=bool(upper), gap=0.8)
        else:
            _text(pdf, f"(Not written yet) {sc.summary}", size=10, color=GREY)
        if sc.shots:
            pdf.ln(2)
            _text(pdf, "SHOTS", size=8, bold=True, color=LIGHT, gap=1)
            for sh in sc.shots:
                _text(pdf, f"{sh.number}. {sh.camera} · {sh.movement} · {sh.seconds:g}s — {sh.description}", size=8.5, color=GREY, gap=0.5)
                for d in sh.dialogue or []:
                    _text(pdf, f"{d.get('character', '')}: {d.get('text', '')}", size=8.5, color=GREY, gap=0.5, indent=6)
                    if d.get("subtitle"):
                        _text(pdf, f"[{d['subtitle']}]", size=8, color=LIGHT, gap=0.5, indent=10)
    return bytes(pdf.output())
