import { parseVideo, YOUTUBE_AUDIO_FORMATS } from "./providers.js";

// Inject browser dependencies so regression tests can control async boundaries.
export function startApp({ window, document, fetch, URL, Blob, setInterval, setTimeout, clearTimeout }) {
  const API = window.DALLAPE_API_BASE ?? "";
  const audio = document.getElementById("audio");
  const formatsEl = document.getElementById("formats");
  const errorEl = document.getElementById("video-error");
  const configured = window.DALLAPE_AUDIO_CACHE ?? {};
  const limit = (value, fallback) => Number.isSafeInteger(value) && value > 0 ? value : fallback;
  const maxVideos = configured.enabled === false ? Infinity : limit(configured.maxVideos, 3);
  const maxBytes = configured.enabled === false ? Infinity : limit(configured.maxBytes, 192 * 1048576);
  let clock = 0;
  const videos = new Map(); // video id -> { id, title, formats: null | Map(id -> metadata), loading, tracks: Map(format id -> track), wanted }
  let video = null; // state of the video in the player
  let player = null;
  let activeFormat = null;
  let submission = 0;
  let attachment = null;
  let apiReady = null;
  let playerLoading = null;
  let playerUsable = false;

  const api = (path, params, signal) => fetch(`${API}${path}?${new URLSearchParams(params)}`, { signal });
  const catalog = new Map(YOUTUBE_AUDIO_FORMATS.map(f => [f.id, { ...f, speculative: true }]));
  const columns = new Map([...catalog].map(([id, f]) => [id, renderColumn(f)]));
  const bitrate = fmt => fmt.abr > 0 ? `${fmt.speculative ? "Estimated " : ""}${fmt.abr} kbps` : "Unknown bitrate";
  const label = fmt => `${fmt.codec}, ${bitrate(fmt)}, ${fmt.ext ?? "Unknown container"}${fmt.language ? `, ${fmt.language}` : ""}${fmt.note ? `, ${fmt.note}` : ""}, ID ${fmt.id}`;

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
    if (video) {
      video.controller?.abort();
      video.loading = null;
      for (const track of video.tracks.values()) if (!track.done) retireTrack(video, track);
    }
    if (!videos.has(parsed.id)) videos.set(parsed.id, { id: parsed.id, title: null, formats: null, loading: null, tracks: new Map(), wanted: null });
    video = videos.get(parsed.id);
    video.wanted = null;
    videos.delete(video.id);
    videos.set(video.id, video);
    while (videos.size > maxVideos) {
      const oldest = videos.values().next().value;
      for (const track of oldest.tracks.values()) retireTrack(oldest, track);
      videos.delete(oldest.id);
    }
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
        <span class="codec"></span><span class="abr"></span><span class="ext"></span>
        <span class="variant"></span>
      </button>
      <span class="size"></span><span class="status"></span>
      <a class="download" hidden>Download</a>`;
    el.querySelector(".pick").addEventListener("click", () => pick(fmt));
    formatsEl.append(el);
    return el;
  }

  async function loadFormats(v) {
    const controller = v.controller = new AbortController();
    const res = await api("/api/formats", { url: v.id }, controller.signal);
    if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
    const data = await res.json();
    if (controller.signal.aborted) return;
    v.title = data.title;
    v.formats = new Map(data.formats.map(f => [f.format_id, {
      id: f.format_id, ext: f.ext, codec: f.acodec ?? "Unknown codec", abr: f.abr,
      mime: f.mime ?? "", size: f.filesize, estimatedSize: f.filesize_approx,
      language: f.language, note: f.format_note, channels: f.audio_channels, filename: f.filename,
    }]));
  }

  async function pick(fmt) {
    if (!video) return;
    const v = video;
    const request = submission;
    if (attachment?.track.fmt.id !== fmt.id) stopAudio();
    for (const track of v.tracks.values()) if (!track.done && track.fmt.id !== fmt.id) retireTrack(v, track);
    v.wanted = fmt.id;
    errorEl.value = "";
    render();
    try {
      if (!v.formats) await (v.loading ??= loadFormats(v).finally(() => { if (request === submission) v.loading = null; })); // first click only, shared by concurrent clicks
    } catch (err) {
      if (request === submission && v.wanted === fmt.id) {
        v.wanted = null;
        errorEl.value = `Could not list audio formats: ${err.message}. Click a format to retry.`;
        render();
      }
      return;
    }
    if (request !== submission || v.wanted !== fmt.id || !playerUsable) return;
    render();
    if (!v.formats.has(fmt.id)) {
      v.wanted = null;
      errorEl.value = v.formats.size ? "This format is unavailable for this video. Choose an available format." : "No supported audio-only HTTP/HTTPS formats are available for this video.";
      render(); return;
    }
    fmt = v.formats.get(fmt.id);
    if (!v.tracks.has(fmt.id)) fetchTrack(v, fmt);
    const track = v.tracks.get(fmt.id);
    if (track) track.used = ++clock;
    maybeSwitch(v);
  }

  // --- tracks ---------------------------------------------------------------

  function retireTrack(v, track) {
    if (attachment?.track === track) stopAudio();
    v.tracks.delete(track.fmt.id);
    track.controller.abort();
    track.reader?.cancel().catch(() => {});
    track.reader = null;
    track.append = track.finish = null;
    track.chunks.length = 0;
    if (track.blobUrl) URL.revokeObjectURL(track.blobUrl);
    track.blobUrl = null;
  }

  // Reserve three encoded copies: chunks, Blob construction and MediaSource input.
  // Decoder/transport allocations belong to the browser and are observed separately.
  function reserve(track, bytes) {
    const entries = [...videos.values()].flatMap(v => [...v.tracks.values()].map(t => [v, t]));
    let retained = entries.reduce((sum, [, t]) => sum + t.received * 3, bytes * 3);
    for (const [v, candidate] of entries.sort((a, b) => a[1].used - b[1].used)) {
      if (retained <= maxBytes) break;
      if (candidate === track || candidate === attachment?.track || (v === video && candidate.fmt.id === v.wanted)) continue;
      retained -= candidate.received * 3;
      retireTrack(v, candidate);
    }
    if (retained > maxBytes) throw new Error("Audio cache byte budget exceeded");
  }

  async function fetchTrack(v, fmt) {
    const request = submission;
    const track = { fmt, chunks: [], received: 0, total: 0, done: false, blobOnly: false, append: null, finish: null, blobUrl: null, controller: new AbortController(), reader: null, used: ++clock };
    v.tracks.set(fmt.id, track);
    try {
      const res = await api("/api/audio", { url: v.id, format: fmt.id }, track.controller.signal);
      if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
      if (v.tracks.get(fmt.id) !== track) { await res.body?.cancel(); return; }
      const length = res.headers.get("Content-Length");
      const expected = length === null ? null : Number(length);
      if (expected !== null && (!Number.isSafeInteger(expected) || expected < 0)) throw new Error("Invalid audio length");
      track.total = expected ?? 0;
      const reader = track.reader = res.body.getReader();
      try {
        for (;;) {
          let { value, done } = await reader.read();
          if (v.tracks.get(fmt.id) !== track) return;
          if (done) break;
          if (expected !== null && track.received + value.length > expected) throw new Error("Audio length mismatch");
          reserve(track, value.byteLength);
          if (value.buffer.byteLength !== value.byteLength) value = value.slice();
          track.chunks.push(value);
          track.received += value.length;
          track.append?.(value);
          if (v.tracks.get(fmt.id) !== track) return;
          if (request === submission) { render(); maybeSwitch(v); }
        }
        if (expected !== null && track.received !== expected) throw new Error("Audio length mismatch");
      } finally { await reader.cancel(); reader.releaseLock?.(); track.reader = null; }
      if (v.tracks.get(fmt.id) !== track) return;
      track.done = true;
      track.total = track.received;
      track.blobUrl = URL.createObjectURL(new Blob(track.chunks, { type: fmt.mime.split(";")[0] }));
      track.chunks.length = 0;
      track.finish?.();
    } catch (err) {
      if (v.tracks.get(fmt.id) !== track) return;
      retireTrack(v, track);
      // A detached transfer was promised as a download, so report its failure too.
      if (request === submission && (v.wanted === fmt.id || track.blobOnly)) {
        v.wanted = null;
        errorEl.value = `Could not fetch ${label(fmt)}: ${err.message}. Click the format to retry.`;
      }
    }
    if (request === submission) { render(); maybeSwitch(v); }
  }

  /** Attach early for decoding, but leave the original audible until playback succeeds. */
  function maybeSwitch(v) {
    if (v !== video || !playerUsable) return;
    const track = v.tracks.get(v.wanted);
    if (!track || attachment?.track === track) return;
    if (!track.done && (track.blobOnly || !window.MediaSource?.isTypeSupported(track.fmt.mime))) return;
    stopAudio();
    attachTrack(track);
    syncAudio();
    render();
  }

  /** Playback owns only its attachment: the transfer keeps going as a download,
   * and this attempt retries playback only from the completed Blob. */
  function failAudio(owner, err) {
    if (attachment !== owner) return;
    const { v, track } = owner;
    v.wanted = null;
    track.blobOnly = true;
    stopAudio();
    errorEl.value = `Could not play ${label(track.fmt)} in this browser: ${err.message}. ${track.done ? "Click the format to retry. The file remains available to download." : "Its download continues; click the format to retry from the complete file."}`;
    render();
  }

  function attachTrack(track) {
    const owner = attachment = { v: video, track, url: null, originalMuted: player.isMuted(), playPending: false };
    audio.muted = true;
    const current = () => attachment === owner;
    const update = () => { if (current()) { syncAudio(); render(); } };
    audio.oncanplay = audio.onprogress = audio.onseeked = audio.onwaiting = update;
    audio.onerror = () => failAudio(owner, new Error("Audio playback failed"));
    if (track.done) {
      audio.src = track.blobUrl;
      return;
    }
    try {
      const ms = new window.MediaSource();
      const queue = [...track.chunks];
      track.append = (chunk) => { if (current()) queue.push(chunk); };
      let sb, pump, bufferError;
      const open = () => {
        if (!current()) return;
        try {
          sb = ms.addSourceBuffer(track.fmt.mime);
          pump = () => {
            if (!current() || sb.updating || ms.readyState !== "open") return;
            try {
              if (queue.length) sb.appendBuffer(queue.shift());
              else if (track.done) ms.endOfStream();
            } catch (err) { failAudio(owner, err); }
          };
          sb.addEventListener("updateend", pump);
          bufferError = () => failAudio(owner, new Error("Audio decoding failed"));
          sb.addEventListener("error", bufferError);
          track.append = (chunk) => { if (current()) { queue.push(chunk); pump(); } };
          track.finish = pump;
          pump();
        } catch (err) { failAudio(owner, err); }
      };
      ms.addEventListener("sourceopen", open, { once: true });
      owner.cleanup = () => {
        queue.length = 0;
        ms.removeEventListener("sourceopen", open);
        if (sb) {
          sb.removeEventListener("updateend", pump);
          sb.removeEventListener("error", bufferError);
          if (ms.readyState === "open") {
            try { sb.abort(); } catch { /* Already detached. */ }
          }
          try { ms.removeSourceBuffer(sb); } catch { /* Already detached. */ }
        }
      };
      owner.url = URL.createObjectURL(ms);
      audio.src = owner.url;
    } catch (err) { failAudio(owner, err); }
  }

  function restoreOriginal(owner) {
    audio.muted = true;
    activeFormat = null;
    if (owner.originalMuted) player?.mute?.();
    else player?.unMute?.();
  }

  function stopAudio() {
    if (attachment) {
      restoreOriginal(attachment);
      attachment.cleanup?.();
      attachment.track.append = attachment.track.finish = null;
      if (attachment.url) URL.revokeObjectURL(attachment.url);
    }
    attachment = null;
    activeFormat = null;
    audio.onerror = audio.oncanplay = audio.onprogress = audio.onseeked = audio.onwaiting = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load?.();
  }

  function syncAudio() {
    const owner = attachment;
    if (!owner || !playerUsable) return;
    try {
      const t = player.getCurrentTime();
      const playing = player.getPlayerState() === window.YT.PlayerState.PLAYING;
      audio.playbackRate = player.getPlaybackRate();
      audio.volume = player.getVolume() / 100;
      if (Math.abs(audio.currentTime - t) > 0.3) {
        restoreOriginal(owner);
        audio.currentTime = t;
      }
      // Byte counts say nothing about decoded timestamps. Require a small runway
      // at the requested time, capped at the end of a completed file.
      const end = owner.track.done ? Math.min(t + 0.25 * audio.playbackRate, audio.duration) : t + 0.25 * audio.playbackRate;
      let covered = false;
      for (let i = 0; i < audio.buffered.length; i++) {
        if (audio.buffered.start(i) <= t && audio.buffered.end(i) >= end && end > t) covered = true;
      }
      if (!playing || audio.seeking || audio.readyState < 3 || !covered) {
        restoreOriginal(owner);
        audio.pause();
        return;
      }
      if (audio.paused) {
        restoreOriginal(owner);
        if (!owner.playPending) {
          owner.playPending = true;
          // Request audible playback so autoplay denial rejects visibly instead
          // of succeeding muted and being paused by the browser on unmute.
          audio.muted = owner.originalMuted;
          audio.play().then(() => {
            owner.playPending = false;
            if (attachment === owner) { syncAudio(); render(); }
          }, (err) => failAudio(owner, err));
        }
        return;
      }
      if (owner.playPending) return;
      player.mute();
      audio.muted = owner.originalMuted;
      activeFormat = owner.track.fmt.id;
    } catch (err) { failAudio(owner, err); }
  }

  // --- rendering -------------------------------------------------------------

  const fmtSize = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

  function render() {
    if (!video) return;
    const duration = playerUsable ? player.getDuration() : 0;
    const pos = duration ? player.getCurrentTime() / duration : 0;
    for (const [id, fmt] of video.formats ?? []) {
      if (!columns.has(id)) columns.set(id, renderColumn(fmt));
    }
    for (const [id, el] of columns) {
      if (!catalog.has(id) && !video.formats?.has(id)) { el.remove(); columns.delete(id); continue; }
      const track = video.tracks.get(id);
      el.classList.toggle("disabled", !!video.formats && !video.formats.has(id));
      el.classList.toggle("active", activeFormat === id);
      const fmt = video.formats?.get(id) ?? catalog.get(id);
      el.hidden = !fmt;
      if (!fmt) continue;
      el.querySelector(".codec").textContent = fmt.codec;
      el.querySelector(".abr").textContent = bitrate(fmt);
      el.querySelector(".ext").textContent = fmt.ext ?? "Unknown container";
      el.querySelector(".variant").textContent = `ID ${id}${fmt.language ? ` · ${fmt.language}` : ""}${fmt.note ? ` · ${fmt.note}` : ""}${fmt.channels ? ` · ${fmt.channels} channels` : ""}`;
      const unavailable = video.formats && !video.formats.has(id);
      const playback = !fmt.speculative && !audio.canPlayType?.(fmt.mime) ? "Browser playback support unknown or unavailable; download available after fetching" : "";
      const pick = el.querySelector(".pick");
      pick.setAttribute("aria-pressed", String(video.wanted === id));
      pick.setAttribute("aria-busy", String(video.wanted === id && activeFormat !== id));
      pick.setAttribute("aria-label", `${label(fmt)}, ${activeFormat === id ? "playing" : video.wanted === id ? "loading" : "select audio"}`);
      el.querySelector(".pick").disabled = !!video.formats && !video.formats.has(id);
      const fraction = track ? (track.done ? 1 : track.total ? track.received / track.total : 0) : 0;
      el.querySelector(".fill").style.strokeDashoffset = 100 - fraction * 100;
      el.querySelector(".pos").setAttribute("transform", `rotate(${pos * 360} 18 18)`);
      el.querySelector(".size").textContent = track?.done ? fmtSize(track.received) : track ? track.total ? `${Math.round(fraction * 100)} %` : "Downloading…" : unavailable ? "Unavailable for this video" : fmt.speculative ? "Availability unconfirmed" : fmt.size > 0 ? fmtSize(fmt.size) : fmt.estimatedSize > 0 ? `Estimated ${fmtSize(fmt.estimatedSize)}` : "Unknown size";
      el.querySelector(".status").textContent = unavailable ? "" : playback;
      if (video.wanted === id && activeFormat !== id) el.querySelector(".size").textContent += " · Loading audio";
      const a = el.querySelector(".download");
      a.hidden = !track?.done;
      if (!track?.done) a.removeAttribute("href");
      if (track?.done) { a.href = track.blobUrl; a.download = track.fmt.filename ?? `${video.title ?? video.id} ${bitrate(track.fmt)} [${id}].${track.fmt.ext ?? "bin"}`; }
    }
  }

  // Ownership diagnostics: no references to retained tracks or byte arrays escape.
  const cacheStats = () => {
    const tracks = [...videos.values()].flatMap(v => [...v.tracks.values()]);
    return {
      videos: videos.size, tracks: tracks.length,
      reservedBytes: tracks.reduce((sum, t) => sum + t.received * 3, 0),
      chunkBytes: tracks.reduce((sum, t) => sum + t.chunks.reduce((bytes, c) => bytes + c.byteLength, 0), 0),
    };
  };

  setInterval(() => { syncAudio(); if (video) { maybeSwitch(video); render(); } }, 250);
  return { cacheStats };
}

if (typeof document !== "undefined") startApp(globalThis);
