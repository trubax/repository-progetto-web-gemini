import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';

interface ServiceRequest {
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  message: string;
}

interface StartServiceChatModalProps {
  recipientId: string;
  recipientName: string;
  service: {
    id: string;
    name: string;
    category: string;
  };
  onClose: () => void;
}

export function StartServiceChatModal({
  recipientId,
  recipientName,
  service,
  onClose
}: StartServiceChatModalProps) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading || !currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const batch = writeBatch(db);
      
      // Create chat document
      const chatRef = doc(db, 'chats');
      batch.set(chatRef, {
        type: 'service',
        participants: [currentUser.uid, recipientId],
        participantsData: {
          [currentUser.uid]: {
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            isAnonymous: currentUser.isAnonymous
          }
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'Richiesta servizio in attesa di approvazione',
        lastMessageTime: serverTimestamp(),
        isVisible: true,
        isGroup: false,
        serviceRequest: {
          id: service.id,
          name: service.name,
          category: service.category,
          requestMessage: message.trim(),
          status: 'pending',
          requesterId: currentUser.uid,
          timestamp: serverTimestamp()
        }
      });

      // Add system message
      const messageRef = doc(db, `chats/${chatRef.id}/messages`);
      batch.set(messageRef, {
        type: 'system',
        subtype: 'service_request',
        text: `Richiesta servizio: ${service.name}\nCategoria: ${service.category}`,
        timestamp: serverTimestamp(),
        serviceRequest: {
          id: service.id,
          name: service.name,
          category: service.category,
          status: 'pending',
          requestMessage: message.trim()
        }
      });

      // Add user message (hidden until approved)
      const userMessageRef = doc(db, `chats/${chatRef.id}/messages`);
      batch.set(userMessageRef, {
        text: message.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: serverTimestamp(),
        isHidden: true,
        type: 'service_request_message'
      });

      // Add chat reference for current user
      const currentUserChatRef = doc(db, `users/${currentUser.uid}/chats/${chatRef.id}`);
      batch.set(currentUserChatRef, {
        chatId: chatRef.id,
        unreadCount: 0,
        lastRead: serverTimestamp(),
        isVisible: true
      });

      // Add chat reference for recipient
      const recipientChatRef = doc(db, `users/${recipientId}/chats/${chatRef.id}`);
      batch.set(recipientChatRef, {
        chatId: chatRef.id,
        unreadCount: 1,
        lastRead: null,
        isVisible: true
      });

      await batch.commit();

      // Navigate to the chat
      navigate('/chat', {
        state: {
          selectedChat: {
            id: chatRef.id,
            name: recipientName,
            type: 'service',
            lastMessage: 'Richiesta servizio in attesa di approvazione',
            timestamp: new Date(),
            unread: 0,
            serviceRequest: {
              status: 'pending'
            }
          },
          openChat: true
        }
      });

      onClose();
    } catch (err: any) {
      console.error('Error creating service chat:', err);
      setError(err.message || 'Errore durante l\'invio della richiesta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md theme-bg-primary rounded-lg shadow-xl">
        <div className="p-4 border-b theme-divide flex justify-between items-center">
          <h3 className="text-lg font-medium theme-text">
            Richiesta servizio: {service.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:theme-bg-secondary"
          >
            <X className="w-5 h-5 theme-text" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <div className="mb-4 p-3 rounded-lg theme-bg-secondary">
              <p className="text-sm font-medium theme-text">Dettagli servizio:</p>
              <p className="text-sm theme-text opacity-70">Nome: {service.name}</p>
              <p className="text-sm theme-text opacity-70">Categoria: {service.category}</p>
            </div>
            
            <label className="block text-sm font-medium theme-text opacity-70 mb-2">
              Descrivi la tua richiesta
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 theme-bg-secondary theme-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              rows={4}
              placeholder="Descrivi brevemente cosa ti serve..."
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
              {loading ? 'Invio...' : 'Invia richiesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
