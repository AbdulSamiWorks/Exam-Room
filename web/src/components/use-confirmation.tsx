import { useState, type ReactNode } from 'react';
import { NoticeDialog, type Notice } from './NoticeDialog';
import { PendingConfirmationDialog, type Confirmation } from './PendingConfirmationDialog';

export type ConfirmationControls = {
  askToConfirm: (confirmation: Confirmation) => void;
  showNotice: (notice: Notice) => void;
  confirmationDialog: ReactNode;
};

type OpenDialog =
  { kind: 'confirmation'; confirmation: Confirmation } | { kind: 'notice'; notice: Notice };

export function useConfirmation(): ConfirmationControls {
  const [openDialog, setOpenDialog] = useState<OpenDialog>();
  const close = () => setOpenDialog(undefined);

  const confirmationDialog =
    openDialog?.kind === 'confirmation' ? (
      <PendingConfirmationDialog confirmation={openDialog.confirmation} onClose={close} />
    ) : openDialog?.kind === 'notice' ? (
      <NoticeDialog notice={openDialog.notice} onClose={close} />
    ) : undefined;

  return {
    askToConfirm: (confirmation) => setOpenDialog({ kind: 'confirmation', confirmation }),
    showNotice: (notice) => setOpenDialog({ kind: 'notice', notice }),
    confirmationDialog,
  };
}
