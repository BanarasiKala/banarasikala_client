// A product carries MANY varieties and materials now, so display code reads a list of names.
//
// The server sends `varieties` / `materials` as arrays of { id, name, slug }. An older cached
// API response (or a differently-shaped payload) may still carry the singular `Variety` /
// `Material` object, so that is read as a one-element fallback. Either way the caller gets a
// clean array of names, and `varietyLabel` / `materialLabel` join them for inline display.

const namesFrom = (list, singular) => {
  if (Array.isArray(list) && list.length) {
    return list.map((entry) => entry?.name).filter(Boolean);
  }
  return singular?.name ? [singular.name] : [];
};

export const varietyNames = (product = {}) => namesFrom(product.varieties, product.Variety);
export const materialNames = (product = {}) => namesFrom(product.materials, product.Material);

export const varietyLabel = (product = {}, separator = ", ") => varietyNames(product).join(separator);
export const materialLabel = (product = {}, separator = ", ") => materialNames(product).join(separator);
