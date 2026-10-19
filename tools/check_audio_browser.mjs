// Optional integration check: Playwright and ffmpeg must be installed externally.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const directory = await mkdtemp(join(tmpdir(), "dallape-audio-"));
let browser, server;
try {
  for (const [ext, options] of [
    ["m4a", ["-c:a", "aac", "-movflags", "frag_keyframe+empty_moov"]],
    ["webm", ["-c:a", "libopus"]],
  ]) {
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      ...options, join(directory, "tone." + ext)]);
  }
  server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, "http://localhost").pathname;
      const files = { "/": "frontend/index.html", "/app.js": "frontend/app.js",
        "/providers.js": "frontend/providers.js", "/config.js": "frontend/config.js", "/style.css": "frontend/style.css" };
      if (!files[path]) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : "text/html");
      res.end(await readFile(files[path]));
    } catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  console.log("Chromium", browser.version());
  for (const mse of [true, false]) {
    for (const [id, ext, codec] of [["140", "m4a", "AAC"], ["251", "webm", "Opus"], ["140", "broken", "invalid AAC"]]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", err => errors.push(err.message));
      await page.addInitScript(({ mse }) => {
        if (!mse) window.MediaSource = undefined;
        window.YT = { PlayerState: { PLAYING: 1 }, Player: class {
          constructor(_id, options) {
            window.testPlayer = this;
            this.time = 0; this.muted = false;
            setTimeout(() => options.events.onReady(), 0);
          }
          loadVideoById() {}
          getDuration() { return 4; }
          getCurrentTime() { return this.time; }
          getPlayerState() { return 1; }
          getPlaybackRate() { return 1.5; }
          getVolume() { return 40; }
          isMuted() { return this.muted; }
          mute() { this.muted = true; }
          unMute() { this.muted = false; }
        } };
      }, { mse });
      await page.route("**/api/formats?**", route => route.fulfill({
        json: { title: "Fixture", formats: [{ format_id: id, ext: ext === "webm" ? "webm" : "m4a", acodec: ext === "webm" ? "opus" : "mp4a.40.2", abr: ext === "webm" ? 160 : 128, mime: ext === "webm" ? 'audio/webm; codecs="opus"' : 'audio/mp4; codecs="mp4a.40.2"' }] },
      }));
      const body = ext === "broken" ? Buffer.from("not audio") : await readFile(join(directory, "tone." + ext));
      let release;
      const transfer = new Promise(resolve => { release = resolve; });
      await page.route("**/api/audio?**", async route => { await transfer; return route.fulfill({
        contentType: ext === "webm" ? "audio/webm" : "audio/mp4", body,
      }); });
      await page.goto(origin);
      await page.getByLabel("YouTube URL or video ID", { exact: true }).fill("dQw4w9WgXcQ");
      await page.getByRole("button", { name: "Preview", exact: true }).press("Enter");
      await page.locator("#formats").waitFor({ state: "visible" });
      const button = page.locator(".pick").filter({ hasText: ext === "webm" ? "160 kbps" : "128 kbps" });
      await button.focus();
      await page.keyboard.press("Space");
      assert.equal(await button.getAttribute("aria-pressed"), "true");
      assert.equal(await button.getAttribute("aria-busy"), "true");
      assert.equal(await page.evaluate(() => testPlayer.muted), false);
      release();
      await page.waitForFunction(() => document.querySelector(".format.active") || document.querySelector("#video-error").value);
      const failure = await page.locator("#video-error").textContent();
      if (failure) {
        assert.ok(ext === "broken" || (mse && ext === "m4a"), failure);
        assert.match(await page.locator("#video-error").textContent(), /Could not play/);
        assert.equal(await page.evaluate(() => testPlayer.muted), false);
        await page.locator(".download:not([hidden])").waitFor();
        console.log(mse ? "MSE" : "Blob", codec, "original restored; download retained:", failure);
        if (ext !== "broken") {
          await button.press("Enter");
          await page.waitForFunction(() => !!document.querySelector(".format.active"));
          assert.equal(await button.getAttribute("aria-busy"), "false");
          console.log(codec, "completed Blob retry decoded and activated");
        }
      } else {
        assert.notEqual(ext, "broken");
        assert.equal(await button.getAttribute("aria-pressed"), "true");
        assert.equal(await button.getAttribute("aria-busy"), "false");
        assert.match(await button.ariaSnapshot(), /playing.*pressed/);
        const state = await page.evaluate(() => {
          const a = document.querySelector("audio");
          return { ready: a.readyState, buffered: a.buffered.length, rate: a.playbackRate, volume: a.volume, muted: testPlayer.muted };
        });
        assert.ok(state.ready >= 3 && state.buffered > 0 && state.muted);
        assert.equal(state.rate, 1.5); assert.equal(state.volume, 0.4);
        console.log(mse ? "MSE" : "Blob", codec, JSON.stringify(state), "keyboard/accessible state passed");
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
