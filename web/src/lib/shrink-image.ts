export type ShrinkOptions = {
  maxSidePx: number;
  type: 'image/webp' | 'image/jpeg';
  quality: number;
};

const WHITE = '#ffffff';

export async function shrinkImage(file: Blob, options: ShrinkOptions): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, options.maxSidePx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare pictures.');
  context.fillStyle = WHITE;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be prepared.'))),
      options.type,
      options.quality,
    );
  });
}
