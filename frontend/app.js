import { parseVideo, YOUTUBE_AUDIO_FORMATS } from "./providers.js";

const API = window.DALLAPE_API_BASE ?? "";
const audio = document.getElementById("audio");
const formatsEl = document.getElementById("formats");
const errorEl = document.getElementById("video-error");
const videos = new Map(); // video id -> { id, title, formats: null | Set(ids), loading, tracks: Map(format id -> track), wanted }
let video = null; // state of the video in the player
let player = null;
let activeFormat = null;

const api = (path, params) => fetch(`${API}${path}?${new URLSearchParams(params)}`);
const columns = new Map(YOUTUBE_AUDIO_FORMATS.map((f) => [f.id, renderColumn(f)]));

// --- player -----------------------------------------------------------------

const playerReady = new Promise((resolve) => {
  window.onYouTubeIframeAPIReady = resolve;
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.append(s);
});

async function showVideo(id) {
  await playerReady;
  document.getElementById("player-wrap").hidden = false;
  if (player) return player.loadVideoById(id);
  await new Promise((resolve) => {
    player = new YT.Player("player", { videoId: id, playerVars: { playsinline: 1 }, events: { onReady: resolve } });
  });
}

document.getElementById("video-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const parsed = parseVideo(document.getElementById("video-input").value);
  errorEl.value = parsed ? "" : "Not a recognised video URL or ID.";
  if (!parsed || parsed.id === video?.id) return;
  stopAudio();
  if (!videos.has(parsed.id)) videos.set(parsed.id, { id: parsed.id, title: null, formats: null, loading: null, tracks: new Map(), wanted: null });
  video = videos.get(parsed.id);
  await showVideo(video.id);
  document.getElementById("hint").hidden = formatsEl.hidden = false;
  render();
});

// --- formats ---------------------------------------------------------------

function renderColumn(fmt) {
  const el = document.createElement("div");
  el.className = "format";
  el.innerHTML = `
    <button class="pick" type="button">
      <svg class="ring" viewBox="0 0 36 36">
        <circle class="bg" cx="18" cy="18" r="15.915"/>
        <circle class="fill" cx="18" cy="18" r="15.915"/>
        <circle class="pos" cx="33.915" cy="18" r="2"/>
      </svg>
      <span class="codec">${fmt.codec}</span><span class="abr">${fmt.abr} kbps</span><span class="ext">${fmt.ext}</span>
    </button>
    <span class="size"></span>
    <a class="download" hidden>Download</a>`;
  el.querySelector(".pick").addEventListener("click", () => pick(fmt));
  formatsEl.append(el);
  return el;
}

async function loadFormats(v) {
  const res = await api("/api/formats", { url: v.id });
  if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
  const data = await res.json();
  v.title = data.title;
  v.formats = new Set(data.formats.map((f) => f.format_id));
}

async function pick(fmt) {
  if (!video) return;
  const v = video;
  errorEl.value = "";
  try {
    if (!v.formats) await (v.loading ??= loadFormats(v)); // first click only, shared by concurrent clicks
  } catch (err) {
    errorEl.value = `Could not list audio formats: ${err.message}`;
    return;
  }
  render();
  if (!v.formats.has(fmt.id)) return;
  v.wanted = fmt.id;
  if (!v.tracks.has(fmt.id)) fetchTrack(v, fmt);
  maybeSwitch(v);
}

// --- tracks ---------------------------------------------------------------

