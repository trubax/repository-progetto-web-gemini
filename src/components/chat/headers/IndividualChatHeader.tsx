import React, { useState } from 'react';
import { Phone, Video, ArrowLeft, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import IndividualChatSidebar from '../sidebars/IndividualChatSidebar';

interface IndividualChatHeaderProps {
  onClose: () => void;
  name: string;
  photoURL: string;
  status: string;
  lastSeen?: Date;
  onStartCall: (isVideo: boolean) => void;
  isCallActive: boolean;
  isBlocked?: boolean;
  chatData: any;
  onBlock: () => Promise<void>;
  onReport: () => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onToggleMute: () => Promise<void>;
}

export default function IndividualChatHeader({
  onClose,
  name,
  photoURL,
  status,
  lastSeen,
  onStartCall,
  isCallActive,
  isBlocked,
  chatData,
  onBlock,
  onReport,
  onDeleteChat,
  onToggleMute
}: IndividualChatHeaderProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const getStatusText = () => {
    if (isBlocked) return 'Bloccato';
    return status === 'online' ? 'Online' : lastSeen ? `Ultimo accesso ${formatLastSeen(lastSeen)}` : 'Offline';
  };

  const formatLastSeen = (date: Date) => {
    return format(date, 'dd/MM/yyyy HH:mm', { locale: it });
  };

  return (
    <>
      <div className="theme-bg-primary h-[64px] flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={photoURL}
            alt={name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <h2 className="font-semibold theme-text text-base">{name}</h2>
            <p className="text-sm theme-text opacity-70">
              {getStatusText()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStartCall(false)}
            disabled={isCallActive || isBlocked || status !== 'online'}
            className={`p-2 rounded-full transition-colors hover:theme-bg-secondary
            ${isCallActive ? 'text-red-500' : 'text-green-500'} 
            disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => onStartCall(true)}
            disabled={isCallActive || isBlocked || status !== 'online'}
            className={`p-2 rounded-full transition-colors hover:theme-bg-secondary
            ${isCallActive ? 'text-red-500' : 'text-blue-500'}
            disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Video className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <IndividualChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chatData={chatData}
        onBlock={onBlock}
        onReport={onReport}
        onDeleteChat={onDeleteChat}
        onToggleMute={onToggleMute}
      />
    </>
  );
}
