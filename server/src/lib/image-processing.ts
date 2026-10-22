import sharp from 'sharp';

const SINGLE_THREAD = 1;

export function configureImageProcessingForSmallServers(): void {
  sharp.cache(false);
  sharp.concurrency(SINGLE_THREAD);
}
