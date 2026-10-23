const MAX_PICTURE_WIDTH_PX = 1000;
const PICTURE_TYPE = 'image/webp';
const PICTURE_QUALITY = 0.8;

export async function shrinkPicture(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PICTURE_WIDTH_PX / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare pictures.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be prepared.'))),
      PICTURE_TYPE,
      PICTURE_QUALITY,
    );
  });
}
