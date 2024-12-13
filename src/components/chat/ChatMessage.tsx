import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { FileIcon, ImageIcon, VideoIcon, MicIcon, FileText, Download } from 'lucide-react';
import { useAudioMessage } from '@/hooks/useAudioMessage';

interface MessageMetadata {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
}

interface ChatMessageProps {
  message: {
    id: string;
    text: string;
    timestamp: any;
    senderId: string;
    senderName?: string;
    senderPhotoURL?: string;
    type?: string;
    systemType?: string;
    isGroupChat?: boolean;
    groupParticipants?: Record<string, any>;
    visibleTo?: string[];
    metadata?: MessageMetadata;
  };
  onActionClick?: () => void;
}

export function ChatMessage({ message, onActionClick }: ChatMessageProps) {
  const { currentUser } = useAuth();
  const { updateMessageDuration } = useAudioMessage();
  const [loading, setLoading] = React.useState(false);

  // Non mostrare il messaggio se è visibile solo per alcuni utenti e l'utente corrente non è tra questi
  if (message.visibleTo && !message.visibleTo.includes(currentUser?.uid || '')) {
    return null;
  }

  const isCurrentUser = message.senderId === currentUser?.uid;
  const isSystemMessage = message.type === 'system';
  const isServiceMessage = message.type === 'service';
  const isServiceRequest = message.type === 'serviceRequest';
  const isMediaMessage = message.metadata?.type === 'image' || message.metadata?.type === 'video' || message.metadata?.type === 'audio' || message.metadata?.type === 'file';

  // Ottieni i dati del mittente per i gruppi
  const getSenderData = () => {
    if (message.isGroupChat && message.groupParticipants) {
      const participant = message.groupParticipants[message.senderId];
      return {
        name: participant?.displayName || 'Utente sconosciuto',
        photoURL: participant?.photoURL
      };
    }
    return {
      name: message.senderName || 'Utente sconosciuto',
      photoURL: message.senderPhotoURL
    };
  };

  const { name: senderName, photoURL: senderPhotoURL } = getSenderData();

  // Formatta la data del messaggio
  const formattedDate = message.timestamp?.toDate?.() 
    ? formatDistanceToNow(message.timestamp.toDate(), { addSuffix: true, locale: it })
    : '';

  const renderMedia = (metadata: MessageMetadata) => {
    const { type, url, fileName, fileSize, mimeType, duration } = metadata;

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      const kb = bytes / 1024;
      if (kb < 1024) return kb.toFixed(1) + ' KB';
      const mb = kb / 1024;
      return mb.toFixed(1) + ' MB';
    };

    const formatDuration = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    switch (type) {
      case 'image':
        return (
          <div className="relative max-w-sm">
            <img
              src={url}
              alt={fileName || 'Immagine'}
              className="rounded-lg max-h-[300px] object-contain bg-gray-800"
              loading="lazy"
            />
            {fileName && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2 rounded-b-lg">
                <p className="truncate">{fileName}</p>
                <p className="text-xs opacity-75">{formatFileSize(fileSize)}</p>
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="max-w-sm">
            <video
              src={url}
              controls
              className="rounded-lg max-h-[300px] w-full bg-gray-800"
              controlsList="nodownload"
              playsInline
            >
              <source src={url} type={mimeType || 'video/mp4'} />
              Il tuo browser non supporta la riproduzione video.
            </video>
            {fileName && (
              <div className="mt-1 text-sm theme-text-secondary">
                <p className="truncate">{fileName}</p>
                <p className="text-xs">{formatFileSize(fileSize)}</p>
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="max-w-sm w-full">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50">
              <div className="p-2 rounded-full bg-blue-500/20">
                <MicIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <audio
                  src={url}
                  controls
                  className="w-full h-8"
                  controlsList="nodownload"
                  onLoadedMetadata={(e) => {
                    const audio = e.currentTarget;
                    if (audio.duration && !duration) {
                      updateMessageDuration(message.id, audio.duration);
                    }
                  }}
                >
                  <source src={url} type={mimeType || 'audio/webm;codecs=opus'} />
                  Il tuo browser non supporta la riproduzione audio.
                </audio>
              </div>
            </div>
            <div className="mt-1 flex justify-between items-center text-xs theme-text-secondary px-3">
              <span>{formatFileSize(fileSize || 0)}</span>
              {duration && <span>{formatDuration(duration)}</span>}
            </div>
          </div>
        );

      case 'file':
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-700/50 transition-colors max-w-sm"
          >
            <div className="p-2 rounded-lg bg-blue-500/20">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium theme-text truncate">{fileName}</p>
              <p className="text-sm theme-text-secondary">{formatFileSize(fileSize)}</p>
            </div>
            <Download className="w-5 h-5 theme-text-secondary shrink-0" />
          </a>
        );

      default:
        return null;
    }
  };

  if (isSystemMessage) {
    let messageClass = 'bg-muted';
    if (message.systemType === 'service_accepted') {
      messageClass = 'bg-green-500/10 text-green-600';
    } else if (message.systemType === 'service_rejected') {
      messageClass = 'bg-red-500/10 text-red-600';
    }

    return (
      <div className="flex justify-center my-4">
        <div className={`px-4 py-2 rounded-lg text-sm ${messageClass} max-w-[80%]`}>
          <p>{message.text}</p>
        </div>
      </div>
    );
  }

  if (isServiceRequest || isServiceMessage) {
    const isAccepted = message.serviceRequest?.status === 'accepted';
    const isPending = message.serviceRequest?.status === 'pending';
    
    return (
      <div className={cn(
        "flex gap-2 my-2",
        isCurrentUser ? "justify-end" : "justify-start"
      )}>
        <div className={cn(
          "flex flex-col gap-1 max-w-[80%] p-4 rounded-lg",
          isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted",
          isAccepted && "border-l-4 border-green-500",
          isPending && "border-l-4 border-yellow-500"
        )}>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>Richiesta di servizio: {message.serviceRequest?.serviceName}</span>
            {isAccepted && (
              <svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-sm">{message.text}</p>
          <span className="text-xs opacity-70">{formattedDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-2 my-2",
      isCurrentUser ? "justify-end" : "justify-start"
    )}>
      {!isCurrentUser && (
        <Avatar className="w-8 h-8">
          <AvatarImage src={senderPhotoURL} />
          <AvatarFallback>{senderName?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
        "flex flex-col gap-1 max-w-[80%] p-3 rounded-lg",
        isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {!isCurrentUser && message.isGroupChat && (
          <span className="text-xs font-medium">{senderName}</span>
        )}
        {message.metadata ? renderMedia(message.metadata) : <p className="text-sm">{message.text}</p>}
        <span className="text-xs opacity-70">{formattedDate}</span>
      </div>
    </div>
  );
}
