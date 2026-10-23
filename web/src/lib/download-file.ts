const REVOKE_DELAY_MS = 1000;

export function downloadTextFile(fileName: string, text: string, mediaType: string): void {
  const objectUrl = URL.createObjectURL(new Blob([text], { type: mediaType }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_DELAY_MS);
}
