type UiText = {
  brand: string;
  audience: string;
  tone: string;
  valueProps: string;
  brandColors: string;
  images: string;
  notFound: string;
  imageDisplayFailed: (count: number) => string;
  replace: string;
  upload: string;
  uploading: string;
  remove: string;
  noImage: string;
  noImagesFound: string;
  creativeConcept: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  save: string;
  saving: string;
  regenerate: string;
  regenerating: string;
  chooseImageFile: string;
  imageTooLarge: string;
  readFailed: string;
  unexpectedError: string;
  reloadLatest: string;
};

const EN: UiText = {
  brand: "Brand",
  audience: "Audience",
  tone: "Tone",
  valueProps: "Value props",
  brandColors: "Brand colors",
  images: "Images",
  notFound: "Not found",
  imageDisplayFailed: (count) =>
    `${count} image(s) couldn't be displayed (hotlink-protected by the source).`,
  replace: "Replace",
  upload: "Upload",
  uploading: "Uploading...",
  remove: "Remove",
  noImage: "No image",
  noImagesFound: "No images found",
  creativeConcept: "Creative concept",
  primaryText: "Primary text",
  headline: "Headline",
  description: "Description",
  cta: "CTA",
  save: "Save",
  saving: "Saving...",
  regenerate: "Regenerate",
  regenerating: "Regenerating...",
  chooseImageFile: "Please choose an image file.",
  imageTooLarge: "Image is too large (max ~1.5MB).",
  readFailed: "read failed",
  unexpectedError: "Unexpected error.",
  reloadLatest: " Reload to get the latest version.",
};

export function uiText(_language: string | null | undefined): UiText {
  return EN;
}
