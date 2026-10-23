import { useState, type ReactNode } from 'react';
import { PendingConfirmationDialog, type Confirmation } from './PendingConfirmationDialog';

export type ConfirmationControls = {
  askToConfirm: (confirmation: Confirmation) => void;
  confirmationDialog: ReactNode;
};

export function useConfirmation(): ConfirmationControls {
  const [confirmation, setConfirmation] = useState<Confirmation>();

  const confirmationDialog = confirmation && (
    <PendingConfirmationDialog
      confirmation={confirmation}
      onClose={() => setConfirmation(undefined)}
    />
  );

  return { askToConfirm: setConfirmation, confirmationDialog };
}
