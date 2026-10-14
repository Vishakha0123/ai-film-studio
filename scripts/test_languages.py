"""Check that the studio writes films in every supported language.

Runs against your local backend (AUTH_MODE=dev) and the real story model (STORY_PROVIDER=sarvam).

    python scripts/test_languages.py                 # one new film per language
    python scripts/test_languages.py --versions      # one film, then a version in every other language
    python scripts/test_languages.py --only ta,gu    # just some languages

For each language it reports whether the film came back, and how much of the story is written in
that language's own script (e.g. Tamil letters for Tamil). Takes about 1 minute per language.
"""

import argparse
import sys
import time
import unicodedata

import httpx

LANGS = {
    "en": ("English", "LATIN"),
    "hi": ("Hindi", "DEVANAGARI"),
    "ta": ("Tamil", "TAMIL"),
    "te": ("Telugu", "TELUGU"),
    "kn": ("Kannada", "KANNADA"),
    "ml": ("Malayalam", "MALAYALAM"),
    "bn": ("Bengali", "BENGALI"),
    "mr": ("Marathi", "DEVANAGARI"),
    "gu": ("Gujarati", "GUJARATI"),
    "pa": ("Punjabi", "GURMUKHI"),
}

PROMPT = ("Fantasy film. Characters: Meera, 16, a shy village girl who can hear trees speak; Kaali, an old "
          "talking crow who was once a king; and Rudra, a shadow sorcerer who wants to drink the light of the "
          "ancient banyan tree. When the tree begins to die, Meera and Kaali must find the lost seed of light "
          "before Rudra does.")


def script_share(text: str, script: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    hits = sum(1 for c in letters if unicodedata.name(c, "").startswith(script))
    return hits / len(letters)


def wait(client: httpx.Client, job: dict, timeout: int) -> dict:
    end = time.time() + timeout
    while job["status"] in ("queued", "running"):
        if time.time() > end:
            return {**job, "status": "timeout", "error": f"no answer after {timeout}s"}
        time.sleep(3)
        job = client.get(f"/api/v1/jobs/{job['id']}").raise_for_status().json()
    return job


def report(code: str, project: dict | None, job: dict, seconds: float) -> bool:
    name, script = LANGS[code]
    if job["status"] != "completed" or not project or not project.get("memory"):
        print(f"  FAIL  {name:<10} {job['status']}: {job.get('error') or 'no film'}  ({seconds:.0f}s)")
        return False
    m = project["memory"]
    text = " ".join([m.get("logline", ""), m.get("story", "")] + [c.get("personality", "") for c in m.get("characters", [])])
    share = script_share(text, script)
    ok = share >= 0.6
    print(f"  {'PASS' if ok else 'WARN'}  {name:<10} {share:>4.0%} in {script.title()} script · "
          f"{len(m.get('characters', []))} characters · {len(m.get('shots', []))} shots · "
          f"\"{m.get('title', '')[:40]}\"  ({seconds:.0f}s)")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--user", default="language-test@dev.local", help="dev login email (AUTH_MODE=dev)")
    ap.add_argument("--only", default="", help="comma-separated codes, e.g. ta,hi,gu")
    ap.add_argument("--versions", action="store_true", help="make one film, then versions in the other languages")
    ap.add_argument("--timeout", type=int, default=300, help="seconds to wait per language")
    a = ap.parse_args()

    codes = [c.strip() for c in a.only.split(",") if c.strip()] or list(LANGS)
    unknown = [c for c in codes if c not in LANGS]
    if unknown:
        print(f"Unknown language codes: {', '.join(unknown)}. Use: {', '.join(LANGS)}")
        return 2

    client = httpx.Client(base_url=a.api, headers={"Authorization": f"Bearer dev:{a.user}"}, timeout=60)
    try:
        health = client.get("/health").raise_for_status().json()
    except httpx.HTTPError as e:
        print(f"Can't reach the backend at {a.api}: {e}\nStart it first: uvicorn app.main:app --reload")
        return 2
    story = health.get("providers", {}).get("story")
    print(f"Backend {a.api} · story model: {story}")
    if story == "mock":
        print("Note: STORY_PROVIDER=mock writes everything in English — set STORY_PROVIDER=sarvam to test languages.\n")
    try:
        client.get("/api/v1/me").raise_for_status()
    except httpx.HTTPStatusError:
        print("Login failed — this script uses the dev login, so run the backend with AUTH_MODE=dev.")
        return 2

    results = {}
    if a.versions:
        base = codes[0]
        print(f"\nMaking the film in {LANGS[base][0]}, then versions in the other languages:")
        t = time.time()
        p = client.post("/api/v1/projects", json={"genres": ["Fantasy"], "language": base}).raise_for_status().json()
        job = client.post(f"/api/v1/projects/{p['id']}/plan", json={"prompt": PROMPT}).raise_for_status().json()
        job = wait(client, job, a.timeout)
        project = client.get(f"/api/v1/projects/{p['id']}").json()
        results[base] = report(base, project, job, time.time() - t)
        if not results[base]:
            return 1
        for code in codes[1:]:
            t = time.time()
            r = client.post(f"/api/v1/projects/{p['id']}/versions", json={"language": code})
            if r.status_code >= 400:
                print(f"  FAIL  {LANGS[code][0]:<10} {r.status_code}: {r.text[:120]}")
                results[code] = False
                continue
            body = r.json()
            job = wait(client, body["job"], a.timeout)
            project = client.get(f"/api/v1/projects/{body['project']['id']}").json()
            results[code] = report(code, project, job, time.time() - t)
    else:
        print("\nOne new Fantasy film per language (prompt written in English):")
        for code in codes:
            t = time.time()
            p = client.post("/api/v1/projects", json={"genres": ["Fantasy"], "language": code}).raise_for_status().json()
            job = client.post(f"/api/v1/projects/{p['id']}/plan", json={"prompt": PROMPT}).raise_for_status().json()
            job = wait(client, job, a.timeout)
            project = client.get(f"/api/v1/projects/{p['id']}").json()
            results[code] = report(code, project, job, time.time() - t)

    passed = sum(results.values())
    print(f"\n{passed}/{len(results)} languages passed. The films are in Projects for {a.user}.")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
