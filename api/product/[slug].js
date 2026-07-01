import fs from "fs/promises";
import path from "path";

const clientDistPath = path.resolve(process.cwd(), "dist");
const clientIndexHtmlPath = path.join(clientDistPath, "index.html");

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const fetchProduct = async (slug, color) => {
  const baseApiUrl = process.env.VITE_API_URL || process.env.API_URL || "https://www.banarasikala.com";
  const apiUrl = `${baseApiUrl.replace(/\/+$/, "")}/api/products/${encodeURIComponent(slug)}/detail${color ? `?color=${encodeURIComponent(color)}` : ""}`;
  const response = await fetch(apiUrl);
  if (!response.ok) return null;
  return response.json();
};

const loadIndexHtml = async () => {
  try {
    return await fs.readFile(clientIndexHtmlPath, "utf8");
  } catch (error) {
    console.error("[product route] Could not read index.html", error);
    return null;
  }
};

const renderProductHtml = (template, product, pageUrl) => {
  const title = `${normalizeText(product.name)} | Banarasi Kala`;
  const description = normalizeText(product.short_description || product.description || "Shop authentic Banarasi sarees, handwoven silk, and premium accessories from Banarasi Kala.");
  const rawImage = product.images?.[0]?.url || product.image_url || "/logo_transparent_2.png";
  const origin = new URL(pageUrl).origin;
  const imageUrl = rawImage.startsWith("http") ? rawImage : `${origin}${rawImage.startsWith("/") ? rawImage : `/${rawImage}`}`;

  const metaTags = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="product" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${escapeHtml(title)}" />
    <meta property="twitter:description" content="${escapeHtml(description)}" />
    <meta property="twitter:image" content="${escapeHtml(imageUrl)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  `;

  return template.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>${metaTags}`);
};

export default async function handler(req, res) {
  const { slug, color } = req.query || {};
  const requestedColor = color || null;
  const protocol = req.headers["x-forwarded-proto"]?.split(",")[0] || "https";
  const host = req.headers.host;
  const pageUrl = `${protocol}://${host}${req.url}`;

  if (!slug) {
    res.statusCode = 400;
    return res.end("Missing product slug");
  }

  const product = await fetchProduct(slug, requestedColor);
  if (!product) {
    res.statusCode = 404;
    return res.end("Product not found");
  }

  const template = await loadIndexHtml();
  if (!template) {
    res.statusCode = 500;
    return res.end("Unable to load page template");
  }

  const html = renderProductHtml(template, product, pageUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.statusCode = 200;
  return res.end(html);
}
