import React from 'react';
import { Dialog } from '../ui/Dialog';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/ChatService';

interface DeleteChatDialogProps {
  chatId: string;
  isGroup: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const DeleteChatDialog: React.FC<DeleteChatDialogProps> = ({
  chatId,
  isGroup,
  onClose,
  onDelete
}) => {
  const { currentUser } = useAuth();

  const handleDelete = async (deleteForAll: boolean) => {
    if (!currentUser) return;
    
    try {
      await chatService.deleteChat(chatId, currentUser.uid, deleteForAll);
      onDelete();
      onClose();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  return (
    <Dialog open={true} onClose={onClose}>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="w-full max-w-md p-4 rounded-lg theme-bg-primary">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold theme-text">
              {isGroup ? 'Lascia gruppo' : 'Elimina chat'}
            </h3>
            <button onClick={onClose} className="p-1 hover:theme-bg-secondary rounded-full">
              <X className="w-5 h-5 theme-text" />
            </button>
          </div>

          <p className="mb-6 theme-text opacity-80">
            {isGroup 
              ? 'Vuoi davvero lasciare questo gruppo? Non potrai più vedere i messaggi.'
              : 'Scegli come eliminare questa chat:'
            }
          </p>

          <div className="flex flex-col gap-2">
            {!isGroup && (
              <button
                onClick={() => handleDelete(false)}
                className="w-full p-3 rounded-lg theme-bg-secondary hover:opacity-80 theme-text text-left"
              >
                Elimina solo per me
                <span className="block text-sm opacity-70">
                  L'altro utente potrà ancora vedere la chat
                </span>
              </button>
            )}

            <button
              onClick={() => handleDelete(isGroup ? false : true)}
              className="w-full p-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-left"
            >
              {isGroup ? 'Lascia gruppo' : 'Elimina per tutti'}
              <span className="block text-sm opacity-70">
                {isGroup 
                  ? 'Verrai rimosso dal gruppo e non potrai più accedervi'
                  : 'La chat verrà eliminata per entrambi gli utenti'
                }
              </span>
            </button>

            <button
              onClick={onClose}
              className="w-full p-3 rounded-lg theme-bg-secondary hover:opacity-80 theme-text"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
