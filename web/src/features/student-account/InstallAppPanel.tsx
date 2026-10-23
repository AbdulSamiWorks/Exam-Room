import { useState } from 'react';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { useInstallPrompt } from '../../lib/install-prompt';
import { currentPhonePlatform, isInstalledApp } from '../../lib/phone-platform';
import styles from './StudentHomePage.module.css';

const HIDDEN_STORAGE_KEY = 'exam-room:install-hidden';

function wasHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_STORAGE_KEY) === 'yes';
  } catch {
    return false;
  }
}

function rememberHidden(): void {
  try {
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, 'yes');
  } catch {
    return;
  }
}

export function InstallAppPanel() {
  const { canInstall, install } = useInstallPrompt();
  const [isHidden, setIsHidden] = useState(() => wasHidden() || isInstalledApp());
  const isIphone = currentPhonePlatform() === 'iphone';

  if (isHidden || (!canInstall && !isIphone)) return null;

  function hide() {
    rememberHidden();
    setIsHidden(true);
  }

  return (
    <Panel title="Put Exam Room on your home screen">
      {canInstall ? (
        <p className={styles.emptyMessage}>
          It opens like an app, without the browser bar, even when the internet is slow.
        </p>
      ) : (
        <ol className={styles.steps}>
          <li>
            Tap the <strong>Share</strong> button (the square with an arrow) at the bottom of
            Safari.
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
          <li>Open Exam Room from the new icon next time.</li>
        </ol>
      )}
      <div className={styles.offerActions}>
        {canInstall && <Button onClick={() => void install()}>Install app</Button>}
        <Button variant="secondary" onClick={hide}>
          {canInstall ? 'Not now' : 'Done'}
        </Button>
      </div>
    </Panel>
  );
}
