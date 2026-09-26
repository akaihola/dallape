// Page loads that the app doesn't answer within WAIT_MS (the container is
// asleep and starting) get a "Starting up…" page instead of a blank tab.
// Everything else passes through untouched; /api/* never reaches the Worker.

const WAIT_MS = 2500;

const LOADING = `<!doctype html>
<html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Starting up…</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #f7f5f1; color: #1c1b1a; font: 16px/1.4 system-ui, sans-serif; }
  h1 { font-size: 2rem; margin: 0 0 .25rem; }
  p { color: #6b6864; margin: 0; }
  b { color: #b3462a; font-weight: 600; }
</style>
<main>
  <h1>Starting up…</h1>
  <p>Dallapé was asleep and is waking up. This usually takes a few seconds.</p>
  <p><b id="t">0 s</b></p>
</main>
<script>
  const t0 = Date.now();
  setInterval(() => t.textContent = Math.round((Date.now() - t0) / 1000) + " s", 1000);
  (async () => {
    for (;;) {
      try { if ((await fetch("/api/health", {cache: "no-store"})).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    location.reload();
  })();
</script>
</html>`;

const loading = () => new Response(LOADING, {
  status: 503,
  headers: {"Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store", "Retry-After": "5"},
});

export default {
  async fetch(request, env, ctx) {
    const upstream = fetch(request, {redirect: "manual"});
    if (request.headers.get("Sec-Fetch-Mode") !== "navigate") return upstream;
    ctx.waitUntil(upstream.catch(() => {}));  // keep waking the container
    const late = new Promise(r => setTimeout(r, WAIT_MS, null));
    const response = await Promise.race([upstream, late]).catch(() => null);
    return response && response.status < 502 ? response : loading();
  },
};
