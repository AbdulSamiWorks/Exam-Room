import sharp from 'sharp';
import { badRequest } from '../../lib/http-errors.js';

const MAX_PAGE_WIDTH_PX = 1600;
const MAX_INPUT_PIXELS = 50_000_000;
const WEBP_QUALITY = 82;
const PAPER_WHITE = '#ffffff';

export type PageImage = {
  data: Buffer;
  width: number;
  height: number;
};

export async function normalizePageImages(images: Buffer[]): Promise<PageImage[]> {
  const pageImages: PageImage[] = [];
  for (const image of images) {
    pageImages.push(await normalizePageImage(image));
  }
  return pageImages;
}

async function normalizePageImage(image: Buffer): Promise<PageImage> {
  try {
    const { data, info } = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({ width: MAX_PAGE_WIDTH_PX, withoutEnlargement: true })
      .flatten({ background: PAPER_WHITE })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw badRequest('One of the pages is not a valid image.', 'invalid_page_image');
  }
}
