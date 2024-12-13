import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, ArrowLeft, MoreVertical, Phone, Video, Loader2, Paperclip, Mic, Pause, Play, Square, X } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useTheme } from '../contexts/ThemeContext';
import ChatOptions from './chat/ChatOptions';
import IndividualChatHeader from './chat/headers/IndividualChatHeader';
import GroupChatHeader from './chat/headers/GroupChatHeader';
import ServiceChatHeader from './chat/headers/ServiceChatHeader';
import MediaInput from './chat/MediaInput';
import MessageItem from './chat/MessageItem';
import { useChat } from '../hooks/useChat';
import { CallService } from '../services/CallService';
import { useAuth } from '../contexts/AuthContext';
import AudioRecorder from './chat/AudioRecorder';
import { MediaHandlerService } from '../services/MediaHandlerService';
import AudioRecordingDialog from './chat/media/AudioRecordingDialog';
import { formatDuration } from '../../../utils/timeUtils';
import MediaDialog from './chat/media/MediaDialog';

interface ChatViewProps {
  chat: {
    id: string;
    name: string;
    photoURL: string;
    status?: string;
    lastSeen?: Date | string;
    isGroup?: boolean;
    participants?: string[];
  };
  onClose: () => void;
}

export default function ChatView({ chat, onClose }: ChatViewProps) {
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const callService = new CallService();
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [shouldAutoExpand, setShouldAutoExpand] = useState(false);
  const chatMediaService = MediaHandlerService.getInstance();
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);

  const {
    messages,
    chatData,
    options,
    loading,
    error,
    sendMessage,
    deleteMessage,
    markAsRead,
    setMessageTimer
  } = useChat(chat.id);

  useEffect(() => {
    scrollToBottom();
    markAsRead();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isUploading || isRecording) return;
    
    try {
      setSendError(null);
      const tempId = Date.now().toString();
      
      // Aggiungi un messaggio temporaneo con stato 'sending'
      const tempMessage = {
        id: tempId,
        text: message.trim(),
        timestamp: new Date(),
        isMe: true,
        status: 'sending' as const,
        senderPhoto: currentUser?.photoURL || '',
        senderName: currentUser?.displayName || ''
      };

      // Invia il messaggio
      await sendMessage(message.trim());
      setMessage('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      setSendError(err.message || 'Errore nell\'invio del messaggio');
    }
  };

  const handleMediaSend = async (file: File) => {
    if (!currentUser || !chatData) return;
    
    try {
      setIsUploading(true);
      setSendError(null);

      // Controllo dimensione file
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        setSendError('File troppo grande. Massimo 100MB.');
        return;
      }

      // Verifica tipo file
      const fileType = file.type.toLowerCase();
      const messageType = fileType.startsWith('image/') ? 'image' : 
                         fileType.startsWith('video/') ? 'video' :
                         fileType.startsWith('audio/') ? 'audio' : 'file';

      // Verifica estensioni permesse
      const allowedExtensions = {
        image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        video: ['.mp4', '.webm', '.ogg'],
        audio: ['.mp3', '.wav', '.ogg', '.m4a', '.webm'],
        file: ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
      };

      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions[messageType].includes(fileExtension)) {
        setSendError(`Formato file non supportato. Formati permessi: ${allowedExtensions[messageType].join(', ')}`);
        return;
      }

      // Carica il file
      const url = await chatMediaService.processAndUploadMedia(file, {
        chatId: chat.id,
        userId: currentUser.uid,
        isGroup: chatData.type === 'group',
        isAnonymous: currentUser.isAnonymous,
        messageType
      });

      // Invia il messaggio con i metadati del file
      await sendMessage('', { 
        type: messageType,
        url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      });

    } catch (err: any) {
      console.error('Error sending media:', err);
      setSendError(err.message || 'Errore nell\'invio del file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAudioSend = async (audioBlob: Blob) => {
    if (!currentUser || !chatData) return;
    
    try {
      setIsUploading(true);
      setSendError(null);

      console.log('Invio audio:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      // Carica il file audio
      const url = await chatMediaService.processAndUploadMedia(audioBlob, {
        chatId: chat.id,
        userId: currentUser.uid,
        isGroup: chatData.type === 'group',
        isAnonymous: currentUser.isAnonymous,
        messageType: 'audio'
      });

      // Crea il messaggio con i metadati audio
      await sendMessage('', {
        type: 'audio',
        url,
        fileName: `audio_${Date.now()}.webm`,
        fileSize: audioBlob.size,
        mimeType: 'audio/webm;codecs=opus',
        duration: 0 // La durata verrà aggiunta dal componente audio
      });

    } catch (err: any) {
      console.error('Error sending audio:', err);
      setSendError(err.message || 'Errore nell\'invio del messaggio vocale');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartCall = async (isVideo: boolean) => {
    if (!chatData) return;
    
    try {
      setIsCallActive(true);
      await callService.startCall(chat.id, isVideo);
    } catch (error: any) {
      console.error('Error starting call:', error);
      alert('Errore nell\'avvio della chiamata. Riprova.');
    }
  };

  const handleEndCall = async () => {
    try {
      await callService.endCall();
      setIsCallActive(false);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const getStatusText = () => {
    if (!chatData) return '';
    if (chatData.type === 'group') return `${chatData.participants.length} partecipanti`;
    return chat.status === 'online' ? 'Online' : chat.lastSeen ? `Ultimo accesso ${formatLastSeen(chat.lastSeen)}` : 'Offline';
  };

  const formatLastSeen = (lastSeen?: Date | string) => {
    if (!lastSeen) return '';
    if (typeof lastSeen === 'string') return lastSeen;
    return format(lastSeen, 'dd/MM/yyyy HH:mm', { locale: it });
  };

  // Aggiungi un effetto per marcare i messaggi come letti
  useEffect(() => {
    if (!messages.length || !currentUser) return;

    const unreadMessages = messages.filter(
      msg => !msg.isMe && !msg.readBy?.includes(currentUser.uid)
    );

    if (unreadMessages.length > 0) {
      markAsRead();
    }
  }, [messages, currentUser]);

  // Gestisce l'espansione automatica in base alla larghezza della finestra
  useEffect(() => {
    const handleResize = () => {
      // Larghezza minima necessaria per tutti gli elementi (personalizza questi valori)
      const minWidth = 320; // larghezza minima base
      const extraSpace = 50; // spazio extra richiesto
      const currentWidth = window.innerWidth;

      // Espandi automaticamente se c'è abbastanza spazio
      if (currentWidth >= minWidth + extraSpace) {
        setIsMenuExpanded(true);
        setShouldAutoExpand(true);
      } else {
        setShouldAutoExpand(false);
        // Chiudi il menu solo se era stato espanso automaticamente
        if (shouldAutoExpand) {
          setIsMenuExpanded(false);
        }
      }
    };

    // Controlla al mount e quando la finestra viene ridimensionata
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [shouldAutoExpand]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Controllo dimensione file
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setSendError('File troppo grande. Massimo 100MB.');
      return;
    }

    await handleMediaSend(file);
  };

  const handleAudioComplete = async (audioBlob: Blob) => {
    if (!currentUser || !chatData) return;
    
    try {
      // Controllo dimensione file
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (audioBlob.size > maxSize) {
        setSendError('File troppo grande. Massimo 100MB.');
        return;
      }

      setIsUploading(true);
      setSendError(null);

      // Converti il Blob in File mantenendo il tipo MIME originale
      const audioFile = new File([audioBlob], 'audio-message.webm', { 
        type: 'audio/webm;codecs=opus'
      });
      
      const url = await chatMediaService.processAndUploadMedia(audioFile, {
        chatId: chat.id,
        userId: currentUser.uid,
        isGroup: chatData.type === 'group',
        isAnonymous: currentUser.isAnonymous,
        messageType: 'audio'
      });

      await sendMessage('', { 
        type: 'audio',
        url,
        fileName: 'Messaggio vocale',
        fileSize: audioBlob.size
      });

      setShowAudioRecorder(false);
    } catch (err: any) {
      console.error('Error sending audio:', err);
      setSendError(err.message || 'Errore nell\'invio del messaggio vocale');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isUploading || isRecording) return;
    
    try {
      setSendError(null);
      const tempId = Date.now().toString();
      
      // Aggiungi un messaggio temporaneo con stato 'sending'
      const tempMessage = {
        id: tempId,
        text: message.trim(),
        timestamp: new Date(),
        isMe: true,
        status: 'sending' as const,
        senderPhoto: currentUser?.photoURL || '',
        senderName: currentUser?.displayName || ''
      };

      // Invia il messaggio
      await sendMessage(message.trim());
      setMessage('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      setSendError(err.message || 'Errore nell\'invio del messaggio');
    }
  };

  const handleAcceptService = async () => {
    if (!currentUser || !chatData) return;

    try {
      // Aggiorna lo stato della chat
      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        status: 'accepted',
        blocked: false
      });

      // Invia messaggio di sistema per l'accettazione
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        chatId: chat.id,
        type: 'system',
        text: 'Richiesta servizio accettata! Ora potete iniziare a chattare.',
        timestamp: serverTimestamp(),
        systemType: 'accepted'
      });

    } catch (error) {
      console.error('Errore nell\'accettazione del servizio:', error);
    }
  };

  const handleRejectService = async () => {
    if (!currentUser || !chatData) return;

    try {
      // Aggiorna lo stato della chat
      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        status: 'rejected',
        blocked: true
      });

      // Invia messaggio di sistema per il rifiuto
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        chatId: chat.id,
        type: 'system',
        text: 'Richiesta servizio rifiutata.',
        timestamp: serverTimestamp(),
        systemType: 'rejected'
      });

    } catch (error) {
      console.error('Errore nel rifiuto del servizio:', error);
    }
  };

  const isServiceOwner = () => {
    if (!chatData?.serviceRequest || !currentUser) return false;
    return currentUser.uid === chatData.serviceRequest.serviceOwnerId;
  };

  const isServiceRequester = () => {
    if (!chatData?.serviceRequest || !currentUser) return false;
    return currentUser.uid === chatData.serviceRequest.senderId;
  };

  const shouldShowAcceptButtons = () => {
    if (!chatData?.serviceRequest || !currentUser) return false;
    return chatData.serviceRequest.status === 'pending' && isServiceOwner();
  };

  const getSystemMessage = () => {
    if (!chatData?.serviceRequest || !currentUser) return null;
    
    switch (chatData.serviceRequest.status) {
      case 'pending':
        if (isServiceOwner()) {
          return {
            text: `Nuova richiesta di servizio per "${chatData.serviceRequest.serviceName}"\n${chatData.serviceRequest.message}`,
            type: 'request'
          };
        } else if (isServiceRequester()) {
          return {
            text: 'Richiesta inviata. In attesa di risposta dal proprietario del servizio...',
            type: 'waiting'
          };
        }
        break;
      case 'accepted':
        return {
          text: 'Richiesta di servizio accettata! La conversazione può iniziare.',
          type: 'accepted'
        };
      case 'rejected':
        return {
          text: 'Richiesta di servizio rifiutata.',
          type: 'rejected'
        };
    }
    return null;
  };

  const canSendMessages = () => {
    if (!chatData || !currentUser) return false;
    return true;
  };

  const shouldShowInputArea = () => {
    return true;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 theme-bg flex items-center justify-center">
        <div className="theme-text">Caricamento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 theme-bg flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 theme-bg flex flex-col z-50">
      {chatData?.serviceType ? (
        <ServiceChatHeader
          onClose={onClose}
          name={chat.name}
          photoURL={chat.photoURL}
          serviceType={chatData.serviceType}
          availability={chatData.availability || 'offline'}
          rating={chatData.rating}
          chatData={chatData}
          onRate={async (rating) => {
            // Implementare la logica di valutazione
          }}
          onReport={async () => {
            // Implementare la logica di segnalazione
          }}
          onDeleteChat={async () => {
            // Implementare la logica di eliminazione chat
          }}
          onToggleMute={async () => {
            // Implementare la logica di silenziamento
          }}
          onSchedule={async () => {
            // Implementare la logica di pianificazione
          }}
        />
      ) : chatData?.type === 'group' ? (
        <GroupChatHeader
          onClose={onClose}
          name={chat.name}
          photoURL={chat.photoURL}
          onShowOptions={() => setShowOptions(true)}
          participantsCount={chatData.participants.length}
          isAdmin={chatData.admins?.includes(currentUser?.uid)}
        />
      ) : (
        <IndividualChatHeader
          onClose={onClose}
          name={chat.name}
          photoURL={chat.photoURL}
          onShowOptions={() => setShowOptions(true)}
          status={chat.status || 'offline'}
          lastSeen={chat.lastSeen}
          onStartCall={handleStartCall}
          isCallActive={isCallActive}
        />
      )}

      {/* Stato del servizio e messaggi di sistema */}
      {chatData?.serviceRequest && (
        <div className={`flex justify-center p-4 ${
          chatData.serviceRequest.status === 'pending' ? 'bg-yellow-50' :
          chatData.serviceRequest.status === 'accepted' ? 'bg-green-50' :
          chatData.serviceRequest.status === 'rejected' ? 'bg-red-50' :
          'bg-gray-50'
        }`}>
          <div className="text-center">
            <p className={`text-sm font-medium ${
              chatData.serviceRequest.status === 'pending' ? 'text-yellow-800' :
              chatData.serviceRequest.status === 'accepted' ? 'text-green-800' :
              chatData.serviceRequest.status === 'rejected' ? 'text-red-800' :
              'text-gray-800'
            }`}>
              {getSystemMessage()?.text}
            </p>
            
            {shouldShowAcceptButtons() && (
              <div className="flex justify-center gap-2 mt-2">
                <button
                  onClick={handleAcceptService}
                  className="px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  Accetta
                </button>
                <button
                  onClick={handleRejectService}
                  className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Rifiuta
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[120px] sm:pb-[100px]">
        {messages.map((msg) => {
          // Se è un messaggio di richiesta servizio, mostralo solo al proprietario del servizio
          if (msg.type === 'service_request' && chatData?.serviceRequest) {
            if (!isServiceOwner()) return null;
          }
          
          return (
            <div key={msg.id}>
              {msg.type === 'system' || msg.type === 'service_request' ? (
                <div className="flex justify-center">
                  <div className={`px-4 py-2 rounded-lg text-sm ${
                    msg.systemType === 'waiting' || msg.type === 'service_request' ? 'bg-yellow-50 text-yellow-800' :
                    msg.systemType === 'accepted' ? 'bg-green-50 text-green-800' :
                    msg.systemType === 'rejected' ? 'bg-red-50 text-red-800' :
                    'bg-gray-50 text-gray-800'
                  }`}>
                    {msg.text}
                    {msg.type === 'service_request' && shouldShowAcceptButtons() && (
                      <div className="flex justify-center gap-2 mt-2">
                        <button
                          onClick={handleAcceptService}
                          className="px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          Accetta
                        </button>
                        <button
                          onClick={handleRejectService}
                          className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          Rifiuta
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <MessageItem
                  {...msg}
                  senderPhoto={msg.isMe ? currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || '')}&background=random` : chat.photoURL}
                  senderName={msg.isMe ? currentUser?.displayName || '' : chat.name}
                  onDelete={deleteMessage}
                  isGroupChat={chatData?.type === 'group'}
                  isAdmin={chatData?.groupAdmins?.includes(currentUser?.uid)}
                  isGroupCreator={chatData?.groupCreator === currentUser?.uid}
                />
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {shouldShowInputArea() && (
        <div className="absolute bottom-[53px] left-0 right-0 theme-bg-primary border-t theme-divide">
          <form onSubmit={handleSendMessage} className="p-1.5 sm:p-2 -translate-y-[5px]">
            <div className={`flex items-center gap-2 p-2 theme-bg rounded-lg flex-1`}>
              {!message.trim() && (
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setShowMediaDialog(true)}
                    disabled={isUploading || isRecording}
                    className="w-10 h-10 flex items-center justify-center hover:theme-bg-secondary theme-text hover:theme-text rounded-full transition-colors disabled:opacity-50"
                    title="Allega file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex-1">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Scrivi un messaggio..."
                  className="w-full bg-transparent theme-text focus:outline-none"
                  disabled={isUploading || isRecording}
                />
              </div>

              <div className="flex-shrink-0">
                {message.trim() ? (
                  <button
                    onClick={handleSendMessage}
                    disabled={isUploading || isRecording}
                    className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors disabled:opacity-50"
                    title="Invia messaggio"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAudioRecorder(true)}
                    disabled={isUploading || isRecording}
                    className="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors disabled:opacity-50"
                    title="Registra messaggio vocale"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
      {/* Chat Options */}
      <ChatOptions
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
        chatData={{
          ...chatData,
          type: chatData?.serviceType ? 'service' : chatData?.isGroupChat ? 'group' : 'individual'
        }}
        options={options}
        className="transition-all duration-300 ease-in-out"
      />

      {/* Active Call Overlay */}
      {isCallActive && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
          <img
            src={chat.photoURL}
            alt={chat.name}
            className="w-24 h-24 rounded-full mb-4"
          />
          <h3 className="theme-text text-xl font-semibold mb-2">{chat.name}</h3>
          <p className="theme-text opacity-70 mb-8">Chiamata in corso...</p>
          <button
            onClick={handleEndCall}
            className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
          >
            <Phone className="w-6 h-6 theme-text" />
          </button>
        </div>
      )}

      {showAudioRecorder && (
        <AudioRecordingDialog
          onClose={() => setShowAudioRecorder(false)}
          onSend={handleAudioComplete}
        />
      )}

      {showMediaDialog && (
        <MediaDialog
          onClose={() => setShowMediaDialog(false)}
          onFileSelect={handleMediaSend}
        />
      )}
    </div>
  );
}