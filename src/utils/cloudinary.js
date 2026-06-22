export const imgUrl = (url, width) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  const transforms = width ? `w_${width}/f_auto,q_auto` : 'f_auto,q_auto';
  return url.replace('/upload/', `/upload/${transforms}/`);
};
