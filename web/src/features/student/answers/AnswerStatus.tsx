import { classNames } from '../../../lib/class-names';
import type { SendingState } from './outbox-store';
import styles from './AnswerStatus.module.css';

const LABELS: Record<SendingState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Not sent yet – your answers are safe on this phone',
  session_lost: 'Not sent – open the test again',
};

export function AnswerStatus({ sendingState }: { sendingState: SendingState }) {
  return (
    <p
      className={classNames(styles.status, sendingState !== 'saved' && styles[sendingState])}
      role="status"
    >
      {LABELS[sendingState]}
    </p>
  );
}
