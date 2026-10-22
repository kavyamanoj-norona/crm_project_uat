/** Shown (browser and server) when a form that needs a photo is submitted without one. */
export const PHOTO_REQUIRED_MESSAGE = "Attach at least one image: upload one or take a photo";

/** True when the form has at least one real file under `field` (an empty file input posts a zero-byte file). */
export function hasPhotos(formData: FormData, field = "photos") {
  return formData.getAll(field).some((f) => f instanceof File && f.size > 0);
}
