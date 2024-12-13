import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import ClickableAvatar from '../common/ClickableAvatar';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface ChatItemProps {
  chat: any;
  onSelect: (chatId: string) => void;
  onDelete?: (chatId: string) => void;
  onStartCall?: (chatId: string) => void;
  formatTimestamp: (timestamp: any) => string;
}

const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  onSelect,
  onDelete,
  onStartCall,
  formatTimestamp
}) => {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isInThisChat, setIsInThisChat] = useState(false);

  // Controlla se siamo nella chat corrente
  useEffect(() => {
    const currentPath = window.location.pathname;
    setIsInThisChat(currentPath.includes(`/chat/${chat.id}`) || currentPath.includes(`/messages/${chat.id}`));
  }, [chat.id, window.location.pathname]);

  // Ascolta i cambiamenti del contatore
  useEffect(() => {
    if (!chat.id || !currentUser) return;

    const unsubscribe = onSnapshot(doc(db, 'chats', chat.id), (doc) => {
      if (doc.exists()) {
        const count = doc.data()?.unreadCount?.[currentUser.uid] || 0;
        setUnreadCount(count);
      }
    });

    return () => unsubscribe();
  }, [chat.id, currentUser]);

  // Determina se mostrare il badge di servizio
  const isServiceChat = chat.type === 'service';
  const isPendingService = chat.serviceRequest?.status === 'pending';
  const isAcceptedService = chat.serviceRequest?.status === 'accepted';
  const showServiceBadge = isServiceChat && (isPendingService || isAcceptedService);

  return (
    <div
      className={`relative flex items-center p-4 space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
        isServiceChat ? 'border-l-4 border-blue-500' : ''
      }`}
      onClick={() => onSelect(chat.id)}
    >
      <div className="relative">
        <ClickableAvatar
          src={chat.isGroupChat ? chat.groupPhoto : chat.recipientPhotoURL}
          alt={chat.isGroupChat ? chat.groupName : chat.recipientName}
          size="md"
        />
        {unreadCount > 0 && !isInThisChat && (
          <div className={unreadCount > 99 ? 'notification-badge' : 'notification-dot'}>
            {unreadCount > 99 ? '99+' : unreadCount > 1 ? unreadCount : ''}
          </div>
        )}
        {showServiceBadge && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${
            isAcceptedService ? 'bg-green-500' : 'bg-yellow-500'
          }`}>
            <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
              {isAcceptedService ? (
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
              )}
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between">
          <h3 className="text-sm font-medium truncate">
            {chat.isGroupChat ? chat.groupName : chat.recipientName}
            {isServiceChat && (
              <span className="ml-2 text-xs font-normal text-blue-500">
                {isPendingService ? '• In attesa' : '• Servizio'}
              </span>
            )}
          </h3>
          {chat.lastMessage?.timestamp && (
            <span className="text-xs text-gray-500">
              {formatTimestamp(chat.lastMessage.timestamp)}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">
          {chat.lastMessage?.text || (isPendingService ? 'Richiesta di servizio in attesa' : 'Nessun messaggio')}
        </p>
      </div>

      {(onDelete || onStartCall) && (
        <div className="flex space-x-2">
          {onStartCall && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCall(chat.id);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
              className="p-2 text-gray-400 hover:text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatItem;
