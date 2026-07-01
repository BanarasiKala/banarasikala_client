export const getProductImages = (product = {}) => {
  return [...(product.images || []), ...(product.productImages || [])]
    .map((image) => (typeof image === "string" ? { url: image } : image))
    .filter((image) => image?.url);
};

export const getProductCoverImage = (product = {}, fallback = "") => {
  const images = getProductImages(product);
  const cover = images.find((image) => image.is_cover) || images[0];
  return cover?.url || product.image_url || product.image || fallback;
};

export const getColorStock = (product = {}, colorId) => {
  return product.color_stocks?.[colorId] ?? product.color_stocks?.[String(colorId)] ?? product.stock_quantity ?? 0;
};

// Default colour for a product that has colour variants. Used when adding to the
// cart from a card where the visible image is a generic/cover image (color_id is
// null), so we never persist a cart/order line without a colour for a product
// that actually has colours. Returns null only for genuinely single-colour items.
export const getDefaultColorId = (product = {}) => {
  const images = getProductImages(product);
  const cover = images.find((image) => image.is_cover && image.color_id != null);
  if (cover?.color_id != null) return cover.color_id;
  const firstColorImage = images.find((image) => image.color_id != null);
  if (firstColorImage?.color_id != null) return firstColorImage.color_id;
  const colors = Array.isArray(product.colors) ? product.colors : [];
  if (colors.length && colors[0]?.id != null) return colors[0].id;
  return null;
};
