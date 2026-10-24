import type { ChapterSummary } from '@exam-room/shared';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Chip } from '../../../components/Chip';
import fieldStyles from '../../../components/FormField.module.css';
import { chapterLimits } from '../manage/manage-limits';
import { useCreateChapter } from '../manage/use-classes';
import { QuickAddForm } from './QuickAddForm';
import styles from './ChapterPicker.module.css';

type ChapterPickerProps = {
  subjectId: number;
  chapters: ChapterSummary[];
  selectedChapterIds: number[];
  manageLink: string;
  errorMessage?: string;
  onToggle: (chapterId: number) => void;
};

export function ChapterPicker({
  subjectId,
  chapters,
  selectedChapterIds,
  manageLink,
  errorMessage,
  onToggle,
}: ChapterPickerProps) {
  const location = useLocation();
  const createChapter = useCreateChapter(subjectId);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const hasChapters = chapters.length > 0;

  return (
    <fieldset className={fieldStyles.field}>
      <legend className={fieldStyles.label}>Chapters (optional)</legend>
      <p className={fieldStyles.hint}>
        {hasChapters
          ? 'Tap the chapters this test covers. Progress per chapter uses them.'
          : 'This subject has no chapters yet. Add the chapters this test covers.'}
      </p>
      {hasChapters && (
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
      )}
      {isAddingChapter ? (
        <QuickAddForm
          label="New chapter"
          placeholder="e.g. Chapter 1: Computer Systems"
          maxLength={chapterLimits.maxNameLength}
          addLabel="Add chapter"
          isAdding={createChapter.isPending}
          addError={createChapter.error}
          autoFocus
          onAdd={(name) =>
            createChapter.mutate(name, {
              onSuccess: ({ chapter }) => {
                onToggle(chapter.id);
                setIsAddingChapter(false);
              },
            })
          }
          onCancel={() => setIsAddingChapter(false)}
        />
      ) : (
        <div className={styles.links}>
          <button
            type="button"
            className={styles.addChapterLink}
            onClick={() => setIsAddingChapter(true)}
          >
            + Add a chapter
          </button>
          {hasChapters && (
            <Link
              to={manageLink}
              state={{ backTo: location.pathname }}
              className={styles.manageLink}
            >
              Rename or reorder in Manage
            </Link>
          )}
        </div>
      )}
      {errorMessage && <p className={fieldStyles.errorMessage}>{errorMessage}</p>}
    </fieldset>
  );
}
