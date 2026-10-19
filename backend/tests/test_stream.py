"""Faults are injected at the yt-dlp boundary; HTTP tests use real Uvicorn sockets."""
import asyncio
import http.client
import logging
import socket
import threading
import time
from contextlib import contextmanager

import anyio
import pytest
import uvicorn

import app as backend
from test_app import INFO, VIDEO_ID, Upstream


@pytest.fixture
def upstream(monkeypatch):
    responses, calls = [], []
    monkeypatch.setattr(backend, "extract", lambda _: INFO)

    def open_response(self, request):
        calls.append(request)
        result = responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(backend.YoutubeDL, "urlopen", open_response)
    return responses, calls


@pytest.mark.parametrize("status,headers,data", [
    (200, {}, b"ab"),
    (206, {}, b"ab"),
    (206, {"Content-Range": "bytes 1-2/5"}, b"ab"),
    (206, {"Content-Range": "bytes 0-1/6"}, b"ab"),
    (206, {"Content-Range": "bytes 0-1/5"}, b"a"),
    (206, {"Content-Range": "bytes 0-1/5"}, b"abc"),
    (206, {"Content-Range": "bytes 0-1/5", "Content-Length": "3"}, b"ab"),
    (403, {}, b"denied"), (416, {}, b"invalid"),
])
def test_range_faults_fail_without_retry(upstream, status, headers, data):
    responses, calls = upstream
    response = Upstream(data, status, headers)
    responses.append(response)
    with pytest.raises(backend.AudioStreamError, match="upstream audio stream failed"):
        b"".join(backend.read_chunks(INFO["formats"][2]))
    assert response.closed
    assert len(calls) == 1


@pytest.mark.parametrize("size,length,data,valid", [
    (None, None, b"abcde", True), (5, "5", b"abcde", True),
    (5, None, b"abc", False), (5, None, b"abcdef", False),
    (None, "5", b"abc", False), (None, "bad", b"abc", False),
    (None, "-1", b"abc", False),
])
def test_whole_response_lengths(upstream, size, length, data, valid):
    responses, _ = upstream
    response = Upstream(data, headers={} if length is None else {"Content-Length": length})
    responses.append(response)
    chunks = backend.read_chunks({"url": "secret", "filesize": size})
    if valid:
        assert b"".join(chunks) == data
    else:
        with pytest.raises(backend.AudioStreamError):
            b"".join(chunks)
    assert response.closed


@pytest.mark.parametrize("failure", [OSError("secret signed URL"), Upstream(fail=True)])
def test_before_first_byte_is_sanitized_502(upstream, failure):
    from fastapi.testclient import TestClient
    responses, calls = upstream
    responses.append(failure)
    with TestClient(backend.app) as client:
        response = client.get("/api/audio", params={"url": VIDEO_ID, "format": "140"})
    assert response.status_code == 502
    assert "secret" not in response.text
    assert len(calls) == 1
    if isinstance(failure, Upstream):
        assert failure.closed


def test_deadline_closes_handle(upstream, monkeypatch):
    responses, _ = upstream
    response = Upstream()
    responses.append(response)
    clock = iter([0, 0, 0, 900])
    monkeypatch.setattr(backend, "monotonic", lambda: next(clock))
    with pytest.raises(backend.AudioStreamError):
        list(backend.read_chunks({"url": "secret"}))
    assert response.closed


@contextmanager
def server():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    runner = uvicorn.Server(uvicorn.Config(backend.app, log_level="error", lifespan="off"))
    thread = threading.Thread(target=runner.run, kwargs={"sockets": [sock]})
    thread.start()
    try:
        deadline = time.monotonic() + 5
        while not runner.started:
            assert thread.is_alive() and time.monotonic() < deadline
            time.sleep(.01)
        yield port
    finally:
        runner.should_exit = True
        thread.join(5)
        sock.close()
        assert not thread.is_alive()


