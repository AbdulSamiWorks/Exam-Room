import { useCallback, useEffect, useState } from 'react';

const COPIED_CONFIRMATION_MS = 2000;

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const resetTimer = window.setTimeout(() => setIsCopied(false), COPIED_CONFIRMATION_MS);
    return () => window.clearTimeout(resetTimer);
  }, [isCopied]);

  const copy = useCallback(async (text: string) => {
    const copiedSuccessfully = await writeToClipboard(text);
    setIsCopied(copiedSuccessfully);
  }, []);

  return { isCopied, copy };
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return copyWithHiddenTextArea(text);
    }
  }
  return copyWithHiddenTextArea(text);
}

function copyWithHiddenTextArea(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.append(textArea);
  textArea.select();
  try {
    return document.execCommand('copy');
  } finally {
    textArea.remove();
  }
}
