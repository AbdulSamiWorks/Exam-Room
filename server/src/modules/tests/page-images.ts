import sharp from 'sharp';
import { badRequest } from '../../lib/http-errors.js';

const MAX_PAGE_WIDTH_PX = 1600;
const MAX_PAPER_IMAGE_WIDTH_PX = 1000;
const MAX_INPUT_PIXELS = 50_000_000;
const WEBP_QUALITY = 82;
const PAPER_WHITE = '#ffffff';

export type PageImage = {
  data: Buffer;
  width: number;
  height: number;
};

export function normalizePageImages(images: Buffer[]): Promise<PageImage[]> {
  return normalizeImages(images, MAX_PAGE_WIDTH_PX);
}

export function normalizePaperImages(images: Buffer[]): Promise<PageImage[]> {
  return normalizeImages(images, MAX_PAPER_IMAGE_WIDTH_PX);
}

async function normalizeImages(images: Buffer[], maxWidth: number): Promise<PageImage[]> {
  const normalizedImages: PageImage[] = [];
  for (const image of images) {
    normalizedImages.push(await normalizeImage(image, maxWidth));
  }
  return normalizedImages;
}

async function normalizeImage(image: Buffer, maxWidth: number): Promise<PageImage> {
  try {
    const { data, info } = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({ width: maxWidth, withoutEnlargement: true })
      .flatten({ background: PAPER_WHITE })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw badRequest('One of the pictures is not a valid image.', 'invalid_page_image');
  }
}
