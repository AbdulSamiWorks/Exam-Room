import { currentPhonePlatform, type PhonePlatform } from '../../../lib/phone-platform';
import styles from './JoinScreen.module.css';

const ANDROID_STEPS = [
  'Open Settings → Security (or Security and privacy) → More security settings → App pinning, and turn it on.',
  'Come back here and open the recent apps view (swipe up and hold, or tap the square button).',
  'Tap the icon at the top of this app, then tap Pin.',
  'After the test: swipe up and hold (or hold Back and the square button) to unpin.',
];

const IPHONE_STEPS = [
  'Open Settings → Accessibility → Guided Access, turn it on and set a passcode.',
  'Come back here and press the side button three times (the Home button on older iPhones), then tap Start.',
  'After the test: press the button three times again, enter the passcode and tap End.',
];

const STEPS_BY_PLATFORM: Record<PhonePlatform, Array<{ title: string; steps: string[] }>> = {
  android: [{ title: 'Android: App pinning', steps: ANDROID_STEPS }],
  iphone: [{ title: 'iPhone: Guided Access', steps: IPHONE_STEPS }],
  other: [
    { title: 'Android: App pinning', steps: ANDROID_STEPS },
    { title: 'iPhone: Guided Access', steps: IPHONE_STEPS },
  ],
};

export function PhoneLockSteps() {
  return (
    <details className={styles.lockSteps}>
      <summary>Lock your phone to this test (recommended)</summary>
      <p className={styles.note}>
        A website cannot stop other apps, so leaving still counts. Locking the phone stops accidents
        like opening a message by mistake.
      </p>
      {STEPS_BY_PLATFORM[currentPhonePlatform()].map(({ title, steps }) => (
        <section key={title} className={styles.lockPlatform}>
          <h3 className={styles.lockTitle}>{title}</h3>
          <ol className={styles.rules}>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </details>
  );
}
