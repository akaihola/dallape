import io

import pytest
from fastapi.testclient import TestClient

import app as backend

VIDEO_ID = "dQw4w9WgXcQ"
INFO = {
    "id": VIDEO_ID,
    "title": "Never / Gonna",
    "duration": 212,
    "formats": [
        {"format_id": "18", "ext": "mp4", "vcodec": "avc1", "acodec": "mp4a.40.2", "protocol": "https", "url": "u"},
        {"format_id": "140", "ext": "m4a", "vcodec": "none", "acodec": "mp4a.40.2", "abr": 129, "filesize": 3,
         "protocol": "https", "url": "u"},
        {"format_id": "251", "ext": "webm", "vcodec": "none", "acodec": "opus", "abr": 160, "filesize": 5,
         "protocol": "https", "url": "u", "downloader_options": {"http_chunk_size": 2}},
        {"format_id": "234", "ext": "mp4", "vcodec": "none", "acodec": "mp4a.40.2", "protocol": "m3u8_native", "url": "u"},
    ],
}
client = TestClient(backend.app)


@pytest.fixture
def canned(monkeypatch):
    calls = []
    monkeypatch.setattr(backend, "extract", lambda vid: calls.append(vid) or INFO)
    return calls


@pytest.mark.parametrize("text", [
    VIDEO_ID,
    f"https://www.youtube.com/watch?v={VIDEO_ID}&t=10",
    f"youtube.com/watch?v={VIDEO_ID}",
    f"https://youtu.be/{VIDEO_ID}?si=abc",
    f"https://m.youtube.com/shorts/{VIDEO_ID}",
    f"https://music.youtube.com/watch?v={VIDEO_ID}",
    f"https://www.youtube.com/embed/{VIDEO_ID}",
    f"https://www.youtube.com/live/{VIDEO_ID}",
    f"https://www.youtube.com/v/{VIDEO_ID}",
])
def test_parse_youtube(text):
    assert backend.parse_youtube(text) == VIDEO_ID


@pytest.mark.parametrize("text", ["http://169.254.169.254/computeMetadata/v1/", "garbage", "https://vimeo.com/123",
                                  "https://evil.example/watch?v=" + VIDEO_ID, ""])
def test_parse_youtube_rejects(text):
    assert backend.parse_youtube(text) is None
    assert client.get("/api/formats", params={"url": text}).status_code == 400


def test_audio_formats_filter():
    fmts = backend.audio_formats(INFO)
    assert [f["format_id"] for f in fmts] == ["140", "251"]
    assert fmts[0]["mime"] == 'audio/mp4; codecs="mp4a.40.2"'
    assert fmts[1]["mime"] == 'audio/webm; codecs="opus"'


def test_download_filename_encodes_title_and_includes_bitrate():
    assert backend.download_filename(INFO, INFO["formats"][2]) == "Never%20%2F%20Gonna%20160%20kbps.webm"


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"ok": True}


def test_formats_endpoint(canned):
    r = client.get("/api/formats", params={"url": f"https://youtu.be/{VIDEO_ID}"})
    assert r.status_code == 200
    assert r.json()["id"] == VIDEO_ID
    assert [f["format_id"] for f in r.json()["formats"]] == ["140", "251"]
    assert canned == [VIDEO_ID]


@pytest.mark.parametrize("fmt", ["18", "234", "999"])
def test_audio_unknown_format(canned, fmt):
    assert client.get("/api/audio", params={"url": VIDEO_ID, "format": fmt}).status_code == 404


def test_audio_streams(canned, monkeypatch):
    monkeypatch.setattr(backend, "read_chunks", lambda fmt: (data for data in [b"ab", b"cde"]))
    r = client.get("/api/audio", params={"url": VIDEO_ID, "format": "251"})
    assert r.status_code == 200
    assert r.content == b"abcde"
    assert r.headers["content-length"] == "5"
    assert r.headers["content-type"] == "audio/webm"
    assert r.headers["content-disposition"] == "attachment; filename*=UTF-8''Never%20%2F%20Gonna%20160%20kbps.webm"


def test_read_chunks_uses_ranges(monkeypatch):
    ranges = []

    def fake_urlopen(self, req):
        ranges.append(req.headers["Range"])
        start, end = map(int, req.headers["Range"][6:].split("-"))
        return Upstream(b"abcde"[start:end + 1], 206, {"Content-Range": f"bytes {start}-{end}/5"})

    monkeypatch.setattr(backend.YoutubeDL, "urlopen", fake_urlopen)
    assert b"".join(backend.read_chunks(INFO["formats"][2])) == b"abcde"
    assert ranges == ["bytes=0-1", "bytes=2-3", "bytes=4-4"]


