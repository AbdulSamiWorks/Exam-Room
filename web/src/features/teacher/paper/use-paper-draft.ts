import { useMemo, useState } from 'react';
import { importPaper } from './import-paper';
import type { ImportedPaper } from './imported-paper';
import { withPictureNumbers, type PaperUpload } from './paper-upload';

export type PaperDraft = {
  text: string;
  imported: ImportedPaper | undefined;
  pictures: ReadonlyMap<string, Blob>;
  isReady: boolean;
  changeText: (text: string) => void;
  setPicture: (questionId: string, picture: Blob | undefined) => void;
  toUpload: () => PaperUpload | undefined;
};

export function usePaperDraft(
  initialText = '',
  initialPictures: ReadonlyMap<string, Blob> = new Map(),
): PaperDraft {
  const [text, setText] = useState(initialText);
  const [pictures, setPictures] = useState(initialPictures);
  const imported = useMemo(() => (text.trim() ? importPaper(text) : undefined), [text]);
  const isReady = imported !== undefined && imported.problems.length === 0;

  function setPicture(questionId: string, picture: Blob | undefined) {
    setPictures((current) => {
      const next = new Map(current);
      if (picture) next.set(questionId, picture);
      else next.delete(questionId);
      return next;
    });
  }

  function toUpload(): PaperUpload | undefined {
    if (!imported || !isReady) return undefined;
    const { paper, images } = withPictureNumbers(imported.paper, pictures);
    return { paper, answerKey: imported.answerKey, images };
  }

  return { text, imported, pictures, isReady, changeText: setText, setPicture, toUpload };
}
