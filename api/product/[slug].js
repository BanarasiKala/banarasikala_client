import fs from "fs/promises";
import path from "path";

const clientDistPath = path.resolve(process.cwd(), "dist");
const clientIndexHtmlPath = path.join(clientDistPath, "index.html");

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const stripHtml = (value) => normalizeText(String(value || "").replace(/<[^>]*>/g, " "));
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
  "product:price:amount",
  "product:price:currency",
];

const removeExistingMeta = (html) => metaKeys.reduce(
  (current, key) => current.replace(
    new RegExp(`\\s*<meta\\s+(?:name|property)=["']${key}["'][^>]*>`, "gi"),
    "",
  ),
  html,
).replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, "");

const getProductImages = (product = {}) => {
  return [...(product.images || []), ...(product.productImages || [])]
    .map((image) => (typeof image === "string" ? { url: image } : image))
    .filter((image) => image?.url)
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
};

const getProductShareImage = (product = {}) => {
  const images = getProductImages(product);
  return (images.find((image) => image.is_cover) || images[0])?.url
    || product.image_url
    || product.image
    || "/logo_transparent_2.png";
};

const toAbsoluteUrl = (url, pageUrl) => {
  try {
    return new URL(url || "/logo_transparent_2.png", new URL(pageUrl).origin).href;
  } catch {
    return url || "/logo_transparent_2.png";
  }
};

const buildProductPageUrl = (req, slug, color) => {
  const protocol = req.headers["x-forwarded-proto"]?.split(",")[0] || "https";
  const host = req.headers["x-forwarded-host"]?.split(",")[0] || req.headers.host;
  const url = new URL(`/product/${encodeURIComponent(slug)}`, `${protocol}://${host}`);
  if (color) url.searchParams.set("color", color);
  return url.href;
};

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
  const productName = normalizeText(product.name || "Banarasi Kala");
  const title = productName === "Banarasi Kala" ? productName : `${productName} | Banarasi Kala`;
  const description = truncateText(product.short_description || product.description || "Shop authentic Banarasi sarees, handwoven silk, and premium accessories from Banarasi Kala.");
  const imageUrl = toAbsoluteUrl(getProductShareImage(product), pageUrl);
  const price = Number(product.selling_price || product.price || 0);

  const metaTags = `
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(productName)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Banarasi Kala" />
    ${price > 0 ? `<meta property="product:price:amount" content="${escapeHtml(price.toFixed(2))}" />` : ""}
    ${price > 0 ? '<meta property="product:price:currency" content="INR" />' : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(productName)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
  `;

  const html = removeExistingMeta(template);
  if (/<title>.*?<\/title>/i.test(html)) {
    return html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>${metaTags}`);
  }
  return html.replace(/<\/head>/i, `<title>${escapeHtml(title)}</title>${metaTags}</head>`);
};

export default async function handler(req, res) {
  const { slug: rawSlug, color: rawColor } = req.query || {};
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const color = Array.isArray(rawColor) ? rawColor[0] : rawColor;
  const requestedColor = color || null;

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

  const pageUrl = buildProductPageUrl(req, slug, requestedColor);
  const html = renderProductHtml(template, product, pageUrl);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.statusCode = 200;
  return res.end(html);
}
