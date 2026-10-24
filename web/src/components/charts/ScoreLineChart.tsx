import styles from './Charts.module.css';

export type ChartPoint = {
  percent: number;
  label: string;
};

const WIDTH = 320;
const HEIGHT = 140;
const LEFT = 30;
const RIGHT = 10;
const TOP = 10;
const BOTTOM = 10;
const GRID_PERCENTS = [0, 50, 100];
const POINT_RADIUS = 3.5;

export function ScoreLineChart({
  points,
  label,
}: {
  points: readonly ChartPoint[];
  label: string;
}) {
  if (points.length < 2) return null;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const xOf = (index: number) => LEFT + (index / (points.length - 1)) * plotWidth;
  const yOf = (percent: number) => TOP + ((100 - percent) / 100) * plotHeight;
  const description = `${label}: ${points.map((point) => `${point.percent}%`).join(', ')}`;

  return (
    <svg
      className={styles.lineChart}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={description}
    >
      {GRID_PERCENTS.map((percent) => (
        <g key={percent}>
          <line
            className={styles.gridLine}
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={yOf(percent)}
            y2={yOf(percent)}
          />
          <text className={styles.axisLabel} x={LEFT - 6} y={yOf(percent) + 4} textAnchor="end">
            {percent}
          </text>
        </g>
      ))}
      <polyline
        className={styles.line}
        points={points.map((point, index) => `${xOf(index)},${yOf(point.percent)}`).join(' ')}
      />
      {points.map((point, index) => (
        <circle
          key={`${point.label}-${index}`}
          className={styles.point}
          cx={xOf(index)}
          cy={yOf(point.percent)}
          r={POINT_RADIUS}
        >
          <title>{`${point.label}: ${point.percent}%`}</title>
        </circle>
      ))}
    </svg>
  );
}
