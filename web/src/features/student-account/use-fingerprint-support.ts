import { useEffect, useState } from 'react';
import { canUseFingerprint } from './fingerprint';

export function useFingerprintSupport(): boolean {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void canUseFingerprint().then((supported) => {
      if (isCurrent) setIsSupported(supported);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  return isSupported;
}
