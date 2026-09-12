"""Dallapé backend: stateless yt-dlp proxy for listing and streaming audio tracks."""

import os
import re
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

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


def parse_youtube(text: str) -> str | None:
    """Return the 11-char video id for a YouTube URL or bare id, else None."""
    text = text.strip()
    if VIDEO_ID_RE.match(text):
        return text
    u = urlparse(text if "://" in text else "https://" + text)
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
    container = "audio/webm" if fmt.get("ext") == "webm" else "audio/mp4"
    return f'{container}; codecs="{fmt.get("acodec")}"'


def audio_formats(info: dict) -> list[dict]:
    keys = ("format_id", "ext", "acodec", "abr", "filesize", "filesize_approx")
    return [
        {k: f.get(k) for k in keys} | {"mime": mime_for(f)}
        for f in info.get("formats", [])
        if f.get("vcodec") == "none"
        and f.get("acodec") not in (None, "none")
        and f.get("protocol") in ("http", "https")
    ]


def read_chunks(fmt: dict):
    """Yield the audio bytes, using ranged requests when yt-dlp advises a chunk size."""
    headers = dict(fmt.get("http_headers") or {})
    chunk = (fmt.get("downloader_options") or {}).get("http_chunk_size")
    size = fmt.get("filesize")
    with YoutubeDL(ydl_opts()) as ydl:
        if not chunk or not size:
            with ydl.urlopen(Request(fmt["url"], headers=headers)) as r:
                while data := r.read(READ_SIZE):
                    yield data
            return
        start = 0
        while start < size:
            end = min(start + chunk, size) - 1
            with ydl.urlopen(Request(fmt["url"], headers=headers | {"Range": f"bytes={start}-{end}"})) as r:
                while data := r.read(READ_SIZE):
                    yield data
            start = end + 1


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
    except DownloadError as e:
        raise HTTPException(502, str(e)) from e


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
    filename = quote(f"{info.get('title') or info['id']}.{fmt['ext']}")
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    if fmt.get("filesize"):
        headers["Content-Length"] = str(fmt["filesize"])
    return StreamingResponse(read_chunks(fmt), media_type=mime_for(fmt).split(";")[0], headers=headers)


FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND.is_dir():  # local development only; the container image has no frontend
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
