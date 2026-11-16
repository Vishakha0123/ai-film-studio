"""Only one part of the creator's film: the story, the screenplay (with dialogue) or the songs."""
import pytest

from conftest import auth


def _project(client, prompt):
    p = client.post("/api/v1/projects", json={"genres": ["Drama"]}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/brief", json={"prompt": prompt, "genres": ["Drama"]}, headers=auth())
    return p["id"]


def _memory(client, pid):
    return client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]


@pytest.mark.parametrize("part, has, empty", [
    ("story", ["logline", "story"], ["screenplay", "characters", "dialogue", "scenes", "shots", "lyrics"]),
    ("screenplay", ["screenplay", "characters", "dialogue"], ["story", "scenes", "shots", "lyrics"]),
    ("lyrics", ["lyrics"], ["story", "screenplay", "characters", "dialogue", "scenes", "shots"]),
])
def test_only_one_part_is_written(client, part, has, empty):
    pid = _project(client, "I have a movie about a kabaddi girl in Madurai; I want only this part")
    job = client.post(f"/api/v1/projects/{pid}/plan", json={"only": part}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "completed" and done["result"]["only"] == part
    m = _memory(client, pid)
    assert m["only"] == part and m["title"]
    for k in has:
        assert m.get(k), k
    for k in empty:
        assert not m.get(k), k


def test_only_lyrics_writes_the_songs_asked_for_with_where_they_play(client):
    pid = _project(client, "My film: two brothers run a tea stall in Ooty. I need 3 songs for it, only lyrics")
    client.post(f"/api/v1/projects/{pid}/plan", json={"only": "lyrics", "songs": 3}, headers=auth())
    m = _memory(client, pid)
    songs = [m["lyrics"], *m["songs"]]
    assert len(songs) == 3 and all(s["chorus"] and s["moment"] for s in songs)


def test_download_just_one_part(client):
    pid = _project(client, "only the songs for my film")
    client.post(f"/api/v1/projects/{pid}/plan", json={"only": "lyrics"}, headers=auth())
    r = client.get(f"/api/v1/projects/{pid}/script?format=txt&part=lyrics", headers=auth())
    assert r.status_code == 200 and "SONG —" in r.text and "Opening" in r.text
    assert "lyrics.txt" in r.headers["content-disposition"]
    pdf = client.get(f"/api/v1/projects/{pid}/script?format=pdf&part=lyrics", headers=auth())
    assert pdf.status_code == 200 and pdf.content[:5] == b"%PDF-"
    # a story-only download of a lyrics-only film has nothing in it
    assert client.get(f"/api/v1/projects/{pid}/script?part=story", headers=auth()).status_code == 409


def test_make_the_rest_of_the_film_keeps_the_part_already_written(client):
    pid = _project(client, "I have a film about a lighthouse keeper — only lyrics please")
    client.post(f"/api/v1/projects/{pid}/plan", json={"only": "lyrics"}, headers=auth())
    song = _memory(client, pid)["lyrics"]
    client.patch(f"/api/v1/projects/{pid}/memory", json={"lyrics": {**song, "chorus": "My own chorus, line one"}}, headers=auth())

    job = client.post(f"/api/v1/projects/{pid}/plan", json={"rest": True}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    m = _memory(client, pid)
    assert m["only"] == "" and m["story"] and m["screenplay"] and m["scenes"]  # the whole film now
    assert m["lyrics"]["chorus"] == "My own chorus, line one"                  # the creator's song kept


def test_only_must_be_a_known_part(client):
    pid = _project(client, "x")
    assert client.post(f"/api/v1/projects/{pid}/plan", json={"only": "storyboard"}, headers=auth()).status_code == 422


@pytest.mark.parametrize("part", ["story", "screenplay", "lyrics"])
def test_sarvam_prompt_for_one_part_is_complete(part):
    import json
    import re
    from app.prompts import ONE_PART, render
    from app.services.languages import describe
    from app.services.one_part import FORMAT_NOTES, INSTRUCTIONS, PART_NAMES, SCHEMAS
    text = render(ONE_PART, part_name=PART_NAMES[part], part_instructions=INSTRUCTIONS[part], schema=SCHEMAS[part],
                  format_note=FORMAT_NOTES.get(part, ""), output_language=describe("ta"),
                  brief=json.dumps({"prompt": "my film", "language": "ta"}))
    assert not re.search(r"\{(part_name|part_instructions|schema|format_note|output_language|brief)\}", text)
    assert PART_NAMES[part] in text and "Tamil" in text and '"title"' in text


@pytest.mark.parametrize("reply", [
    # all songs in one list
    {"title": "Chai", "lyrics": [{"title": "A", "verse": "v1", "chorus": "c1"}, {"title": "B", "verse": "v2", "chorus": "c2"}]},
    # different keys, lines as lists, pre_chorus
    {"title": "Chai", "songs": [{"name": "A", "verse": ["l1", "l2"], "pre_chorus": "p", "chorus": ["c1"]},
                                {"songTitle": "B", "stanza": "v2", "hook": "c2"}]},
    # "song" + "otherSongs"
    {"title": "Chai", "song": {"title": "A", "verse": "v1", "chorus": "c1"}, "otherSongs": [{"title": "B", "verse": "v2", "chorus": "c2"}]},
    # wrapped
    {"film": {"title": "Chai", "lyrics": {"title": "A", "verse": "v1", "chorus": "c1"}, "songs": [{"title": "B", "verse": "v2", "chorus": "c2"}]}},
    # numbered songs in an object
    {"title": "Chai", "songs": {"song1": {"title": "A", "verse": "v1", "chorus": "c1"}, "song2": {"title": "B", "verse": "v2", "chorus": "c2"}}},
])
def test_songs_are_found_whatever_shape_the_model_uses(reply):
    from app.services.pipeline import validate_film
    from app.services.one_part import normalize_part
    m = validate_film({**normalize_part("lyrics", reply), "only": "lyrics"})
    titles = [m["lyrics"]["title"], *(s["title"] for s in m["songs"])]
    assert titles == ["A", "B"] and m["lyrics"]["verse"] and m["lyrics"]["chorus"]


def test_a_single_bare_song_is_the_lyrics():
    from app.services.one_part import normalize_part
    out = normalize_part("lyrics", {"title": "Rain", "style": "Melody", "verse": "a\nb", "chorus": "c"})
    assert out["lyrics"]["title"] == "Rain" and out["lyrics"]["verse"] == "a\nb" and out["songs"] == []


def test_story_and_screenplay_in_other_shapes():
    from app.services.one_part import normalize_part
    assert normalize_part("story", {"title": "T", "story": ["p1", "p2"]})["story"] == "p1\n\np2"
    sp = normalize_part("screenplay", {"result": {"title": "T", "script": ["INT. HOUSE", "RAVI", "Hello"], "dialogues": [{"character": "Ravi", "text": "Hello"}]}})
    assert sp["screenplay"].startswith("INT. HOUSE") and sp["dialogue"][0]["text"] == "Hello"


def test_a_reply_without_the_songs_is_asked_again_before_failing(client, monkeypatch):
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory
    calls = []
    good = {"title": "Chai", "lyrics": {"title": "A", "verse": "v", "chorus": "c"}, "songs": []}

    async def write_part(self, brief, part):
        calls.append(part)
        return ProviderResult({"title": "Chai", "genre": "Drama"} if len(calls) == 1 else good, provider="mock", model="x")
    monkeypatch.setattr(MockStory, "write_part", write_part)
    pid = _project(client, "Two brothers run a tea stall in Ooty and both fall for the same girl")
    job = client.post(f"/api/v1/projects/{pid}/plan", json={"only": "lyrics"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert len(calls) == 2 and _memory(client, pid)["lyrics"]["title"] == "A"

    # still nothing after the second try: a clear message
    calls.clear()

    async def empty(self, brief, part):
        calls.append(part)
        return ProviderResult({"title": "Chai"}, provider="mock", model="x")
    monkeypatch.setattr(MockStory, "write_part", empty)
    pid2 = _project(client, "another film")
    job = client.post(f"/api/v1/projects/{pid2}/plan", json={"only": "lyrics"}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert len(calls) == 2 and done["status"] in ("failed", "needs_review")
    assert "didn't contain the songs (lyrics)." in (done.get("error") or "")


def test_a_reply_split_over_several_blocks_is_read_whole():
    """What Sarvam did on the live site: title/genre/tone in one ```json block, the songs in the next."""
    from app.providers._json import extract_json
    reply = ('Here is the film info:\n```json\n{"title": "Tea Stall Hearts", "genre": "Romantic Comedy", "tone": "Bittersweet"}\n```\n'
             'And the songs:\n```json\n{"lyrics": {"title": "Chai", "verse": "v", "chorus": "c"}, '
             '"songs": [{"title": "Mist", "verse": "v2", "chorus": "c2"}]}\n```')
    data = extract_json(reply)
    assert data["title"] == "Tea Stall Hearts" and data["lyrics"]["title"] == "Chai" and data["songs"][0]["title"] == "Mist"
    # two objects one after another, without fences
    data = extract_json('{"title": "T", "genre": "G"}\n\n{"lyrics": {"title": "A", "verse": "v", "chorus": "c"}}')
    assert data["title"] == "T" and data["lyrics"]["title"] == "A"
    # the usual single object is unchanged
    assert extract_json('```json\n{"a": {"b": 1}}\n```') == {"a": {"b": 1}}
    assert extract_json('<think>x</think>{"a": 1}') == {"a": 1}
