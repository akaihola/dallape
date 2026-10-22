"""List and proxy YouTube audio without storing media files.

yt-dlp may write its filesystem cache and the configured cookie file.
"""

import os
import re
from pathlib import Path
from time import monotonic
from urllib.parse import parse_qs, quote, unquote, urlparse

import anyio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from yt_dlp import YoutubeDL
from yt_dlp.networking import Request
from yt_dlp.utils import DownloadError

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
PATH_PREFIXES = ("/shorts/", "/embed/", "/live/", "/v/")
READ_SIZE = 64 * 1024
SOCKET_TIMEOUT = 10
STREAM_DEADLINE = 840


def parse_youtube(text: str) -> str | None:
    """Return the 11-char video id for a YouTube URL or bare id, else None."""
    text = text.strip()
    if VIDEO_ID_RE.match(text):
        return text
    try:
        u = urlparse(text if "://" in text else "https://" + text)
        port = u.port
    except ValueError:
        return None
    if u.scheme not in {"http", "https"} or u.username or u.password or port not in (None, 80, 443):
        return None
    if u.hostname not in HOSTS:
        return None
    if u.hostname == "youtu.be":
        vid = u.path.strip("/").split("/")[0]
    elif u.path == "/watch":
        vid = parse_qs(u.query).get("v", [""])[0]
    else:
        vid = next((u.path[len(p):].split("/")[0] for p in PATH_PREFIXES if u.path.startswith(p)), "")
    return vid if VIDEO_ID_RE.match(vid) else None


def ydl_opts() -> dict:
    opts = {
        "allowed_extractors": ["youtube"],  # never let the generic extractor fetch arbitrary URLs
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    if cookiefile := os.environ.get("YTDLP_COOKIEFILE"):
        opts["cookiefile"] = cookiefile
    return opts


def extract(video_id: str) -> dict:
    with YoutubeDL(ydl_opts()) as ydl:
        return ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)


def mime_for(fmt: dict) -> str:
    ext = fmt.get("ext")
    container = {"webm": "audio/webm", "m4a": "audio/mp4", "mp4": "audio/mp4", "mp3": "audio/mpeg", "ogg": "audio/ogg", "opus": "audio/ogg", "flac": "audio/flac", "wav": "audio/wav"}.get(ext, "application/octet-stream")
    return f'{container}; codecs="{fmt.get("acodec")}"'


def download_filename(info: dict, fmt: dict) -> str:
    bitrate = f"{fmt['abr']} kbps" if fmt.get("abr") else "Unknown bitrate"
    variant = f" [{fmt['format_id']}]" if fmt.get("language") or fmt.get("format_note") else ""
    return quote(f"{info.get('title') or info['id']} {bitrate}{variant}.{fmt.get('ext') or 'bin'}", safe="")


def audio_formats(info: dict) -> list[dict]:
    keys = ("format_id", "ext", "acodec", "abr", "filesize", "filesize_approx", "language", "format_note", "audio_channels")
    return [
        {k: f.get(k) for k in keys} | {"mime": mime_for(f), "filename": unquote(download_filename(info, f))}
        for f in info.get("formats", [])
        if f.get("vcodec") == "none"
        and f.get("acodec") not in (None, "none")
        and f.get("protocol") in ("http", "https")
    ]


class AudioStreamError(RuntimeError):
    """Public, credential-free upstream failure."""


