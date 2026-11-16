"""The film's script (the version written in the Story → Storyboard sections) as a text file or a PDF.

Every film has this, whatever its length — a 1-minute short included. A full-length film's scene-by-scene
screenplay has its own download (film_routes.download_script)."""

from urllib.parse import quote

from app.services.scene_generator import language_name


def download_headers(title: str, fmt: str) -> dict[str, str]:
    """Content-Disposition with an ASCII fallback name plus the real (e.g. Tamil) name per RFC 6266."""
    name = "".join(c for c in (title or "film") if c.isprintable() and c not in '\\/:*?"<>|').strip() or "film"
    ascii_name = "".join(c for c in name if c.isascii()).strip() or "film"
    return {"Content-Disposition": f'attachment; filename="{ascii_name} - script.{fmt}"; '
                                   f"filename*=UTF-8''{quote(name + ' - script.' + fmt)}"}


def has_script(memory: dict) -> bool:
    return bool((memory or {}).get("screenplay", "").strip() or (memory or {}).get("story", "").strip())


def _facts(c: dict) -> str:
    return ", ".join(x for x in (c.get("age", ""), c.get("gender", ""), c.get("role", ""), c.get("family", ""),
                                 language_name(c.get("language", "")) if c.get("language") else "") if x)


def _song_parts(song: dict) -> list[tuple[str, str]]:
    return [(label, song.get(key, "").strip()) for label, key in
            (("Verse", "verse"), ("Pre-chorus", "preChorus"), ("Chorus", "chorus"), ("Bridge", "bridge")) if song.get(key, "").strip()]


def _songs(memory: dict) -> list[dict]:
    return [s for s in [memory.get("lyrics") or {}, *(memory.get("songs") or [])] if isinstance(s, dict) and _song_parts(s)]


def _subtitle(line: str) -> str:
    return f"[{line}]"


def short_script_text(memory: dict, title: str) -> str:
    m = memory or {}
    scenes, out = m.get("scenes") or [], [title.upper()]
    meta = " · ".join(x for x in (m.get("genre", ""), m.get("tone", ""), f"{len(scenes)} scenes" if scenes else "") if x)
    out += [meta, ""] if meta else [""]
    if m.get("logline"):
        out += [m["logline"].strip(), ""]
    if m.get("story"):
        out += ["STORY", "", m["story"].strip(), ""]
    if m.get("characters"):
        out += ["CHARACTERS"] + [f"  {c.get('name', '')}{f' ({_facts(c)})' if _facts(c) else ''}" for c in m["characters"]] + [""]
    if m.get("screenplay", "").strip():
        out += ["=" * 60, "SCREENPLAY", "=" * 60, "", m["screenplay"].strip(), ""]
    if m.get("dialogue"):
        out += ["=" * 60, "DIALOGUE", "=" * 60]
        current = object()
        for d in m["dialogue"]:
            if d.get("scene") != current:
                current = d.get("scene")
                out += ["", f"Scene {current}" if current else "Lines"]
            out.append(f"  {d.get('character', '')}: {d.get('text', '')}")
            if d.get("subtitle"):
                out.append(f"    {_subtitle(d['subtitle'])}")
        out.append("")
    if scenes:
        out += ["=" * 60, "SCENES", "=" * 60, ""]
        for sc in scenes:
            head = " · ".join(x for x in (sc.get("location", ""), sc.get("time", ""), sc.get("duration", "")) if x)
            out += [f"{sc.get('number', '')}. {head}", f"   {sc.get('description', '')}".rstrip(), ""]
    for song in _songs(m):
        out += ["=" * 60, f"SONG — {song.get('title') or 'Theme song'}" + (f" ({song['style']})" if song.get("style") else ""), "=" * 60, ""]
        for label, text in _song_parts(song):
            out += [label.upper(), text, ""]
    return "\n".join(out).rstrip() + "\n"


def short_script_pdf(memory: dict, title: str) -> bytes:
    from app.services.film_pdf import GOLD, GREY, INK, LIGHT, _setup, _text
    m = memory or {}
    scenes = m.get("scenes") or []
    pdf = _setup()
    pdf.title_text = title
    pdf.set_title(title)
    pdf.set_creator("Cinéma AI")

    # Title page
    pdf.add_page()
    pdf.ln(70)
    _text(pdf, title, size=28, bold=True, gap=6)
    _text(pdf, " · ".join(x for x in (m.get("genre", ""), m.get("tone", ""), f"{len(scenes)} scenes" if scenes else "") if x) or "A film",
          size=11, color=GREY, gap=2)
    if m.get("logline"):
        pdf.ln(8)
        _text(pdf, m["logline"], size=11, color=INK)

    def heading(text: str) -> None:
        pdf.add_page()
        _text(pdf, text, size=9, bold=True, color=GOLD, gap=4)

    if m.get("story") or m.get("characters"):
        pdf.add_page()
    if m.get("story"):
        _text(pdf, "STORY", size=9, bold=True, color=GOLD, gap=3)
        for para in [p for p in m["story"].split("\n\n") if p.strip()]:
            _text(pdf, para, size=10.5, gap=3)
        pdf.ln(4)
    if m.get("characters"):
        _text(pdf, "CHARACTERS", size=9, bold=True, color=GOLD, gap=3)
        for c in m["characters"]:
            _text(pdf, f"{c.get('name', '')}{f'  ({_facts(c)})' if _facts(c) else ''}", size=10.5, bold=True, gap=0.5)
            if c.get("personality") or c.get("appearance"):
                _text(pdf, " ".join(x for x in (c.get("personality", ""), c.get("appearance", "")) if x), size=9.5, color=GREY, gap=2.5)

    if m.get("screenplay", "").strip():
        heading("SCREENPLAY")
        for line in m["screenplay"].strip().split("\n"):
            # scene headings and character names (written in capitals) in bold — only Latin text has capitals
            upper = any("A" <= ch <= "Z" for ch in line) and not any("a" <= ch <= "z" for ch in line)
            _text(pdf, line or " ", size=10.5, bold=bool(upper), gap=0.8)

    if m.get("dialogue"):
        heading("DIALOGUE")
        current = object()
        for d in m["dialogue"]:
            if d.get("scene") != current:
                current = d.get("scene")
                pdf.ln(2)
                _text(pdf, f"SCENE {current}" if current else "LINES", size=8.5, bold=True, color=LIGHT, gap=1.5)
            _text(pdf, d.get("character", ""), size=9.5, bold=True, gap=0.3)
            _text(pdf, d.get("text", ""), size=10.5, gap=0.8, indent=6)
            if d.get("subtitle"):
                _text(pdf, _subtitle(d["subtitle"]), size=9, color=GREY, gap=1.5, indent=6)

    if scenes:
        heading("SCENES")
        for sc in scenes:
            head = " · ".join(x for x in (sc.get("location", ""), sc.get("time", ""), sc.get("duration", "")) if x)
            _text(pdf, f"{sc.get('number', '')}. {head}", size=10.5, bold=True, gap=0.5)
            if sc.get("description"):
                _text(pdf, sc["description"], size=10, color=GREY, gap=2.5, indent=5)

    for song in _songs(m):
        heading(f"SONG · {song.get('title') or 'Theme song'}" + (f" · {song['style']}" if song.get("style") else ""))
        for label, text in _song_parts(song):
            _text(pdf, label.upper(), size=8.5, bold=True, color=LIGHT, gap=1)
            for line in text.split("\n"):
                _text(pdf, line or " ", size=10.5, gap=0.6)
            pdf.ln(3)
    return bytes(pdf.output())
