import React, { useRef, useEffect } from 'react';
import { X, Shield, Clock, Camera, User, Users } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import IndividualChatSidebar from './sidebars/IndividualChatSidebar';
import GroupChatSidebar from './sidebars/GroupChatSidebar';
import ServiceChatSidebar from './sidebars/ServiceChatSidebar';
import { useAuth } from '../../contexts/AuthContext';

interface ChatData {
  type: 'individual' | 'group' | 'service';
  participants: string[];
  admins?: string[];
  createdAt: any;
  createdBy: string;
}

interface ChatOptions {
  isBlocked: boolean;
  messageTimer: number;
  screenshotPrevention: boolean;
}

interface ChatOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  chatData?: ChatData | null;
  options: ChatOptions;
  onBlock?: () => Promise<void>;
  onUnblock?: () => Promise<void>;
  onSetTimer?: (seconds: number) => Promise<void>;
  onToggleScreenshotPrevention?: () => Promise<void>;
  className?: string;
}

export default function ChatOptions({
  isOpen,
  onClose,
  chatData,
  options,
  onBlock,
  onUnblock,
  onSetTimer,
  onToggleScreenshotPrevention,
  className
}: ChatOptionsProps) {
  const { currentUser } = useAuth();

  if (!chatData) return null;

  // Funzioni di callback comuni
  const handleDeleteChat = async () => {
    // Implementa la logica per eliminare la chat
    console.log('Delete chat');
  };

  const handleToggleMute = async () => {
    // Implementa la logica per silenziare/riattivare le notifiche
    console.log('Toggle mute');
  };

  const handleReport = async () => {
    // Implementa la logica per segnalare
    console.log('Report');
  };

  // Funzioni specifiche per chat individuali
  const handleBlock = async () => {
    // Implementa la logica per bloccare l'utente
    console.log('Block user');
  };

  // Funzioni specifiche per chat di gruppo
  const handleUpdatePhoto = async (file: File) => {
    // Implementa la logica per aggiornare la foto del gruppo
    console.log('Update group photo:', file);
  };

  const handleUpdateBackground = async (file: File) => {
    // Implementa la logica per aggiornare lo sfondo
    console.log('Update background:', file);
  };

  const handleRemoveParticipant = async (userId: string) => {
    // Implementa la logica per rimuovere un partecipante
    console.log('Remove participant:', userId);
  };

  const handleMakeAdmin = async (userId: string) => {
    // Implementa la logica per promuovere ad admin
    console.log('Make admin:', userId);
  };

  // Funzioni specifiche per chat di servizio
  const handleRate = async (rating: number) => {
    // Implementa la logica per la valutazione
    console.log('Rate service:', rating);
  };

  const handleSchedule = async () => {
    // Implementa la logica per pianificare un appuntamento
    console.log('Schedule appointment');
  };

  switch (chatData.type) {
    case 'service':
      return (
        <ServiceChatSidebar
          isOpen={isOpen}
          onClose={onClose}
          chatData={chatData}
          onRate={handleRate}
          onReport={handleReport}
          onDeleteChat={handleDeleteChat}
          onToggleMute={handleToggleMute}
          onSchedule={handleSchedule}
        />
      );

    case 'group':
      return (
        <GroupChatSidebar
          isOpen={isOpen}
          onClose={onClose}
          chatData={chatData}
          onUpdatePhoto={handleUpdatePhoto}
          onUpdateBackground={handleUpdateBackground}
          onDeleteChat={handleDeleteChat}
          onRemoveParticipant={handleRemoveParticipant}
          onMakeAdmin={handleMakeAdmin}
        />
      );

    default:
      return (
        <IndividualChatSidebar
          isOpen={isOpen}
          onClose={onClose}
          chatData={chatData}
          onReport={handleReport}
          onDeleteChat={handleDeleteChat}
          onToggleMute={handleToggleMute}
          options={options}
          onBlock={onBlock}
          onUnblock={onUnblock}
          onSetTimer={onSetTimer}
          onToggleScreenshotPrevention={onToggleScreenshotPrevention}
        />
      );
  }
}