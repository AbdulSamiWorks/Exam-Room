import type { ChapterSummary } from '@exam-room/shared';
import { Link } from 'react-router';
import { Chip } from '../../../components/Chip';
import fieldStyles from '../../../components/FormField.module.css';
import styles from './ChapterPicker.module.css';

type ChapterPickerProps = {
  chapters: ChapterSummary[];
  selectedChapterIds: number[];
  manageLink: string;
  errorMessage?: string;
  onToggle: (chapterId: number) => void;
};

export function ChapterPicker({
  chapters,
  selectedChapterIds,
  manageLink,
  errorMessage,
  onToggle,
}: ChapterPickerProps) {
  return (
    <fieldset className={fieldStyles.field}>
      <legend className={fieldStyles.label}>Chapters (optional)</legend>
      {chapters.length === 0 ? (
        <>
          <p className={fieldStyles.hint}>This subject has no chapters yet.</p>
          <Link to={manageLink} className={styles.manageLink}>
            Add chapters in Manage
          </Link>
        </>
      ) : (
        <>
          <p className={fieldStyles.hint}>
            Tap the chapters this test covers. Progress per chapter uses them.
          </p>
          <div className={styles.chips}>
            {chapters.map((chapter) => (
              <Chip
                key={chapter.id}
                label={chapter.name}
                isSelected={selectedChapterIds.includes(chapter.id)}
                onClick={() => onToggle(chapter.id)}
              />
            ))}
          </div>
        </>
      )}
      {errorMessage && <p className={fieldStyles.errorMessage}>{errorMessage}</p>}
    </fieldset>
  );
}
