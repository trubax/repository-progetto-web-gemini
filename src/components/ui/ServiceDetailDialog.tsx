import { useState } from 'react';
import { Dialog } from './Dialog';
import { Service } from '../../types/service';
import { useAuth } from '../../hooks/useAuth';
import { Loader2, X } from 'lucide-react';
import { useChatCreation } from '../../hooks/useChatCreation';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';

interface ServiceDetailDialogProps {
  service: Service;
  onClose: () => void;
  userId: string;
}

export function ServiceDetailDialog({ service, onClose, userId }: ServiceDetailDialogProps) {
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const { createServiceRequestChat } = useChatCreation();
  const navigate = useNavigate();

  const handleSendRequest = async () => {
    if (!currentUser || !message.trim()) return;

    try {
      // Crea la chat con il messaggio di richiesta servizio
      const chatPreview = await createServiceRequestChat(service.userId, {
        id: service.id,
        name: service.name,
        category: service.category,
        message: message.trim()
      });

      // Naviga alla chat appena creata
      navigate('/chat', { state: { selectedChat: chatPreview, openChat: true } });
      onClose();
    } catch (error) {
      console.error('Errore nell\'invio della richiesta:', error);
    }
  };

  const isOwnService = currentUser?.uid === userId;

  return (
    <Dialog open onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[200]">
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="theme-bg-primary rounded-lg max-w-2xl w-full">
            {/* Header */}
            <div className="p-4 border-b theme-border flex justify-between items-center">
              <h2 className="text-xl font-semibold theme-text">Dettagli Servizio</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:theme-bg-secondary"
              >
                <X className="w-5 h-5 theme-text" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold theme-text mb-1">{service.name}</h3>
                <p className="theme-text-secondary text-sm">
                  Categoria: {service.category.charAt(0).toUpperCase() + service.category.slice(1)}
                </p>
              </div>

              <div className="theme-text">
                <p className="whitespace-pre-wrap">{service.description}</p>
              </div>

              {service.rate && (
                <div className="theme-text">
                  <p className="font-medium">
                    Tariffa: {service.rate.amount} € {' '}
                    {service.rate.unit === 'hour' ? "all'ora" : 
                     service.rate.unit === 'day' ? "al giorno" : 
                     "a progetto"}
                  </p>
                </div>
              )}

              {!isOwnService && (
                <div className="space-y-2 pt-4">
                  <label className="block text-sm font-medium theme-text">
                    Invia una richiesta
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descrivi brevemente la tua richiesta..."
                    className="w-full p-3 rounded-lg theme-bg-secondary theme-text theme-border border min-h-[100px] resize-none"
                  />
                  <button
                    onClick={handleSendRequest}
                    disabled={!message.trim()}
                    className="w-full p-3 rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    'Invia richiesta'
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}