class Upstream(io.BytesIO):
    def __init__(self, data=b"abcde", status=200, headers=None, fail=False):
        super().__init__(data)
        self.status = status
        self.headers = headers or {}
        self.fail = fail

    def read(self, size):
        if self.fail:
            raise OSError("secret signed URL and cookie")
        return super().read(size)


@pytest.mark.parametrize("text", [
    "https://[youtube.com/watch?v=" + VIDEO_ID,
    "https://youtube.com:bad/watch?v=" + VIDEO_ID,
    "https://youtube.com:99999/watch?v=" + VIDEO_ID,
    "https://user:password@youtube.com/watch?v=" + VIDEO_ID,
    "https://youtube.com:123/watch?v=" + VIDEO_ID,
    "ftp://youtube.com/watch?v=" + VIDEO_ID,
    "https://youtube.com＠evil.example/watch?v=" + VIDEO_ID,
])
def test_malformed_authority_parity(text):
    assert backend.parse_youtube(text) is None
    for endpoint in ("formats", "audio"):
        assert client.get(f"/api/{endpoint}", params={"url": text, "format": "140"}).status_code == 400


def test_captured_multilingual_contract_and_audio_selection(monkeypatch):
    import json
    from pathlib import Path
    from urllib.parse import unquote

    info = json.loads((Path(__file__).resolve().parents[2] / "frontend/tests/fixtures/youtube-multilingual.json").read_text())
    projected = backend.audio_formats(info)
    for raw, fmt in zip(info["formats"], projected, strict=True):
        assert all(fmt[key] == raw[key] for key in fmt)
        assert unquote(backend.download_filename(info, raw)) == fmt["filename"]
    assert len({f["filename"] for f in projected}) == len(projected)
    monkeypatch.setattr(backend, "extract", lambda _: info)
    selected = []
    monkeypatch.setattr(backend, "read_chunks", lambda fmt: selected.append(fmt["format_id"]) or (chunk for chunk in [b"abc"]))
    for fmt in info["formats"]:
        fmt["filesize"] = 3
        result = client.get("/api/audio", params={"url": info["id"], "format": fmt["format_id"]})
        assert result.status_code == 200
        assert result.headers["content-type"] == fmt["mime"].split(";")[0]
        assert unquote(result.headers["content-disposition"].split("''")[1]) == fmt["filename"]
    assert selected == [f["format_id"] for f in info["formats"]]


def test_missing_bitrate_and_sizes_remain_unknown(monkeypatch):
    fmt = {"format_id": "unknown-id", "ext": "webm", "acodec": "opus", "vcodec": "none", "protocol": "http"}
    info = {"id": VIDEO_ID, "formats": [fmt]}
    monkeypatch.setattr(backend, "extract", lambda _: info)
    monkeypatch.setattr(backend, "read_chunks", lambda _: (chunk for chunk in [b"abc"]))
    result = client.get("/api/formats", params={"url": VIDEO_ID}).json()["formats"][0]
    assert all(result[k] is None for k in ("abr", "filesize", "filesize_approx", "language", "format_note", "audio_channels"))
    assert result["filename"] == f"{VIDEO_ID} Unknown bitrate.webm"
    audio = client.get("/api/audio", params={"url": VIDEO_ID, "format": "unknown-id"})
    assert audio.status_code == 200
    assert "content-length" not in audio.headers


@pytest.mark.parametrize("changes", [
    {"protocol": "m3u8_native"}, {"protocol": "http_dash_segments"}, {"protocol": "ftp"},
    {"vcodec": "avc1"}, {"acodec": "none"}, {"acodec": None},
])
def test_format_allowlist_cannot_be_bypassed_by_unknown_ids(monkeypatch, changes):
    fmt = INFO["formats"][1] | {"format_id": "new-variant"} | changes
    monkeypatch.setattr(backend, "extract", lambda _: INFO | {"formats": [fmt]})
    assert client.get("/api/formats", params={"url": VIDEO_ID}).json()["formats"] == []
    assert client.get("/api/audio", params={"url": VIDEO_ID, "format": "new-variant"}).status_code == 404
