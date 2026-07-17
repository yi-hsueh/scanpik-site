// Cloudflare Pages Function — public share page for a product: /p/{uuid}
//
// Renders Open Graph / Twitter meta so LINE / iMessage / Messenger draw a
// thumbnail card, plus a minimal human-visible page with a download CTA.
// Users who have the app installed never reach this: iOS Universal Links open
// the app directly (see /.well-known/apple-app-site-association). This page is
// the fallback for people without the app, and the target crawlers fetch.

// Public client credentials — the anon key also ships inside the iOS app and
// the admin site. Access here is read-only via the get_shared_product RPC.
const SUPABASE_URL = "https://lmpqxjpvdpeuhwarcyyb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtcHF4anB2ZHBldWh3YXJjeXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MjkyNzMsImV4cCI6MjA5MzMwNTI3M30.R1t56Me34EGBn153IANqgjRq6RP_wGCeQuU6z_HlIfI";

// Call-to-action on the share page. Pre-launch it points at Threads to gather
// followers; at public beta / launch, swap both fields to the TestFlight or
// App Store link — this object is the ONLY place to change.
const CTA = {
  href: "https://testflight.apple.com/join/YtqSnfcX",
  label: "加入 Scanpik 公開測試",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestGet({ params }) {
  const id = params.id;
  if (!UUID_RE.test(id)) return notFound();

  const product = await fetchProduct(id);
  if (!product) return notFound();

  return new Response(renderPage(product), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Serve repeat hits (multiple crawlers, re-shares) from Cloudflare's edge
      // so they don't re-invoke this function, while keeping the landing page
      // reasonably fresh: 1 min in the browser, 5 min at the edge. (The OG card
      // inside a chat is frozen at share time by the platform's own cache, so
      // this TTL only governs the human-visible page, not the thumbnail.)
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}

async function fetchProduct(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_product`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_id: id }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function imageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

// Everything from the DB flows through here before hitting HTML. Product names
// are user-generated, so this is the XSS boundary — never interpolate raw.
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(p) {
  const img = imageUrl(p.image_url);
  const url = `https://share.scanpik.com/p/${p.id}`;
  const ratingText =
    Number(p.review_count) > 0
      ? `★ ${p.avg_rating}・${p.review_count} 則評論`
      : "尚無評論";
  const description = p.brand_name
    ? `${p.brand_name}・${ratingText}`
    : ratingText;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.name)}｜Scanpik</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Scanpik">
<meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ""}
<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${esc(p.name)}">
<meta name="twitter:description" content="${esc(description)}">
${img ? `<meta name="twitter:image" content="${esc(img)}">` : ""}
<style>
  :root {
    color-scheme: light dark;
    --brand-green: #00DF7E;
    --brand-coral: #FF9275;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", "PingFang TC", sans-serif;
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #f2f2f7; color: #1a1a1a; padding: 1.5rem;
  }
  .card {
    background: #fff; border-radius: 24px; padding: 1.5rem; max-width: 380px; width: 100%;
    box-shadow: 0 8px 30px rgba(0,0,0,0.08); text-align: center;
  }
  .wordmark {
    font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em;
    color: var(--brand-green); margin: 0 0 1.2rem;
  }
  .hero {
    width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 16px;
    background: #f2f2f7; margin-bottom: 1.2rem;
  }
  h1 { font-size: 1.4rem; margin: 0 0 0.3rem; line-height: 1.3; }
  .brand { color: #777; margin: 0 0 0.8rem; }
  .rating { color: var(--brand-coral); font-weight: 600; margin: 0 0 1.5rem; }
  .cta {
    display: block; background: var(--brand-green); color: #fff; text-decoration: none;
    padding: 0.95rem; border-radius: 16px; font-weight: 700;
  }
  .tagline { margin-top: 1.1rem; color: #999; font-size: 0.85rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a1a; color: #e5e5e5; }
    .card { background: #2c2c2e; box-shadow: none; }
    .hero { background: #3a3a3c; }
    .brand { color: #999; }
  }
</style>
</head>
<body>
  <main class="card">
    <p class="wordmark">Scanpik</p>
    ${img ? `<img class="hero" src="${esc(img)}" alt="${esc(p.name)}">` : ""}
    <h1>${esc(p.name)}</h1>
    ${p.brand_name ? `<p class="brand">${esc(p.brand_name)}</p>` : ""}
    <p class="rating">${esc(ratingText)}</p>
    <a class="cta" href="${esc(CTA.href)}">${esc(CTA.label)}</a>
    <p class="tagline">掃條碼、看評論、分享心得</p>
  </main>
</body>
</html>`;
}

function notFound() {
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>找不到商品｜Scanpik</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif;
    max-width: 420px; margin: 6rem auto; padding: 0 1.5rem; text-align: center;
    color: #1a1a1a; background: #f2f2f7;
  }
  a { color: #00DF7E; }
  @media (prefers-color-scheme: dark) { body { background: #1a1a1a; color: #e5e5e5; } }
</style>
</head>
<body>
  <h1>找不到這個商品</h1>
  <p>這個連結可能已失效，或商品已被移除。</p>
  <p><a href="/">回 Scanpik 首頁</a></p>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
