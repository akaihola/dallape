import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVideo, YOUTUBE_AUDIO_FORMATS } from "../providers.js";

const ID = "dQw4w9WgXcQ";
const ok = { provider: "youtube", id: ID };

test("recognises every YouTube URL variant and bare ids", () => {
  for (const text of [
    ID,
    `  ${ID}\n`,
    `https://www.youtube.com/watch?v=${ID}&t=10`,
    `youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://m.youtube.com/shorts/${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/v/${ID}`,
  ]) assert.deepEqual(parseVideo(text), ok, text);
});

test("rejects non-YouTube input", () => {
  for (const text of ["", "garbage", "https://vimeo.com/123", `https://evil.example/watch?v=${ID}`,
    "https://www.youtube.com/watch?v=short", "http://169.254.169.254/"])
    assert.equal(parseVideo(text), null, text);
});

test("format table has unique ids and MSE mime strings", () => {
  const ids = YOUTUBE_AUDIO_FORMATS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of YOUTUBE_AUDIO_FORMATS) assert.match(f.mime, /^audio\/(mp4|webm); codecs="/);
});


test("malformed authority parity with backend fixtures", () => {
  for (const text of [
    `https://[youtube.com/watch?v=${ID}`,
    `https://youtube.com:bad/watch?v=${ID}`,
    `https://youtube.com:99999/watch?v=${ID}`,
    `https://user:password@youtube.com/watch?v=${ID}`,
    `https://youtube.com:123/watch?v=${ID}`,
    `ftp://youtube.com/watch?v=${ID}`,
    `https://youtube.com＠evil.example/watch?v=${ID}`,
  ]) assert.equal(parseVideo(text), null, text);
});
