import React, { useState, useRef } from 'react';
import { Send, X, Camera } from 'lucide-react';
import { useCreateChat } from '../../hooks/useCreateChat';
import { useNavigate } from 'react-router-dom';

interface StartGroupChatModalProps {
  groupName: string;
  participants: string[];
  onClose: () => void;
  onSendMessage: (message: string, photo?: File) => Promise<void>;
}

export function StartGroupChatModal({ 
  groupName,
  participants,
  onClose,
  onSendMessage
}: StartGroupChatModalProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('La foto non può superare i 5MB');
        return;
      }
      setGroupPhoto(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    try {
      setLoading(true);
      setError(null);
      await onSendMessage(message.trim(), groupPhoto || undefined);
    } catch (err: any) {
      console.error('Error creating group chat:', err);
      setError(err.message || 'Errore durante la creazione del gruppo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md theme-bg-primary rounded-lg shadow-xl">
        <div className="p-4 border-b theme-divide flex justify-between items-center">
          <h3 className="text-lg font-medium theme-text">
            Crea gruppo "{groupName}"
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:theme-bg-secondary"
          >
            <X className="w-5 h-5 theme-text" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {/* Group Photo Section */}
          <div className="mb-4">
            <label className="block text-sm font-medium theme-text opacity-70 mb-2">
              Foto del gruppo (opzionale)
            </label>
            <div className="flex items-center gap-4">
              <div 
                className="w-20 h-20 rounded-full theme-bg-secondary flex items-center justify-center cursor-pointer overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {groupPhoto ? (
                  <img 
                    src={URL.createObjectURL(groupPhoto)} 
                    alt="Anteprima foto gruppo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 theme-text opacity-70" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <div className="flex-1 text-sm theme-text opacity-70">
                Clicca per aggiungere una foto del gruppo
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium theme-text opacity-70 mb-2">
              Scrivi il primo messaggio per il gruppo
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 theme-bg-secondary theme-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={4}
              placeholder="Scrivi un messaggio..."
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-90"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!message.trim() || loading}
              className="px-4 py-2 rounded-lg theme-bg-accent theme-text hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Creazione gruppo...' : 'Crea e invia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
