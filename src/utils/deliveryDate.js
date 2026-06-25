const DEFAULT_PROCESSING_DAYS = 4;

// Site-wide fallback. Reads VITE_ORDER_PROCESSING_DAYS but never throws:
// if it is missing/invalid, the default (4) is used instead.
const envProcessingDays = () => {
  const value = Number(import.meta.env.VITE_ORDER_PROCESSING_DAYS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_PROCESSING_DAYS;
};

// Resolve the processing days for a product: per-product value when set,
// otherwise the env fallback, otherwise the default (4).
export const resolveProcessingDays = (productDays) => {
  if (productDays !== null && productDays !== undefined && productDays !== "") {
    const value = Number(productDays);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return envProcessingDays();
};

export const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
};

export const formatEstimatedDeliveryDate = (date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const getShiprocketEtaDate = (eta) => {
  if (!eta) return null;
  const numericDays = String(eta).match(/\d+/)?.[0];
  const parsedDate = new Date(eta);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  if (numericDays) return addDays(new Date(), Number(numericDays));
  return null;
};

export const getEstimatedDeliveryDate = (eta, processingDays) => {
  const shiprocketDate = getShiprocketEtaDate(eta);
  return addDays(shiprocketDate || new Date(), resolveProcessingDays(processingDays));
};