def read_chunks(fmt: dict):
    """Yield validated upstream audio blocks; fail without retries."""
    headers = dict(fmt.get("http_headers") or {})
    headers["Accept-Encoding"] = "identity"
    chunk = (fmt.get("downloader_options") or {}).get("http_chunk_size")
    size = fmt.get("filesize")
    deadline = monotonic() + STREAM_DEADLINE
    try:
        with YoutubeDL(ydl_opts() | {"socket_timeout": SOCKET_TIMEOUT}) as ydl:
            start = 0
            while True:
                if monotonic() >= deadline:
                    raise AudioStreamError("audio stream deadline exceeded")
                ranged = bool(chunk and size)
                end = min(start + chunk, size) - 1 if ranged else None
                request_headers = headers | ({"Range": f"bytes={start}-{end}"} if ranged else {})
                with ydl.urlopen(Request(fmt["url"], headers=request_headers)) as response:
                    expected = size if end is None else end - start + 1
                    if response.status != (206 if ranged else 200):
                        raise AudioStreamError("unexpected upstream status")
                    if response.headers.get("Content-Encoding", "identity").lower() != "identity":
                        raise AudioStreamError("unexpected upstream encoding")
                    if ranged and response.headers.get("Content-Range") != f"bytes {start}-{end}/{size}":
                        raise AudioStreamError("invalid upstream content range")
                    length = response.headers.get("Content-Length")
                    if length is not None:
                        length = int(length)
                        if length < 0 or (expected is not None and expected != length):
                            raise AudioStreamError("invalid upstream content length")
                        expected = length
                    received = 0
                    pending = b""
                    while True:
                        if monotonic() >= deadline:
                            raise AudioStreamError("audio stream deadline exceeded")
                        data = response.read(READ_SIZE if expected is None else min(READ_SIZE, expected - received + 1))
                        if monotonic() >= deadline:
                            raise AudioStreamError("audio stream deadline exceeded")
                        received += len(data)
                        if expected is not None and received > expected:
                            raise AudioStreamError("oversized upstream response")
                        if not data:
                            if expected is not None and received != expected:
                                raise AudioStreamError("short upstream response")
                            if pending:
                                yield pending
                            break
                        # Hold the final block until EOF verifies the response length.
                        if pending:
                            yield pending
                        pending = data
                if end is None or end + 1 == size:
                    return
                start += received
    except Exception:  # noqa: BLE001 - every upstream failure must leave as the sanitized error
        # Do not chain networking errors: signed URLs and cookies may be in them.
        raise AudioStreamError("upstream audio stream failed") from None


class AudioResponse(StreamingResponse):
    def __init__(self, chunks, first, **kwargs):
        self.chunks = chunks

        async def body():
            if first:
                yield first
            sentinel = object()
            while True:
                data = await anyio.to_thread.run_sync(lambda: next(chunks, sentinel))
                if data is sentinel:
                    break
                yield data

        super().__init__(body(), **kwargs)

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # A cancelled consumer must still release the generator's upstream handle.
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(self.chunks.close)


app = FastAPI(title="Dallapé API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


def video_info(url: str) -> dict:
    video_id = parse_youtube(url)
    if not video_id:
        raise HTTPException(400, "not a YouTube URL or video id")
    try:
        return extract(video_id)
    except DownloadError:
        raise HTTPException(502, "video extraction failed") from None


@app.get("/api/health")
def health():
    """Cheap, side-effect-free probe; the Cloudflare loading page polls it."""
    return {"ok": True}


@app.get("/api/formats")
def formats(url: str):
    info = video_info(url)
    return {
        "id": info["id"],
        "title": info.get("title"),
        "duration": info.get("duration"),
        "formats": audio_formats(info),
    }


@app.get("/api/audio")
def audio(url: str, format: str):
    info = video_info(url)
    if format not in {f["format_id"] for f in audio_formats(info)}:
        raise HTTPException(404, "no such audio format")
    fmt = next(f for f in info["formats"] if f["format_id"] == format)
    filename = download_filename(info, fmt)
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    if fmt.get("filesize"):
        headers["Content-Length"] = str(fmt["filesize"])
    chunks = read_chunks(fmt)
    try:
        first = next(chunks, b"")
    except AudioStreamError:
        chunks.close()
        raise HTTPException(502, "upstream audio stream failed") from None
    return AudioResponse(chunks, first, media_type=mime_for(fmt).split(";")[0], headers=headers)


FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND.is_dir():  # the container image copies it to /app/frontend
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
