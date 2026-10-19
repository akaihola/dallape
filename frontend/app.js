import { parseVideo, YOUTUBE_AUDIO_FORMATS } from "./providers.js";

// Inject browser dependencies so regression tests can control async boundaries.
export function startApp({ window, document, fetch, URL, Blob, setInterval, setTimeout, clearTimeout }) {
  const API = window.DALLAPE_API_BASE ?? "";
  const audio = document.getElementById("audio");
  const formatsEl = document.getElementById("formats");
  const errorEl = document.getElementById("video-error");
  const videos = new Map(); // video id -> { id, title, formats: null | Set(ids), loading, tracks: Map(format id -> track), wanted }
  let video = null; // state of the video in the player
  let player = null;
  let activeFormat = null;
  let submission = 0;
  let attachment = null;
  let apiReady = null;
  let playerLoading = null;
  let playerUsable = false;

  const api = (path, params) => fetch(`${API}${path}?${new URLSearchParams(params)}`);
  const columns = new Map(YOUTUBE_AUDIO_FORMATS.map((f) => [f.id, renderColumn(f)]));

  // --- player -----------------------------------------------------------------

  function loadPlayerAPI() {
    if (window.YT?.Player) return Promise.resolve();
    if (!apiReady) {
      apiReady = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        let pending = true;
        const timer = setTimeout(() => fail(), 15000);
        const fail = () => {
          if (!pending) return;
          pending = false;
          clearTimeout(timer);
          script.remove();
          window.onYouTubeIframeAPIReady = null;
          reject(new Error("YouTube player script did not load."));
        };
        window.onYouTubeIframeAPIReady = () => {
          if (!pending) return;
          pending = false;
          clearTimeout(timer);
          script.onerror = null;
          resolve();
        };
        script.onerror = fail;
        script.src = "https://www.youtube.com/iframe_api";
        document.head.append(script);
      }).catch((err) => { apiReady = null; throw err; });
    }
    return apiReady;
  }

  function preparePlayer() {
    if (playerUsable) return Promise.resolve(player);
    if (!playerLoading) {
      playerLoading = loadPlayerAPI().then(() => new Promise((resolve, reject) => {
        document.getElementById("player-wrap").hidden = false;
        const timer = setTimeout(() => fail(), 15000);
        let instance;
        try {
          instance = new window.YT.Player("player", {
            videoId: video.id, playerVars: { playsinline: 1 }, events: {
              onReady: () => {
                if (player !== instance) return;
                clearTimeout(timer);
                playerUsable = true;
                resolve(instance);
              },
              onError: () => fail(),
            },
          });
        } catch (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }
        player = instance;
        function fail() {
          if (player !== instance) return;
          clearTimeout(timer);
          stopAudio();
          playerUsable = false;
          player = null;
          playerLoading = null;
          instance.destroy();
          // YouTube replaces the mount element with its iframe and removes it on destroy.
          const mount = document.createElement("div");
          mount.id = "player";
          document.getElementById("player-wrap").replaceChildren(mount);
          errorEl.value = "YouTube player failed. Submit the video again to retry.";
          reject(new Error("YouTube player failed."));
        }
      })).catch((err) => { playerLoading = null; throw err; });
    }
    return playerLoading;
  }

  document.getElementById("video-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const parsed = parseVideo(document.getElementById("video-input").value);
    errorEl.value = parsed ? "" : "Not a recognised video URL or ID.";
    if (!parsed || (parsed.id === video?.id && playerUsable)) return;
    const request = ++submission;
    stopAudio();
    if (!videos.has(parsed.id)) videos.set(parsed.id, { id: parsed.id, title: null, formats: null, loading: null, tracks: new Map(), wanted: null });
    video = videos.get(parsed.id);
    video.wanted = null;
    formatsEl.hidden = document.getElementById("hint").hidden = true;
    try {
      const readyPlayer = await preparePlayer();
      if (request !== submission) return;
      readyPlayer.loadVideoById(video.id);
      document.getElementById("hint").hidden = formatsEl.hidden = false;
      render();
    } catch (err) {
      if (request === submission) errorEl.value = `${err.message} Submit the video again to retry.`;
    }
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
    const request = submission;
    v.wanted = fmt.id;
    errorEl.value = "";
    try {
      if (!v.formats) await (v.loading ??= loadFormats(v).finally(() => { v.loading = null; })); // first click only, shared by concurrent clicks
    } catch (err) {
      if (request === submission && v.wanted === fmt.id) errorEl.value = `Could not list audio formats: ${err.message}. Click a format to retry.`;
      return;
    }
    if (request !== submission || v.wanted !== fmt.id || !playerUsable) return;
    render();
    if (!v.formats.has(fmt.id)) return;
    if (!v.tracks.has(fmt.id)) fetchTrack(v, fmt);
    maybeSwitch(v);
  }

  // --- tracks ---------------------------------------------------------------

  async function fetchTrack(v, fmt) {
    const request = submission;
    const track = { fmt, chunks: [], received: 0, total: 0, done: false, append: null, finish: null, blobUrl: null };
    v.tracks.set(fmt.id, track);
    try {
      const res = await api("/api/audio", { url: v.id, format: fmt.id });
      if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
      if (v.tracks.get(fmt.id) !== track) { await res.body?.cancel(); return; }
      track.total = Number(res.headers.get("Content-Length")) || 0;
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (v.tracks.get(fmt.id) !== track) { await reader.cancel(); return; }
        if (done) break;
        track.chunks.push(value);
        track.received += value.length;
        track.append?.(value);
        if (request === submission) { render(); maybeSwitch(v); }
      }
      track.done = true;
      track.total = track.received;
      track.blobUrl = URL.createObjectURL(new Blob(track.chunks, { type: fmt.mime.split(";")[0] }));
      track.finish?.();
    } catch (err) {
      if (v.tracks.get(fmt.id) !== track) return;
      v.tracks.delete(fmt.id); // allow a retry on the next click
      if (attachment?.track === track) failAudio(attachment, err);
      else if (request === submission && v.wanted === fmt.id) errorEl.value = `Could not fetch ${fmt.codec} ${fmt.abr} kbps: ${err.message}. Click the format to retry.`;
    }
    if (request === submission) { render(); maybeSwitch(v); }
  }

  /** Switch the preview's sound to the wanted track once it covers the playback position. */
  function maybeSwitch(v) {
    if (v !== video || !playerUsable) return;
    const track = v.tracks.get(v.wanted);
    if (!track || activeFormat === v.wanted) return;
    const covered = track.done || (track.total && (track.received / track.total) * player.getDuration() > player.getCurrentTime() + 1);
    if (!covered || (!track.done && !window.MediaSource?.isTypeSupported(track.fmt.mime))) return;
    stopAudio();
    activeFormat = v.wanted;
    player.mute();
    attachTrack(track);
    syncAudio();
    render();
  }

  function failAudio(owner, err) {
    if (attachment !== owner) return;
    const { v, track } = owner;
    v.tracks.delete(track.fmt.id);
    stopAudio();
    errorEl.value = `Could not play ${track.fmt.codec} ${track.fmt.abr} kbps: ${err.message}. Click the format to retry.`;
    render();
  }

  function attachTrack(track) {
    const owner = attachment = { v: video, track, url: null };
    const current = () => attachment === owner;
    audio.onerror = () => failAudio(owner, new Error("Audio playback failed"));
    if (track.done) {
      audio.src = track.blobUrl;
      return;
    }
    try {
      const ms = new window.MediaSource();
      const queue = [...track.chunks];
      track.append = (chunk) => { if (current()) queue.push(chunk); };
      ms.addEventListener("sourceopen", () => {
        if (!current()) return;
        try {
          const sb = ms.addSourceBuffer(track.fmt.mime);
          const pump = () => {
            if (!current() || sb.updating || ms.readyState !== "open") return;
            try {
              if (queue.length) sb.appendBuffer(queue.shift());
              else if (track.done) ms.endOfStream();
            } catch (err) { failAudio(owner, err); }
          };
          sb.addEventListener("updateend", pump);
          sb.addEventListener("error", () => failAudio(owner, new Error("Audio decoding failed")));
          track.append = (chunk) => { if (current()) { queue.push(chunk); pump(); } };
          track.finish = pump;
          pump();
        } catch (err) { failAudio(owner, err); }
      }, { once: true });
      owner.url = URL.createObjectURL(ms);
      audio.src = owner.url;
    } catch (err) { failAudio(owner, err); }
  }

  function stopAudio() {
    if (attachment) {
      attachment.track.append = attachment.track.finish = null;
      if (attachment.url) URL.revokeObjectURL(attachment.url);
    }
    attachment = null;
    activeFormat = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    player?.unMute?.();
  }

  function syncAudio() {
    const owner = attachment;
    if (!owner || !playerUsable) return;
    try {
      const t = player.getCurrentTime();
      const playing = player.getPlayerState() === window.YT.PlayerState.PLAYING;
      if (Math.abs(audio.currentTime - t) > 0.3) audio.currentTime = t;
      if (playing && audio.paused) audio.play().catch((err) => failAudio(owner, err));
      if (!playing && !audio.paused) audio.pause();
    } catch (err) { failAudio(owner, err); }
  }

  // --- rendering -------------------------------------------------------------

  const fmtSize = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

  function render() {
    if (!video) return;
    const duration = playerUsable ? player.getDuration() : 0;
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
}

if (typeof document !== "undefined") startApp(globalThis);
