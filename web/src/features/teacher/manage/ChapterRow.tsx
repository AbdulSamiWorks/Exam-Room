import type { ChapterSummary } from '@exam-room/shared';
import { Button } from '../../../components/Button';
import { useConfirmation } from '../../../components/use-confirmation';
import { countOf } from '../../../lib/text';
import { chapterLimits } from './manage-limits';
import { describeChapterDeletion, type MoveDirection } from './manage-rules';
import { NameForm } from './NameForm';
import { useDeleteChapter, useRenameChapter } from './use-classes';
import styles from './ChapterList.module.css';

type ChapterRowProps = {
  chapter: ChapterSummary;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isMoving: boolean;
  isEditing: boolean;
  onMove: (direction: MoveDirection) => void;
  onEdit: () => void;
  onStopEditing: () => void;
};

export function ChapterRow({
  chapter,
  position,
  canMoveUp,
  canMoveDown,
  isMoving,
  isEditing,
  onMove,
  onEdit,
  onStopEditing,
}: ChapterRowProps) {
  const renameChapter = useRenameChapter(chapter.id);
  const deleteChapter = useDeleteChapter(chapter.id);
  const { askToConfirm, confirmationDialog } = useConfirmation();

  function confirmDelete() {
    askToConfirm({
      title: 'Delete chapter?',
      message: describeChapterDeletion(chapter),
      confirmLabel: 'Delete chapter',
      busyLabel: 'Deleting…',
      onConfirm: () => deleteChapter.mutateAsync(),
    });
  }

  if (isEditing) {
    return (
      <li className={styles.editingRow}>
        <NameForm
          label="Chapter name"
          initialName={chapter.name}
          maxLength={chapterLimits.maxNameLength}
          submitLabel="Save"
          busyLabel="Saving…"
          autoFocus
          onSubmit={async (name) => {
            await renameChapter.mutateAsync(name);
            onStopEditing();
          }}
          onCancel={onStopEditing}
        />
        <Button variant="secondary" size="small" onClick={confirmDelete}>
          Delete chapter
        </Button>
        {confirmationDialog}
      </li>
    );
  }

  return (
    <li className={styles.row}>
      <span className={styles.position}>{position}.</span>
      <span className={styles.chapterText}>
        <span className={styles.chapterName}>{chapter.name}</span>
        {chapter.testCount > 0 && (
          <span className={styles.note}>{countOf(chapter.testCount, 'test')}</span>
        )}
      </span>
      <span className={styles.rowActions}>
        <Button
          variant="secondary"
          size="small"
          aria-label={`Move ${chapter.name} up`}
          disabled={!canMoveUp || isMoving}
          onClick={() => onMove('up')}
        >
          ↑
        </Button>
        <Button
          variant="secondary"
          size="small"
          aria-label={`Move ${chapter.name} down`}
          disabled={!canMoveDown || isMoving}
          onClick={() => onMove('down')}
        >
          ↓
        </Button>
        <Button variant="secondary" size="small" onClick={onEdit}>
          Edit
        </Button>
      </span>
    </li>
  );
}
