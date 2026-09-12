// Video providers. YouTube is the only one so far and the fallback for bare ids.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const YOUTUBE_PATHS = ["/shorts/", "/embed/", "/live/", "/v/"];

// Known YouTube audio-only itags. yt-dlp no longer ships this table, so it is data here.
export const YOUTUBE_AUDIO_FORMATS = [
  { id: "599", ext: "m4a", codec: "HE-AAC", abr: 30, mime: 'audio/mp4; codecs="mp4a.40.5"' },
  { id: "139", ext: "m4a", codec: "HE-AAC", abr: 48, mime: 'audio/mp4; codecs="mp4a.40.5"' },
  { id: "140", ext: "m4a", codec: "AAC", abr: 128, mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { id: "141", ext: "m4a", codec: "AAC", abr: 256, mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { id: "256", ext: "m4a", codec: "AAC 5.1", abr: 192, mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { id: "258", ext: "m4a", codec: "AAC 5.1", abr: 384, mime: 'audio/mp4; codecs="mp4a.40.2"' },
  { id: "600", ext: "webm", codec: "Opus", abr: 35, mime: 'audio/webm; codecs="opus"' },
  { id: "249", ext: "webm", codec: "Opus", abr: 50, mime: 'audio/webm; codecs="opus"' },
  { id: "250", ext: "webm", codec: "Opus", abr: 70, mime: 'audio/webm; codecs="opus"' },
  { id: "251", ext: "webm", codec: "Opus", abr: 160, mime: 'audio/webm; codecs="opus"' },
];

/** Parse a video URL or id into {provider, id}, or null when nothing matches. */
export function parseVideo(text) {
  text = text.trim();
  if (YOUTUBE_ID.test(text)) return { provider: "youtube", id: text };
  let u;
  try {
    u = new URL(text.includes("://") ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(u.hostname)) return null;
  let id = "";
  if (u.hostname === "youtu.be") id = u.pathname.split("/")[1] ?? "";
  else if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
  else {
    const prefix = YOUTUBE_PATHS.find((p) => u.pathname.startsWith(p));
    if (prefix) id = u.pathname.slice(prefix.length).split("/")[0];
  }
  return YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
}
