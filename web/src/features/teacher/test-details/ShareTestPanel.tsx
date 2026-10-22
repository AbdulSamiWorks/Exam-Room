import type { TestSummary } from '@exam-room/shared';
import { Button, ExternalButtonLink } from '../../../components/Button';
import { Panel } from '../../../components/Panel';
import { useCopyToClipboard } from '../../../lib/use-copy-to-clipboard';
import { studentTestLink } from '../tests/describe-test';
import styles from './ShareTestPanel.module.css';

export function ShareTestPanel({ test }: { test: TestSummary }) {
  const { isCopied, copy } = useCopyToClipboard();
  const testLink = studentTestLink(test.code);
  const whatsAppMessage = `${test.title} (${test.subject.name})\nOpen the test: ${testLink}`;
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`;

  return (
    <Panel title="Share with students">
      <div className={styles.codeBlock}>
        <span className={styles.codeLabel}>Test code</span>
        <span className={styles.code}>{test.code}</span>
      </div>
      <p className={styles.link}>{testLink}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void copy(testLink)}>
          {isCopied ? 'Link copied' : 'Copy link'}
        </Button>
        <ExternalButtonLink href={whatsAppUrl}>Send on WhatsApp</ExternalButtonLink>
      </div>
    </Panel>
  );
}
