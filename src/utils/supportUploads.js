import api from "./api";
import compressImage from "./compressImage";

// Mirrors MAX_ATTACHMENTS in the server's SupportController — it truncates anything longer,
// so the UI must not let the customer believe a sixth photo was sent.
export const MAX_SUPPORT_IMAGES = 5;

// 10 MB. Checked before compression: a modern phone photo is 3–8 MB and compresses well
// under it, so anything past this is a video or a RAW file picked by mistake, and it is
// kinder to say so than to spend a minute uploading it.
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const uploadOne = async (file, signature) => {
  const form = new FormData();
  // 1400px is enough for support to see a weave defect or a torn edge on a full-screen
  // preview; the original off a phone camera is several times that and buys nothing here.
  form.append("file", await compressImage(file, 1400, 0.82));
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType || "image"}/upload`,
    { method: "POST", body: form },
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Photo upload failed.");
  }
  return { url: data.secure_url, public_id: data.public_id };
};

/**
 * Upload support photos and return [{ url, public_id }] for posting alongside a query or
 * a chat message.
 *
 * Goes browser -> Cloudinary directly, signed by /api/support/upload-signature, so the
 * image never passes through our server. The signature is fetched once per batch rather
 * than per file.
 *
 * @param {FileList|File[]} files
 * @returns {Promise<Array<{url: string, public_id: string}>>}
 */
export const uploadSupportImages = async (files = []) => {
  const selected = Array.from(files).slice(0, MAX_SUPPORT_IMAGES);
  if (!selected.length) return [];

  const oversized = selected.find((file) => file.size > MAX_SOURCE_BYTES);
  if (oversized) {
    throw new Error(`${oversized.name || "That photo"} is too large. Please pick one under 10 MB.`);
  }

  const notAnImage = selected.find((file) => !String(file.type || "").startsWith("image/"));
  if (notAnImage) {
    throw new Error("Only photos can be attached.");
  }

  const { data: signature } = await api.get("/api/support/upload-signature");

  const uploaded = [];
  for (const file of selected) {
    uploaded.push(await uploadOne(file, signature));
  }
  return uploaded;
};

export default uploadSupportImages;
