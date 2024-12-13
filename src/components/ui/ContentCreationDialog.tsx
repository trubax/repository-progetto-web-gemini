import { Dialog } from './Dialog';
import { X } from 'lucide-react';

interface ContentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitDisabled?: boolean;
}

export function ContentCreationDialog({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  submitLabel,
  isSubmitDisabled
}: ContentCreationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="creation-dialog">
        <div className="creation-dialog-content max-h-[80vh]">
          <div className="creation-dialog-header">
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:theme-bg-secondary rounded-full transition-colors"
            >
              <X className="w-5 h-5 theme-text" />
            </button>
            <h2 className="text-xl font-semibold theme-text absolute left-1/2 -translate-x-1/2">
              {title}
            </h2>
          </div>

          <div className="creation-dialog-body py-3">
            {children}
          </div>

          <div className="creation-dialog-footer">
            <button
              onClick={() => onOpenChange(false)}
              className="px-6 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-80 transition-opacity"
            >
              Annulla
            </button>
            <div className="flex-grow"></div>
            <button
              onClick={() => onSubmit()}
              disabled={isSubmitDisabled}
              className="px-6 py-2 rounded-lg theme-bg-accent theme-text-accent disabled:opacity-50 transition-opacity"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 