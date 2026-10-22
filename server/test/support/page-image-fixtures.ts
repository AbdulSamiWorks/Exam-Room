import sharp from 'sharp';

export function createBlankPageImage(width = 800, height = 1100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
}

export function isWebpImage(image: Uint8Array): boolean {
  const header = Buffer.from(image.subarray(0, 12)).toString('latin1');
  return header.startsWith('RIFF') && header.endsWith('WEBP');
}
