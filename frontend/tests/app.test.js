import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { startApp } from "../app.js";
import { YOUTUBE_AUDIO_FORMATS } from "../providers.js";

const A = "dQw4w9WgXcQ", B = "abcdefghijk";
const [F, G] = YOUTUBE_AUDIO_FORMATS;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(setImmediate);
const metadata = () => ({ ok: true, json: async () => ({ title: "Video", formats: [F, G].map(f => ({ format_id: f.id, ext: f.ext, acodec: f.codec, abr: f.abr, mime: f.mime })) }) });

class Element {
  constructor() {
    this.children = []; this.listeners = {}; this.parts = new Map(); this.classes = new Set();
    this.style = {}; this.value = ""; this.hidden = true; this.src = "";
    this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
  }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  removeEventListener(name, callback) { if (this.listeners[name] === callback) delete this.listeners[name]; }
  emit(name, event = {}) { return this.listeners[name]?.(event); }
  append(el) { this.children.push(el); }
  replaceChildren(el) { this.children = [el]; }
  remove() { this.removed = true; }
  querySelector(name) {
    if (!this.parts.has(name)) this.parts.set(name, new Element());
    return this.parts.get(name);
  }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { this[name] = ""; }
}

function setup({ script = false, mse = false, cache } = {}) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const requests = [], players = [], sources = [], blobs = [], revoked = [], timers = new Map();
  let tick, serial = 0;
  const audio = get("audio");
  audio.currentTime = 0; audio.paused = true; audio.readyState = 0; audio.duration = 100;
  audio.buffered = { length: 0 };
  audio.pause = () => { audio.paused = true; };
  audio.play = () => { audio.paused = false; return Promise.resolve(); };
  class Player {
    constructor(id, options) { this.options = options; this.loads = []; this.muted = false; players.push(this); }
    loadVideoById(id) { this.loads.push(id); }
    getDuration() { return 100; }
    getCurrentTime() { return this.time ?? 0; }
    getPlaybackRate() { return this.rate ?? 1; }
    getVolume() { return this.volume ?? 100; }
    isMuted() { return this.muted; }
    getPlayerState() { return this.state ?? 1; }
    mute() { this.muted = true; }
    unMute() { this.muted = false; }
    destroy() { this.destroyed = true; }
    ready() { this.options.events.onReady(); }
    error() { this.options.events.onError(); }
  }
  class MediaSource extends Element {
    static isTypeSupported() { return true; }
    constructor() { super(); this.readyState = "open"; this.buffer = new Element(); sources.push(this); }
    addSourceBuffer(mime) { this.mime = mime; this.buffer.appendBuffer = () => {}; this.buffer.abort = () => { this.buffer.aborted = true; }; return this.buffer; }
    removeSourceBuffer(buffer) { assert.equal(buffer, this.buffer); this.buffer.removed = true; }
    endOfStream() { this.readyState = "ended"; }
  }
  const window = { DALLAPE_AUDIO_CACHE: cache };
  const installAPI = () => { window.YT = { Player, PlayerState: { PLAYING: 1 } }; };
  if (!script) installAPI();
  if (mse) window.MediaSource = MediaSource;
  const document = { getElementById: get, createElement: () => new Element(), head: new Element() };
  const app = startApp({ window, document, Blob, URL: { createObjectURL: value => { if (value instanceof Blob) blobs.push(value); return `blob:${++serial}`; }, revokeObjectURL(url) { revoked.push(url); } },
    fetch: (url, options) => { const result = deferred(); requests.push({ url, signal: options.signal, ...result }); return result.promise; },
    setInterval: callback => { tick = callback; },
    setTimeout: callback => { const id = ++serial; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const submit = id => { get("video-input").value = id; return get("video-form").emit("submit", { preventDefault() {} }); };
  const column = fmt => get("formats").children[YOUTUBE_AUDIO_FORMATS.indexOf(fmt)];
  const click = fmt => column(fmt).querySelector(".pick").emit("click");
  const preview = async (id = A) => { const pending = submit(id); await flush(); players.at(-1).ready(); await pending; };
  const stream = (request, length = "10") => {
    const reads = [];
    reads.cancelled = 0;
    request.resolve({ ok: true, headers: new Headers(length === null ? {} : { "Content-Length": length }),
      body: { cancel: async () => { reads.cancelled++; }, getReader: () => ({ read: () => { const next = deferred(); reads.push(next); return next.promise; }, cancel: async () => { reads.cancelled++; } }) } });
    return reads;
  };
  const loadTrack = async (fmt = F) => {
    const pending = click(fmt);
    if (requests.at(-1).url.includes("/formats")) requests.at(-1).resolve(metadata());
    await pending;
    const reads = stream(requests.at(-1)); await flush();
    reads[0].resolve({ value: new Uint8Array(5), done: false }); await flush();
    return reads;
  };
  const playable = async (start = 0, end = 100) => {
    audio.readyState = 3;
    audio.buffered = { length: 1, start: () => start, end: () => end };
    tick(); await flush();
  };
  return { app, revoked, blobs, playable, get, requests, players, sources, timers, audio, window, document, installAPI, submit, preview, click, column, stream, loadTrack, tick: () => tick() };
}

test("metadata failure clears the shared request and a later click retries", async () => {
  const h = setup(); await h.preview();
  const first = h.click(F), concurrent = h.click(G);
  assert.equal(h.requests.length, 1);
  h.requests[0].reject(new Error("offline")); await Promise.all([first, concurrent]);
  assert.match(h.get("video-error").value, /offline.*retry/);
  const retry = h.click(F), shared = h.click(G);
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve(metadata()); await Promise.all([retry, shared]);
  assert.equal(h.requests.length, 3);
  assert.match(h.requests[2].url, new RegExp(`format=${G.id}`));
});

test("a stale metadata body cannot select audio after navigation, including back to the same video", async () => {
  const h = setup(); await h.preview();
  const body = deferred(), pick = h.click(F);
  h.requests[0].resolve({ ok: true, json: () => body.promise }); await flush();
  await h.submit(B); await h.submit(A);
  body.resolve(await metadata().json()); await pick;
  assert.equal(h.requests.length, 1);
  assert.equal(h.players[0].muted, false);
  assert.equal(h.get("video-error").value, "");
});

test("stale metadata errors do not overwrite the new video's error output", async () => {
  const h = setup(); await h.preview(); const pick = h.click(F);
  await h.submit(B);
  h.requests[0].reject(new Error("old failure")); await pick;
  assert.equal(h.get("video-error").value, "");
});

test("rapid first submissions share player readiness and load only the latest video", async () => {
  const h = setup(); const first = h.submit(A); await flush();
  const latest = h.submit(B); await flush();
  assert.equal(h.players.length, 1);
  assert.deepEqual(h.players[0].loads, []);
  h.players[0].ready(); await Promise.all([first, latest]);
  assert.deepEqual(h.players[0].loads, [B]);
});

test("script failure and late callbacks allow same-video submission to retry", async () => {
  const h = setup({ script: true });
  const first = h.submit(A), oldReady = h.window.onYouTubeIframeAPIReady;
  h.document.head.children[0].onerror(); await first;
  assert.match(h.get("video-error").value, /script.*retry/);
  const retry = h.submit(A);
  oldReady(); await flush(); assert.equal(h.players.length, 0);
  h.installAPI(); h.window.onYouTubeIframeAPIReady(); await flush();
  h.players[0].ready(); await retry;
  assert.deepEqual(h.players[0].loads, [A]);
});

test("player timeout is visible, and callbacks from the destroyed player are ignored", async () => {
  const h = setup(); const first = h.submit(A); await flush();
  [...h.timers.values()][0](); await first;
  assert.match(h.get("video-error").value, /player failed.*retry/);
  const retry = h.submit(A); await flush();
  h.players[0].ready(); h.players[0].error();
  h.players[1].ready(); await retry;
  assert.deepEqual(h.players[1].loads, [A]);
  assert.equal(h.get("video-error").value, "");
  h.players[1].error();
  assert.match(h.get("video-error").value, /retry/);
  await h.preview(); assert.equal(h.players.length, 3);
});

test("a failed active stream restores original sound and the same format can be fetched again", async () => {
  const h = setup({ mse: true }); await h.preview();
  const reads = await h.loadTrack();
  await h.playable();
  assert.equal(h.players[0].muted, true);
  reads[1].reject(new Error("stream interrupted")); await flush();
  assert.equal(h.players[0].muted, false);
  assert.equal(h.column(F).classes.has("active"), false);
  assert.equal(h.audio.src, "");
  assert.match(h.get("video-error").value, /stream interrupted.*retry/);
  await h.click(F);
  assert.equal(h.requests.length, 3);
  const retryReads = h.stream(h.requests[2]); await flush();
  retryReads[0].resolve({ value: new Uint8Array(5), done: false }); await flush();
  await h.playable();
  assert.equal(h.players[0].muted, true);
});

test("stale stream responses and read failures do not affect the current video", async () => {
  const h = setup({ mse: true }); await h.preview();
  const reads = await h.loadTrack(); await h.submit(B);
  reads[1].reject(new Error("old stream")); await flush();
  assert.equal(h.get("video-error").value, "");
  assert.equal(h.players[0].muted, false);
  assert.equal(h.audio.src, "");
});

test("retired MediaSource, source-buffer, audio-error and play-rejection callbacks cannot replace current audio", async () => {
  const h = setup({ mse: true }); await h.preview();
  await h.loadTrack();
  const oldSource = h.sources[0]; oldSource.emit("sourceopen");
  const oldAudioError = h.audio.onerror, play = deferred();
  h.audio.paused = true; h.audio.play = () => play.promise; await h.playable(); h.tick();
  await h.submit(B);
  h.audio.play = () => { h.audio.paused = false; return Promise.resolve(); };
  await h.loadTrack();
  const src = h.audio.src;
  oldSource.emit("sourceopen"); oldSource.buffer.emit("updateend"); oldSource.buffer.emit("error"); oldAudioError();
  play.reject(new Error("old play")); await flush();
  assert.equal(h.audio.src, src);
  await h.playable();
  assert.equal(h.players[0].muted, true);
  assert.equal(h.get("video-error").value, "");
});

const failPlayback = async (h, failure) => {
  const ms = h.sources[0];
  if (failure === "create") ms.addSourceBuffer = () => { throw new Error("unsupported buffer"); };
  if (failure === "append") ms.addSourceBuffer = () => ({ appendBuffer() { throw new Error("append failed"); }, addEventListener() {}, removeEventListener() {} });
  if (["create", "append", "decode"].includes(failure)) ms.emit("sourceopen");
  if (failure === "decode") ms.buffer.emit("error");
  if (failure === "media") h.audio.onerror();
  if (failure === "play") { await h.playable(); h.audio.paused = true; h.audio.play = () => Promise.reject(new Error("blocked")); h.tick(); await flush(); }
};

test("early playback failures keep the original sound and finish the exact download for a Blob retry", async () => {
  const bytes = Uint8Array.from({ length: 10 }, (_, i) => i + 1);
  for (const length of ["10", null]) for (const failure of ["create", "append", "decode", "media", "play"]) for (const slowEnd of [false, true]) {
    const name = `${failure}, length ${length}, ${slowEnd ? "only EOF" : "bytes and EOF"} after failure`;
    const h = setup({ mse: true }); await h.preview();
    const pick = h.click(F); h.requests[0].resolve(metadata()); await pick;
    const reads = h.stream(h.requests[1], length); await flush();
    reads[0].resolve({ value: bytes.slice(0, 5), done: false }); await flush();
    if (slowEnd) { reads[1].resolve({ value: bytes.slice(5), done: false }); await flush(); }
    await failPlayback(h, failure);
    assert.equal(h.players[0].muted, false, name);
    assert.equal(h.audio.src, "", name);
    assert.equal(h.column(F).classes.has("active"), false, name);
    assert.match(h.get("video-error").value, /download continues.*retry/, name);
    assert.equal(h.requests[1].signal.aborted, false, name);
    assert.equal(h.app.cacheStats().tracks, 1, name);
    h.tick(); assert.equal(h.sources.length, 1, name);
    if (!slowEnd) { reads[1].resolve({ value: bytes.slice(5), done: false }); await flush(); }
    reads[2].resolve({ done: true }); await flush();
    const download = h.column(F).querySelector(".download");
    assert.equal(download.hidden, false, name);
    assert.deepEqual(new Uint8Array(await h.blobs[0].arrayBuffer()), bytes, name);
    assert.equal(h.players[0].muted, false, name);
    assert.equal(h.audio.src, "", name);
    h.audio.play = () => { h.audio.paused = false; return Promise.resolve(); };
    h.audio.readyState = 0;
    await h.click(F);
    assert.equal(h.audio.src, download.href, name);
    await h.playable(); assert.equal(h.players[0].muted, true, name);
    assert.equal(h.requests.length, 2, name);
    assert.equal(h.sources.length, 1, name);
    // A decoder rejecting the complete file still leaves it downloadable.
    h.audio.onerror();
    assert.equal(h.players[0].muted, false, name);
    assert.equal(download.hidden, false, name);
    assert.match(h.get("video-error").value, /retry.*remains available to download/, name);
  }
});

test("selecting a detached transfer again waits for its Blob instead of streaming", async () => {
  const h = setup({ mse: true }); await h.preview(); const reads = await h.loadTrack();
  h.audio.onerror();
  await h.click(F); h.tick();
  assert.equal(h.sources.length, 1);
  assert.equal(h.audio.src, "");
  assert.equal(h.requests.length, 2);
  assert.equal(h.players[0].muted, false);
  assert.match(h.column(F).querySelector(".size").textContent, /Loading audio/);
  reads[1].resolve({ value: new Uint8Array(5), done: false }); await flush();
  reads[2].resolve({ done: true }); await flush();
  assert.equal(h.audio.src, h.column(F).querySelector(".download").href);
  await h.playable(); assert.equal(h.players[0].muted, true);
});

test("a detached transfer still cancels on navigation, format change, integrity failure and budget overflow", async () => {
  for (const end of ["navigation", "format", "truncated", "oversized", "budget"]) {
    const h = setup({ mse: true, cache: { maxBytes: 15 } }); await h.preview();
    const reads = await h.loadTrack(), request = h.requests[1];
    h.audio.onerror();
    if (end === "navigation") await h.submit(B);
    if (end === "format") await h.click(G);
    if (end === "truncated") reads[1].resolve({ done: true });
    if (end === "oversized") reads[1].resolve({ value: new Uint8Array(6), done: false });
    if (end === "budget") reads[1].resolve({ value: new Uint8Array(1), done: false });
    await flush();
    assert.equal(request.signal.aborted, true, end);
    assert.ok(reads.cancelled > 0, end);
    assert.equal(h.column(F).querySelector(".download").hidden, true, end);
    assert.deepEqual(h.app.cacheStats().reservedBytes, 0, end);
    assert.equal(h.app.cacheStats().chunkBytes, 0, end);
    if (!["navigation", "format"].includes(end)) assert.match(h.get("video-error").value, /Could not fetch.*retry/, end);
    reads.at(-1).resolve({ done: true }); await flush();
    assert.equal(h.blobs.length, 0, end);
    assert.equal(h.players[0].muted, false, end);
  }
});

test("without MediaSource the original sound continues until the complete blob can attach", async () => {
  const h = setup(); await h.preview(); const reads = await h.loadTrack();
  assert.equal(h.players[0].muted, false);
  reads[1].resolve({ value: new Uint8Array(5), done: false }); await flush();
  reads[2].resolve({ done: true }); await flush();
  assert.equal(h.players[0].muted, false);
  await h.playable();
  assert.equal(h.players[0].muted, true);
  assert.match(h.audio.src, /^blob:/);
});

test("script timeout recovers and submissions before API readiness use the latest video", async () => {
  const h = setup({ script: true }); const first = h.submit(A);
  [...h.timers.values()][0](); await first;
  assert.match(h.get("video-error").value, /script.*retry/);
  const retry = h.submit(A), latest = h.submit(B);
  assert.equal(h.document.head.children.length, 2);
  h.installAPI(); h.window.onYouTubeIframeAPIReady(); await flush();
  assert.equal(h.players[0].options.videoId, B);
  h.players[0].ready(); await Promise.all([retry, latest]);
  assert.deepEqual(h.players[0].loads, [B]);
});

test("a throwing player constructor clears its timeout and permits retry", async () => {
  const h = setup(), RealPlayer = h.window.YT.Player;
  h.window.YT.Player = class { constructor() { throw new Error("constructor failed"); } };
  await h.submit(A);
  assert.equal(h.timers.size, 0);
  assert.match(h.get("video-error").value, /constructor failed.*retry/);
  h.window.YT.Player = RealPlayer;
  await h.preview(); assert.deepEqual(h.players[0].loads, [A]);
});

test("old audio response, chunks and completion cannot mute or attach to the new video", async () => {
  const h = setup({ mse: true }); await h.preview();
  const pending = h.click(F); h.requests[0].resolve(metadata()); await pending;
  await h.submit(B);
  const reads = h.stream(h.requests[1]); await flush();
  // A response arriving after cancellation is discarded without reading its body.
  assert.equal(reads.length, 0);
  assert.equal(reads.cancelled, 1);
  h.tick();
  assert.equal(h.players[0].muted, false);
  assert.equal(h.audio.src, "");
  assert.equal(h.column(F).classes.has("active"), false);
});


test("short and oversized audio never enable downloads and permit retry", async () => {
  for (const oversized of [false, true]) {
    const h = setup(); await h.preview(); const reads = await h.loadTrack();
    reads[1].resolve(oversized ? { value: new Uint8Array(6), done: false } : { done: true });
    await flush();
    assert.equal(h.column(F).querySelector(".download").hidden, true);
    assert.equal(h.players[0].muted, false);
    assert.match(h.get("video-error").value, /length mismatch.*retry/);
    assert.equal(h.requests.at(-1).signal.aborted, true);
    assert.equal(h.app.cacheStats().chunkBytes, 0);
    assert.equal(h.app.cacheStats().tracks, 0);
    await h.click(F);
    assert.equal(h.requests.length, 3);
  }
});

test("bytes and delayed sourceopen cannot activate audio before decode and play resolution", async () => {
  const h = setup({ mse: true }); await h.preview(); await h.loadTrack();
  assert.equal(h.players[0].muted, false);
  h.sources[0].emit("sourceopen");
  assert.equal(h.players[0].muted, false);
  const play = deferred();
  h.audio.play = () => { h.audio.paused = false; return play.promise; };
  await h.playable();
  assert.equal(h.players[0].muted, false);
  play.resolve(); await flush();
  assert.equal(h.players[0].muted, true);
});

test("unknown transfer length can stream using buffered timestamps alone", async () => {
  const h = setup({ mse: true }); await h.preview();
  const pending = h.click(F); h.requests[0].resolve(metadata()); await pending;
  const reads = h.stream(h.requests[1], null); await flush();
  reads[0].resolve({ value: new Uint8Array(5), done: false }); await flush();
  assert.equal(h.players[0].muted, false);
  assert.match(h.column(F).querySelector(".size").textContent, /Downloading/);
  await h.playable(0, 2);
  assert.equal(h.players[0].muted, true);
  assert.equal(h.column(F).querySelector(".download").hidden, true);
});

test("pause, resume, seeks outside buffered ranges, speed and volume preserve original sound", async () => {
  const h = setup({ mse: true }); await h.preview(); await h.loadTrack();
  const p = h.players[0]; p.rate = 2; p.volume = 35;
  await h.playable(0, 5);
  assert.equal(h.audio.playbackRate, 2); assert.equal(h.audio.volume, 0.35);
  p.state = 2; h.tick();
  assert.equal(h.audio.paused, true); assert.equal(p.muted, false);
  p.state = 1; h.tick(); await flush(); assert.equal(p.muted, true);
  p.time = 30; h.tick();
  assert.equal(p.muted, false); assert.equal(h.audio.currentTime, 30);
  await h.playable(30, 40); assert.equal(p.muted, true);
  p.time = 10; h.tick(); assert.equal(p.muted, false);
  await h.playable(10, 20); assert.equal(p.muted, true);
  h.audio.readyState = 2; h.audio.onwaiting(); assert.equal(p.muted, false);
});

test("a hidden page keeps active audio on its own clock while the player's time lags", async () => {
  const h = setup({ mse: true }); await h.preview(); await h.loadTrack();
  const p = h.players[0];
  await h.playable(0, 100); assert.equal(p.muted, true);
  h.document.hidden = true;
  for (const [audio, player] of [[1, 0.5], [2, 1.5], [3, 1.5], [5, 2]]) {
    h.audio.currentTime = audio; p.time = player; h.tick();
    assert.equal(h.audio.currentTime, audio); assert.equal(p.muted, true);
    assert.equal(h.column(F).classes.has("active"), true);
  }
  p.state = 2; h.tick();
  assert.equal(h.audio.paused, true); assert.equal(p.muted, false);
  p.state = 1; h.tick();
  assert.equal(h.audio.currentTime, 2);
  await h.playable(0, 100); assert.equal(p.muted, true);
  h.document.hidden = false;
  h.audio.currentTime = 4; p.time = 3; h.tick();
  assert.equal(h.audio.currentTime, 3);
});

test("selection during transfer retires delayed sourceopen and completed Blob waits for readiness", async () => {
  const h = setup({ mse: true }); await h.preview(); await h.loadTrack();
  const retired = h.sources[0];
  await h.click(G);
  retired.addSourceBuffer = () => { throw new Error("must not open"); };
  retired.emit("sourceopen");
  assert.equal(h.players[0].muted, false);
  const reads = h.stream(h.requests.at(-1)); await flush();
  reads[0].resolve({ value: new Uint8Array(10), done: false }); await flush();
  reads[1].resolve({ done: true }); await flush();
  await h.click(F); await h.click(G);
  assert.equal(h.players[0].muted, false);
  await h.playable(); assert.equal(h.players[0].muted, true);
  assert.equal(h.column(G).querySelector(".pick")["aria-pressed"], "true");
  assert.equal(h.column(G).querySelector(".pick")["aria-busy"], "false");
});

test("original mute is preserved, and failed completed media remains download-only", async () => {
  const h = setup(); await h.preview(); h.players[0].muted = true;
  const reads = await h.loadTrack();
  reads[1].resolve({ value: new Uint8Array(5), done: false }); await flush();
  reads[2].resolve({ done: true }); await flush();
  await h.playable(); assert.equal(h.audio.muted, true);
  h.audio.onerror();
  assert.equal(h.players[0].muted, true);
  assert.equal(h.column(F).querySelector(".download").hidden, false);
  assert.equal(h.column(F).querySelector(".pick")["aria-pressed"], "false");
  assert.match(h.get("video-error").value, /download/);
});

test("synchronous append failure is visible and restores the original", async () => {
  const h = setup({ mse: true }); await h.preview(); await h.loadTrack();
  const ms = h.sources[0];
  ms.addSourceBuffer = () => ({ appendBuffer() { throw new Error("append failed"); }, addEventListener() {}, removeEventListener() {} });
  ms.emit("sourceopen");
  assert.equal(h.players[0].muted, false);
  assert.match(h.get("video-error").value, /append failed/);
});

test("unsupported streaming MIME waits for a decoded complete Blob", async () => {
  const h = setup({ mse: true }); h.window.MediaSource.isTypeSupported = () => false;
  await h.preview(); const reads = await h.loadTrack();
  assert.equal(h.sources.length, 0); assert.equal(h.audio.src, "");
  reads[1].resolve({ value: new Uint8Array(5), done: false }); await flush();
  reads[2].resolve({ done: true }); await flush();
  assert.equal(h.players[0].muted, false);
  await h.playable(); assert.equal(h.players[0].muted, true);
});

test("pause while play is pending cannot activate from the late resolution", async () => {
  const h = setup({ mse: true }); await h.preview(); await h.loadTrack();
  const play = deferred();
  h.audio.play = () => { h.audio.paused = false; return play.promise; };
  await h.playable();
  h.players[0].state = 2; h.tick();
  play.resolve(); await flush();
  assert.equal(h.players[0].muted, false);
  assert.equal(h.column(F).classes.has("active"), false);
});

const captured = JSON.parse(await readFile(new URL("./fixtures/youtube-multilingual.json", import.meta.url)));
const response = data => ({ ok: true, json: async () => data });
const byId = (h, id) => h.get("formats").children.find(el => el.querySelector(".variant").textContent?.startsWith(`ID ${id} ·`) || el.querySelector(".variant").textContent === `ID ${id}`);
const complete = async (h, request) => {
  const reads = h.stream(request, null); await flush();
  reads[0].resolve({ value: new Uint8Array(5), done: false }); await flush();
  reads[1].resolve({ done: true }); await flush();
};

test("authoritative known-ID metadata drives labels, MSE, Blob MIME and download name", async () => {
  const h = setup({ mse: true }); await h.preview();
  const fmt = { format_id: F.id, ext: "webm", acodec: "opus", abr: 123.456, mime: 'audio/webm; codecs="opus"', filesize_approx: 1048576 };
  assert.equal(h.column(F).querySelector(".abr").textContent, "Estimated 30 kbps");
  const pick = h.click(F); h.requests[0].resolve(response({ title: "Changed", formats: [fmt] })); await pick;
  assert.equal(h.column(F).querySelector(".codec").textContent, "opus");
  assert.equal(h.column(F).querySelector(".abr").textContent, "123.456 kbps");
  assert.equal(h.column(F).querySelector(".ext").textContent, "webm");
  const reads = h.stream(h.requests[1], null); await flush();
  reads[0].resolve({ value: new Uint8Array(5), done: false }); await flush();
  h.sources[0].emit("sourceopen"); assert.equal(h.sources[0].mime, fmt.mime);
  reads[1].resolve({ done: true }); await flush();
  assert.equal(h.blobs[0].type, "audio/webm");
  assert.equal(h.column(F).querySelector(".download").download, `Changed 123.456 kbps [${F.id}].webm`);
});

test("captured variants render separately, select exact IDs and retain backend filenames", async () => {
  const h = setup(); await h.preview();
  const pick = h.click(F); h.requests[0].resolve(response(captured)); await pick;
  assert.equal(h.requests.length, 1); // speculative ID absent from captured response
  assert.match(h.column(F).querySelector(".size").textContent, /Unavailable/);
  for (const f of captured.formats) {
    const el = byId(h, f.format_id);
    assert.ok(el); assert.equal(el.hidden, false);
    assert.match(el.querySelector(".variant").textContent, new RegExp(`${f.language}.*${f.format_note.replace(/[()]/g, "\\$&")}`));
    await el.querySelector(".pick").emit("click");
    assert.equal(new URL(h.requests.at(-1).url, "http://local").searchParams.get("format"), f.format_id);
    await complete(h, h.requests.at(-1));
    assert.equal(el.querySelector(".download").download, f.filename);
    assert.equal(h.blobs.at(-1).type, f.mime.split(";")[0]);
  }
  const retiredColumn = byId(h, captured.formats[0].format_id);
  await h.submit(B);
  assert.equal(retiredColumn.removed, true);
  assert.equal(h.column(F).querySelector(".abr").textContent, "Estimated 30 kbps");
});

test("missing metadata stays unknown, estimates are labelled and remote text stays out of HTML", async () => {
  const h = setup(); await h.preview();
  const note = '<img src=x onerror="alert(1)">';
  const formats = [{ format_id: F.id, format_note: note }, { format_id: "new", ext: "webm", acodec: "opus", mime: 'audio/webm; codecs="opus"', filesize_approx: 1048576 }];
  const pick = h.click(F); h.requests[0].resolve(response({ formats })); await pick;
  assert.equal(h.column(F).querySelector(".abr").textContent, "Unknown bitrate");
  assert.equal(h.column(F).querySelector(".codec").textContent, "Unknown codec");
  assert.equal(h.column(F).querySelector(".ext").textContent, "Unknown container");
  assert.match(h.column(F).querySelector(".size").textContent, /Unknown size/);
  assert.equal(h.column(F).querySelector(".variant").textContent, `ID ${F.id} · ${note}`);
  assert.ok(!h.column(F).innerHTML.includes(note));
  assert.equal(byId(h, "new").querySelector(".size").textContent, "Estimated 1.0 MiB");
  await complete(h, h.requests[1]);
  assert.match(h.column(F).querySelector(".download").download, /Unknown bitrate.*\.bin$/);
});

test("no supported formats is distinct from browser playback limitations", async () => {
  const h = setup(); await h.preview();
  const pick = h.click(F); h.requests[0].resolve(response({ formats: [] })); await pick;
  assert.match(h.get("video-error").value, /No supported audio-only HTTP\/HTTPS formats/);
  assert.equal(h.requests.length, 1);
  assert.ok(h.column(F).querySelector(".pick").disabled);
  await h.submit(B);
  h.audio.canPlayType = () => "";
  const next = h.click(F); h.requests[1].resolve(metadata()); await next;
  assert.equal(h.column(F).querySelector(".pick").disabled, false);
  assert.match(h.column(F).querySelector(".status").textContent, /Browser playback.*download/);
  await complete(h, h.requests[2]);
  assert.equal(h.column(F).querySelector(".download").hidden, false);
  h.audio.onerror();
  assert.match(h.get("video-error").value, /in this browser/);
  assert.equal(h.column(F).querySelector(".download").hidden, false);
});

const cacheComplete = async (h, fmt = F) => {
  const reads = await h.loadTrack(fmt);
  reads[1].resolve({ value: new Uint8Array(5), done: false }); await flush();
  reads[2].resolve({ done: true }); await flush();
  return h.column(fmt).querySelector(".download").href;
};

test("video LRU bounds retention, keeps selected URLs valid and refetches evicted videos", async () => {
  const h = setup({ cache: { maxVideos: 2, maxBytes: 90 } }); await h.preview();
  const first = await cacheComplete(h);
  await h.submit(B); const second = await cacheComplete(h);
  await h.submit(A); await h.click(F); // A becomes most recently visited; no refetch.
  assert.equal(h.requests.length, 4);
  assert.equal(h.audio.src, first);
  assert.ok(!h.revoked.includes(first));
  await h.submit("zzzzzzzzzzz"); const third = await cacheComplete(h);
  assert.ok(h.revoked.includes(second));
  assert.ok(!h.revoked.includes(first));
  assert.ok(!h.revoked.includes(third));
  assert.deepEqual(h.app.cacheStats(), { videos: 2, tracks: 2, reservedBytes: 60, chunkBytes: 0 });
  await h.submit(B); await cacheComplete(h);
  assert.equal(h.requests.length, 8);
  assert.ok(h.revoked.includes(first));
});

test("byte pressure evicts completed tracks, clears links and protects current playback", async () => {
  const h = setup({ cache: { maxBytes: 30 } }); await h.preview();
  const first = await cacheComplete(h); await h.playable();
  assert.equal(h.audio.src, first);
  const second = await cacheComplete(h, G);
  assert.ok(h.revoked.includes(first));
  assert.ok(!h.revoked.includes(second));
  assert.equal(h.column(F).querySelector(".download").href, "");
  assert.equal(h.column(F).querySelector(".download").hidden, true);
  assert.equal(h.audio.src, second);
  assert.deepEqual(h.app.cacheStats(), { videos: 1, tracks: 1, reservedBytes: 30, chunkBytes: 0 });
  await h.click(F);
  assert.equal(h.requests.length, 4);
});

test("unknown-length oversize streams abort and release all ownership before retry", async () => {
  const h = setup({ mse: true, cache: { maxBytes: 15 } }); await h.preview();
  const pick = h.click(F); h.requests[0].resolve(metadata()); await pick;
  const request = h.requests[1], reads = h.stream(request, null); await flush();
  reads[0].resolve({ value: new Uint8Array(5), done: false }); await flush();
  const url = h.audio.src, source = h.sources[0]; source.emit("sourceopen");
  const late = source.buffer.listeners.updateend;
  await h.playable();
  reads[1].resolve({ value: new Uint8Array(1), done: false }); await flush();
  assert.equal(request.signal.aborted, true);
  assert.ok(reads.cancelled > 0);
  assert.ok(h.revoked.includes(url));
  assert.deepEqual(source.listeners, {});
  assert.deepEqual(source.buffer.listeners, {});
  assert.equal(source.buffer.aborted, true);
  assert.equal(source.buffer.removed, true);
  assert.equal(h.players[0].muted, false);
  assert.equal(h.audio.src, "");
  assert.match(h.get("video-error").value, /byte budget exceeded.*retry/);
  assert.deepEqual(h.app.cacheStats(), { videos: 1, tracks: 0, reservedBytes: 0, chunkBytes: 0 });
  late();
  await h.click(F); assert.equal(h.requests.length, 3);
});

test("navigation cancels metadata and streams; late EOF cannot create a Blob", async () => {
  const h = setup({ mse: true }); await h.preview();
  const pick = h.click(F), metadataRequest = h.requests[0];
  await h.submit(B);
  assert.equal(metadataRequest.signal.aborted, true);
  metadataRequest.resolve(metadata()); await pick;
  assert.equal(h.requests.length, 1);
  const reads = await h.loadTrack(), request = h.requests.at(-1), url = h.audio.src;
  await h.submit(A);
  assert.equal(request.signal.aborted, true);
  assert.ok(reads.cancelled > 0);
  assert.ok(h.revoked.includes(url));
  reads[1].resolve({ done: true }); await flush();
  assert.equal(h.blobs.length, 0);
  assert.equal(h.app.cacheStats().reservedBytes, 0);
});

test("success frees redundant chunks; playback error preserves download until retirement", async () => {
  const h = setup({ mse: true, cache: { maxVideos: 1 } }); await h.preview();
  const blob = await cacheComplete(h), source = h.sources[0], mseUrl = h.audio.src;
  assert.equal(h.app.cacheStats().chunkBytes, 0);
  source.emit("sourceopen");
  source.buffer.emit("updateend"); source.buffer.emit("updateend");
  assert.equal(source.readyState, "ended");
  h.audio.onerror();
  assert.equal(source.buffer.removed, true);
  assert.ok(h.revoked.includes(mseUrl));
  assert.ok(!h.revoked.includes(blob));
  assert.deepEqual(source.listeners, {});
  await h.click(F);
  assert.equal(h.audio.src, blob);
  assert.equal(h.requests.length, 2);
  await h.submit(B);
  assert.ok(h.revoked.includes(blob));
  assert.equal(h.app.cacheStats().tracks, 0);
});

test("budget rollback keeps completed files while still cleaning aborted transfers", async () => {
  const h = setup({ cache: { enabled: false, maxVideos: 1, maxBytes: 1 } }); await h.preview();
  const first = await cacheComplete(h);
  await h.submit(B); await cacheComplete(h);
  assert.equal(h.app.cacheStats().videos, 2);
  assert.equal(h.app.cacheStats().tracks, 2);
  assert.ok(!h.revoked.includes(first));
  const reads = await h.loadTrack(G), request = h.requests.at(-1);
  await h.submit(A);
  assert.equal(request.signal.aborted, true);
  assert.ok(reads.cancelled > 0);
  assert.equal(h.app.cacheStats().chunkBytes, 0);
});
