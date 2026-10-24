import type { MarkingResponse, ReleaseOptions } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { describeDateTime } from '../../../lib/describe-date-time';
import { unmarkedStudentCount } from './marking-summary';
import { useRelease } from './use-marking';
import styles from './MarkingPage.module.css';

const OPTION_LABELS: Record<keyof ReleaseOptions, string> = {
  showCorrectAnswers: 'Show the correct MCQ answers and the model answers',
  showComments: 'Show my comments',
  showTopScorer: 'Show the top scorer',
};

export function ReleasePanel({ testId, marking }: { testId: number; marking: MarkingResponse }) {
  const release = useRelease(testId);
  const [options, setOptions] = useState(marking.releaseOptions);
  const unmarked = unmarkedStudentCount(marking.attempts);
  const isReleased = marking.releasedAt !== null;

  return (
    <Panel title="Results for students">
      <p className={styles.note}>
        {isReleased
          ? `Released ${describeDateTime(marking.releasedAt)}. Students see their marks now.`
          : 'Students see nothing until you release the results.'}
      </p>
      {unmarked > 0 && (
        <p className={styles.warning}>
          {unmarked === 1 ? '1 student has' : `${unmarked} students have`} written answers that are
          not marked yet.
        </p>
      )}
      <div className={styles.options}>
        {(Object.keys(OPTION_LABELS) as Array<keyof ReleaseOptions>).map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="checkbox"
              checked={options[option]}
              onChange={(event) =>
                setOptions((current) => ({ ...current, [option]: event.target.checked }))
              }
            />
            {OPTION_LABELS[option]}
          </label>
        ))}
      </div>
      {release.error && <FormError>{release.error.message}</FormError>}
      <div className={styles.releaseActions}>
        <Button onClick={() => release.mutate(options)} disabled={release.isPending}>
          {isReleased ? 'Save what students see' : 'Release results'}
        </Button>
        {isReleased && (
          <Button
            variant="secondary"
            onClick={() => release.mutate(null)}
            disabled={release.isPending}
          >
            Hide results
          </Button>
        )}
      </div>
    </Panel>
  );
}
