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
