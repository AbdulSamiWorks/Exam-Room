import { useId } from 'react';
import styles from './Watermark.module.css';

const TILE_WIDTH = 720;
const TILE_HEIGHT = 420;
const TEXT_ANGLE_DEGREES = -30;
const FONT_SIZE = 44;
const NOT_ID_CHARACTERS = /[^\w-]/g;

type WatermarkProps = {
  text: string;
  pageWidth: number;
  pageHeight: number;
};

export function Watermark({ text, pageWidth, pageHeight }: WatermarkProps) {
  const patternId = `watermark-${useId().replace(NOT_ID_CHARACTERS, '')}`;

  return (
    <svg
      className={styles.watermark}
      viewBox={`0 0 ${pageWidth} ${pageHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${TEXT_ANGLE_DEGREES})`}
        >
          <text x={0} y={TILE_HEIGHT / 3} className={styles.text} fontSize={FONT_SIZE}>
            {text}
          </text>
          <text
            x={TILE_WIDTH / 2}
            y={(TILE_HEIGHT * 5) / 6}
            className={styles.text}
            fontSize={FONT_SIZE}
          >
            {text}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
