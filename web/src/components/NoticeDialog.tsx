import { Button } from './Button';
import { Dialog } from './Dialog';

export type Notice = {
  title: string;
  message: string;
};

type NoticeDialogProps = {
  notice: Notice;
  onClose: () => void;
};

export function NoticeDialog({ notice, onClose }: NoticeDialogProps) {
  return (
    <Dialog
      title={notice.title}
      message={notice.message}
      actions={
        <Button variant="secondary" onClick={onClose} autoFocus>
          OK
        </Button>
      }
    />
  );
}
