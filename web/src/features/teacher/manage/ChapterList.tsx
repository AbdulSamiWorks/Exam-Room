import type { ChapterSummary, ClassSubjectSummary } from '@exam-room/shared';
import { useState } from 'react';
import { FormError } from '../../../components/FormError';
import { countOf } from '../../../lib/text';
import { ChapterRow } from './ChapterRow';
import { chapterLimits } from './manage-limits';
import { chapterIdsAfterMove, type MoveDirection } from './manage-rules';
import { NameForm } from './NameForm';
import { useChapterOrder, useCreateChapter } from './use-classes';
import styles from './ChapterList.module.css';

export function ChapterList({ subject }: { subject: ClassSubjectSummary }) {
  const createChapter = useCreateChapter(subject.id);
  const chapterOrder = useChapterOrder(subject.id);
  const [editingChapterId, setEditingChapterId] = useState<number>();
  const chapters = subject.chapters;
  const canAddChapter = chapters.length < chapterLimits.maxChaptersPerSubject;

  function move(chapter: ChapterSummary, direction: MoveDirection) {
    chapterOrder.mutate(chapterIdsAfterMove(chapters, chapter.id, direction));
  }

  return (
    <section className={styles.chapters} aria-label={`Chapters of ${subject.name}`}>
      <h4 className={styles.heading}>Chapters</h4>
      {chapters.length === 0 && <p className={styles.note}>No chapters yet.</p>}
      {chapterOrder.error && <FormError>{chapterOrder.error.message}</FormError>}

      {chapters.length > 0 && (
        <ol className={styles.list}>
          {chapters.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              position={index + 1}
              canMoveUp={index > 0}
              canMoveDown={index < chapters.length - 1}
              isMoving={chapterOrder.isPending}
              isEditing={editingChapterId === chapter.id}
              onMove={(direction) => move(chapter, direction)}
              onEdit={() => setEditingChapterId(chapter.id)}
              onStopEditing={() => setEditingChapterId(undefined)}
            />
          ))}
        </ol>
      )}

      {canAddChapter ? (
        <NameForm
          label="Chapter name"
          placeholder="e.g. Motion"
          maxLength={chapterLimits.maxNameLength}
          submitLabel="Add chapter"
          busyLabel="Adding…"
          clearsAfterSubmit
          onSubmit={(name) => createChapter.mutateAsync(name)}
        />
      ) : (
        <p className={styles.note}>
          A subject can have at most {countOf(chapterLimits.maxChaptersPerSubject, 'chapter')}.
        </p>
      )}
    </section>
  );
}
