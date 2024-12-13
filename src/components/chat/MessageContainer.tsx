import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ServiceRequestActions } from './ServiceRequestActions';
import { ChatMessage } from './ChatMessage';

interface MessageContainerProps {
  messages: any[];
  chatId: string;
  serviceRequest?: {
    status: 'pending' | 'accepted' | 'rejected';
    recipientId: string;
    senderId: string;
    serviceName: string;
    serviceId: string;
  };
}

export function MessageContainer({ messages, chatId, serviceRequest }: MessageContainerProps) {
  const { currentUser } = useAuth();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mostra i pulsanti di accettazione solo se:
  // 1. C'è una richiesta di servizio
  // 2. La richiesta è in attesa
  // 3. L'utente corrente è il destinatario
  const showServiceActions = 
    serviceRequest &&
    serviceRequest.status === 'pending' && 
    serviceRequest.recipientId === currentUser?.uid;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Mostra i pulsanti di accettazione/rifiuto se necessario */}
      {showServiceActions && (
        <div className="sticky top-0 z-10 mb-4">
          <ServiceRequestActions
            chatId={chatId}
            currentUserId={currentUser?.uid || ''}
            serviceRequest={serviceRequest}
          />
        </div>
      )}

      {/* Mostra i messaggi */}
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          isServiceChat={!!serviceRequest}
        />
      ))}

      {/* Elemento per lo scroll automatico */}
      <div ref={messagesEndRef} />
    </div>
  );
}
