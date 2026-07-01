import fs from "fs/promises";
import path from "path";

const clientDistPath = path.resolve(process.cwd(), "dist");
const clientIndexHtmlPath = path.join(clientDistPath, "index.html");

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const stripHtml = (value) => normalizeText(String(value || "").replace(/<[^>]*>/g, ""));
const truncateText = (value, maxLength = 180) => {
  const text = stripHtml(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
};
const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const metaKeys = [
  "description",
  "og:title",
  "og:description",
  "og:image",
  "og:image:secure_url",
  "og:image:alt",
  "og:url",
  "og:type",
  "og:site_name",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
  "og:video",
  "og:video:secure_url",
  "og:video:type",
  "og:video:width",
  "og:video:height",
];

const removeExistingMeta = (html) => metaKeys.reduce(
  (current, key) => current.replace(
    new RegExp(`\\s*<meta\\s+(?:name|property)=["']${key}["'][^>]*>`, "gi"),
    "",
  ),
  html,
).replace(/\\s*<link\\s+rel=["']canonical["'][^>]*>/gi, "");

const toAbsoluteUrl = (url, pageUrl) => {
  try {
    return new URL(url || "/logo_transparent_2.png", new URL(pageUrl).origin).href;
  } catch {
    return url || "/logo_transparent_2.png";
  }
};

const buildReelPageUrl = (req) => {
  const protocol = req.headers["x-forwarded-proto"]?.split(",")[0] || "https";
  const host = req.headers["x-forwarded-host"]?.split(",")[0] || req.headers.host;
  return new URL(req.url || "/reels", `${protocol}://${host}`).href;
};

const fetchReel = async (reelId) => {
  const baseApiUrl = process.env.VITE_API_URL || process.env.API_URL || "https://www.banarasikala.com";
  const apiUrl = `${baseApiUrl.replace(/\/+$/, "")}/api/reels/${encodeURIComponent(reelId)}`;
  const response = await fetch(apiUrl);
  if (!response.ok) return null;
  return response.json();
};

const loadIndexHtml = async () => {
  try {
    return await fs.readFile(clientIndexHtmlPath, "utf8");
  } catch (error) {
    console.error("[reel route] Could not read index.html", error);
    return null;
  }
};

const renderReelHtml = (template, reel, pageUrl) => {
  const title = normalizeText(reel.title || "Banarasi Kala Reel");
  const description = truncateText(reel.description || reel.caption || "Watch this short reel from Banarasi Kala.");
  const imageUrl = toAbsoluteUrl(reel.thumbnail_url || reel.poster_url || reel.video_poster || "/logo_transparent_2.png", pageUrl);
  const videoUrl = toAbsoluteUrl(reel.video_url || reel.videoUrl || "", pageUrl);

  const metaTags = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="video.other" />
    <meta property="og:site_name" content="Banarasi Kala" />
    ${videoUrl ? `<meta property="og:video" content="${escapeHtml(videoUrl)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(videoUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />` : ""}
    <meta name="twitter:card" content="${videoUrl ? "player" : "summary_large_image"}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  `;

  const html = removeExistingMeta(template);
  if (/<title>.*?<\/title>/i.test(html)) {
    return html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>${metaTags}`);
  }
  return html.replace(/<\/head>/i, `<title>${escapeHtml(title)}</title>${metaTags}</head>`);
};

export default async function handler(req, res) {
  const { id: rawId, reel: rawReelId } = req.query || {};
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const reelId = Array.isArray(rawReelId) ? rawReelId[0] : rawReelId;
  const targetId = id || reelId;

  if (!targetId) {
    res.statusCode = 400;
    return res.end("Missing reel id");
  }

  const reel = await fetchReel(targetId);
  if (!reel) {
    res.statusCode = 404;
    return res.end("Reel not found");
  }

  const template = await loadIndexHtml();
  if (!template) {
    res.statusCode = 500;
    return res.end("Unable to load page template");
  }

  const pageUrl = buildReelPageUrl(req);
  const html = renderReelHtml(template, reel, pageUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.statusCode = 200;
  return res.end(html);
}
