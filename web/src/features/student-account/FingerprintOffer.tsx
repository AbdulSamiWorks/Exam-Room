import { useState } from 'react';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { Panel } from '../../components/Panel';
import {
  describeFingerprintError,
  readFingerprintChoice,
  saveFingerprintChoice,
  setUpFingerprint,
} from './fingerprint';
import { useFingerprintSupport } from './use-fingerprint-support';
import styles from './StudentHomePage.module.css';

export function FingerprintOffer() {
  const isSupported = useFingerprintSupport();
  const [choice, setChoice] = useState(readFingerprintChoice);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  if (!isSupported || choice) return null;

  async function setUp() {
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await setUpFingerprint();
      setChoice('ready');
    } catch (error) {
      setErrorMessage(describeFingerprintError(error));
    } finally {
      setIsBusy(false);
    }
  }

  function decline() {
    saveFingerprintChoice('declined');
    setChoice('declined');
  }

  return (
    <Panel title="Log in faster next time">
      <p className={styles.emptyMessage}>
        Use your fingerprint or face instead of typing the PIN on this phone. Your PIN keeps
        working.
      </p>
      {errorMessage && <FormError>{errorMessage}</FormError>}
      <div className={styles.offerActions}>
        <Button onClick={() => void setUp()} disabled={isBusy}>
          {isBusy ? 'Setting up…' : 'Use fingerprint'}
        </Button>
        <Button variant="secondary" onClick={decline} disabled={isBusy}>
          Not now
        </Button>
      </div>
    </Panel>
  );
}