async function fetchTrack(v, fmt) {
  const track = { fmt, chunks: [], received: 0, total: 0, done: false, append: null, finish: null, blobUrl: null };
  v.tracks.set(fmt.id, track);
  try {
    const res = await api("/api/audio", { url: v.id, format: fmt.id });
    if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
    track.total = Number(res.headers.get("Content-Length")) || 0;
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      track.chunks.push(value);
      track.received += value.length;
      track.append?.(value);
      if (v === video) { render(); maybeSwitch(v); }
    }
    track.done = true;
    track.total = track.received;
    track.blobUrl = URL.createObjectURL(new Blob(track.chunks, { type: fmt.mime.split(";")[0] }));
    track.finish?.();
  } catch (err) {
    v.tracks.delete(fmt.id); // allow a retry on the next click
    if (v === video) errorEl.value = `Could not fetch ${fmt.codec} ${fmt.abr} kbps: ${err.message}`;
  }
  if (v === video) { render(); maybeSwitch(v); }
}

/** Switch the preview's sound to the wanted track once it covers the playback position. */
function maybeSwitch(v) {
  const track = v.tracks.get(v.wanted);
  if (!track || activeFormat === v.wanted) return;
  const covered = track.done || (track.total && (track.received / track.total) * player.getDuration() > player.getCurrentTime() + 1);
  if (!covered) return;
  activeFormat = v.wanted;
  player.mute();
  attachTrack(track);
  syncAudio();
  render();
}

function attachTrack(track) {
  if (track.done || !window.MediaSource?.isTypeSupported(track.fmt.mime)) {
    track.append = track.finish = null;
    if (track.done) audio.src = track.blobUrl;
    return; // no MSE: play the blob once the download has finished
  }
  const ms = new MediaSource();
  const queue = [...track.chunks];
  track.append = (chunk) => queue.push(chunk);
  ms.addEventListener("sourceopen", () => {
    const sb = ms.addSourceBuffer(track.fmt.mime);
    const pump = () => {
      if (sb.updating || ms.readyState !== "open") return;
      if (queue.length) {
        try { sb.appendBuffer(queue.shift()); } catch { queue.length = 0; track.append = null; track.finish = () => attachTrack(track); if (track.done) track.finish(); }
      } else if (track.done) ms.endOfStream();
    };
    sb.addEventListener("updateend", pump);
    track.append = (chunk) => { queue.push(chunk); pump(); };
    track.finish = pump;
    pump();
  }, { once: true });
  audio.src = URL.createObjectURL(ms);
}

function stopAudio() {
  activeFormat = null;
  audio.pause();
  audio.removeAttribute("src");
  player?.unMute?.();
}

function syncAudio() {
  if (!activeFormat || !player?.getCurrentTime) return;
  const t = player.getCurrentTime();
  const playing = player.getPlayerState() === YT.PlayerState.PLAYING;
  if (Math.abs(audio.currentTime - t) > 0.3) audio.currentTime = t;
  if (playing && audio.paused) audio.play().catch(() => {});
  if (!playing && !audio.paused) audio.pause();
}

// --- rendering -------------------------------------------------------------

const fmtSize = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

function render() {
  if (!video) return;
  const duration = player?.getDuration?.() || 0;
  const pos = duration ? player.getCurrentTime() / duration : 0;
  for (const [id, el] of columns) {
    const track = video.tracks.get(id);
    el.classList.toggle("disabled", !!video.formats && !video.formats.has(id));
    el.classList.toggle("active", activeFormat === id);
    el.querySelector(".pick").disabled = !!video.formats && !video.formats.has(id);
    const fraction = track ? (track.done ? 1 : track.total ? track.received / track.total : 0) : 0;
    el.querySelector(".fill").style.strokeDashoffset = 100 - fraction * 100;
    el.querySelector(".pos").setAttribute("transform", `rotate(${pos * 360} 18 18)`);
    el.querySelector(".size").textContent = track?.done ? fmtSize(track.received) : track ? `${Math.round(fraction * 100)} %` : "";
    const a = el.querySelector(".download");
    a.hidden = !track?.done;
    if (track?.done) { a.href = track.blobUrl; a.download = `${video.title ?? video.id} ${track.fmt.abr} kbps.${track.fmt.ext}`; }
  }
}

setInterval(() => { syncAudio(); if (video) { maybeSwitch(video); render(); } }, 250);