@pytest.mark.parametrize("known", [True, False])
@pytest.mark.parametrize("failure", [False, True])
def test_uvicorn_exact_or_broken_framing(upstream, monkeypatch, caplog, known, failure):
    responses, _ = upstream
    monkeypatch.setattr(backend, "READ_SIZE", 2)
    fmt = INFO["formats"][1] | {"filesize": 5 if known else None}
    monkeypatch.setattr(backend, "extract", lambda _: INFO | {"formats": [fmt]})

    class Broken(Upstream):
        def read(self, size):
            if self.tell() >= 4:
                raise OSError("secret signed URL and cookie")
            return super().read(size)

    response = Broken() if failure else Upstream()
    responses.append(response)
    with caplog.at_level(logging.ERROR), server() as port:
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        connection.request("GET", f"/api/audio?url={VIDEO_ID}&format=140")
        result = connection.getresponse()
        assert result.status == 200
        if failure:
            with pytest.raises(http.client.IncompleteRead) as error:
                result.read()
            assert b"abcde".startswith(error.value.partial)
        else:
            assert result.read() == b"abcde"
        connection.close()
    assert response.closed
    assert "secret signed URL" not in caplog.text


def test_disconnect_closes_upstream(upstream, monkeypatch):
    responses, _ = upstream
    monkeypatch.setattr(backend, "READ_SIZE", 2)
    response = Upstream(b"a" * 2_000_000)
    responses.append(response)
    fmt = {"url": "secret"}
    chunks = backend.read_chunks(fmt)
    first = next(chunks)

    async def run():
        sent = anyio.Event()

        async def receive():
            await sent.wait()
            return {"type": "http.disconnect"}

        async def send(message):
            if message["type"] == "http.response.body":
                sent.set()
                await anyio.sleep(0)

        await backend.AudioResponse(chunks, first)(
            {"type": "http", "asgi": {"spec_version": "2.0"}}, receive, send)

    asyncio.run(run())
    assert response.closed


def test_cancellation_during_blocking_read_waits_then_closes(upstream, monkeypatch):
    responses, _ = upstream
    monkeypatch.setattr(backend, "READ_SIZE", 2)
    entered, release = threading.Event(), threading.Event()

    class Blocking(Upstream):
        def read(self, size):
            if self.tell() == 4:
                entered.set()
                assert release.wait(2)
            return super().read(size)

    response = Blocking(b"abcdef")
    responses.append(response)
    chunks = backend.read_chunks({"url": "secret"})
    first = next(chunks)

    async def run():
        async def receive():
            await anyio.to_thread.run_sync(entered.wait)
            release.set()
            return {"type": "http.disconnect"}

        async def send(message):
            pass

        await backend.AudioResponse(chunks, first)(
            {"type": "http", "asgi": {"spec_version": "2.0"}}, receive, send)

    asyncio.run(run())
    assert entered.is_set() and response.closed


def test_uvicorn_client_disconnect_releases_handle(upstream, monkeypatch):
    responses, _ = upstream
    monkeypatch.setattr(backend, "READ_SIZE", 1024)
    response = Upstream(b"a" * 16_000_000)
    responses.append(response)
    fmt = INFO["formats"][1] | {"filesize": None}
    monkeypatch.setattr(backend, "extract", lambda _: INFO | {"formats": [fmt]})
    with server() as port:
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        connection.request("GET", f"/api/audio?url={VIDEO_ID}&format=140")
        result = connection.getresponse()
        assert result.read(1024) == b"a" * 1024
        result.close()
        connection.close()
        deadline = time.monotonic() + 3
        while not response.closed and time.monotonic() < deadline:
            time.sleep(.01)
        assert response.closed


@pytest.mark.parametrize("fault", [200, 403, 416, "short", "wrong-start"])
def test_later_range_failure_keeps_verified_prefix_and_stops(upstream, fault):
    responses, calls = upstream
    first = Upstream(b"ab", 206, {"Content-Range": "bytes 0-1/5"})
    second = Upstream(
        b"c" if fault == "short" else b"cd",
        fault if isinstance(fault, int) else 206,
        {"Content-Range": "bytes 0-1/5" if fault == "wrong-start" else "bytes 2-3/5"},
    )
    responses.extend([first, second])
    chunks = backend.read_chunks(INFO["formats"][2])
    assert next(chunks) == b"ab"
    with pytest.raises(backend.AudioStreamError):
        list(chunks)
    assert first.closed and second.closed
    assert [r.headers["Range"] for r in calls] == ["bytes=0-1", "bytes=2-3"]


def test_in_process_partial_failure_is_explicit(upstream):
    from fastapi.testclient import TestClient
    responses, _ = upstream
    responses.extend([
        Upstream(b"ab", 206, {"Content-Range": "bytes 0-1/5"}),
        Upstream(b"cd", 200),
    ])
    with TestClient(backend.app) as client, pytest.raises(backend.AudioStreamError):
        client.get("/api/audio", params={"url": VIDEO_ID, "format": "251"})
