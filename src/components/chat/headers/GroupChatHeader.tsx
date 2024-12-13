import React, { useState } from 'react';
import { Users, ArrowLeft, MoreVertical } from 'lucide-react';
import GroupChatSidebar from '../sidebars/GroupChatSidebar';

interface GroupChatHeaderProps {
  onClose: () => void;
  name: string;
  photoURL: string;
  participantsCount: number;
  isAdmin: boolean;
  chatData: any;
  onUpdatePhoto: (file: File) => Promise<void>;
  onUpdateBackground: (file: File) => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onRemoveParticipant: (userId: string) => Promise<void>;
  onMakeAdmin: (userId: string) => Promise<void>;
}

export default function GroupChatHeader({
  onClose,
  name,
  photoURL,
  participantsCount,
  isAdmin,
  chatData,
  onUpdatePhoto,
  onUpdateBackground,
  onDeleteChat,
  onRemoveParticipant,
  onMakeAdmin
}: GroupChatHeaderProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 theme-text opacity-70" />
              <span className="text-sm theme-text opacity-70">
                {participantsCount} partecipanti
                {isAdmin && ' • Admin'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <GroupChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chatData={chatData}
        onUpdatePhoto={onUpdatePhoto}
        onUpdateBackground={onUpdateBackground}
        onDeleteChat={onDeleteChat}
        onRemoveParticipant={onRemoveParticipant}
        onMakeAdmin={onMakeAdmin}
      />
    </>
  );
}
