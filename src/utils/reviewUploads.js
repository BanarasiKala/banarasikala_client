import api from "./api";

export const MAX_REVIEW_IMAGES = 5;

const uploadToCloudinary = async (file, signatureData) => {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signatureData.apiKey);
  form.append("timestamp", String(signatureData.timestamp));
  form.append("signature", signatureData.signature);
  form.append("folder", signatureData.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType || "image"}/upload`,
    { method: "POST", body: form },
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Photo upload failed.");
  }
  return {
    url: data.secure_url,
    public_id: data.public_id,
  };
};

export const uploadReviewImages = async (files = []) => {
  const selectedFiles = Array.from(files).slice(0, MAX_REVIEW_IMAGES);
  if (!selectedFiles.length) return [];

  const { data: signatureData } = await api.get("/api/feedback/upload-signature");
  const uploadedImages = [];

  for (const file of selectedFiles) {
    uploadedImages.push(await uploadToCloudinary(file, signatureData));
  }

  return uploadedImages;
};
