import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { 
  collection, 
  doc,
  onSnapshot, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy,
  addDoc,
  where,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  arrayUnion,
  limit,
  increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { EncryptionService } from '../services/EncryptionService';
import { NotificationService } from '../services/NotificationService';

interface Message {
  id: string;
  text: string;
  timestamp: any;
  senderId: string;
  senderName?: string;
  senderPhotoURL?: string;
  isMe: boolean;
  encrypted?: string;
  nonce?: string;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'audio' | 'document';
  fileName?: string;
  deletedFor?: { [key: string]: boolean };
  readBy?: string[];
  deliveredTo?: string[];
  readTimestamps?: { [key: string]: any };
  type?: string;
  systemType?: string;
  visibleTo?: string[];
  actions?: any;
  serviceRequest?: any;
  isGroupChat?: boolean;
  groupParticipants?: any;
}

interface MessageMetadata {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
}

interface ChatOptions {
  isBlocked: boolean;
  messageTimer: number;
  screenshotPrevention: boolean;
  recipientPublicKey?: string;
  unreadCount?: { [key: string]: number };
  isGroupChat?: boolean;
  groupName?: string;
  groupPhoto?: string;
  groupAdmins?: string[];
  groupCreator?: string;
  participants?: string[];
  participantsData?: any;
}

export function useChat(chatId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ChatOptions>({
    isBlocked: false,
    messageTimer: 0,
    screenshotPrevention: false
  });
  const [recipientStatus, setRecipientStatus] = useState<{
    status: 'online' | 'offline' | 'typing';
    lastSeen?: Date;
  }>({ status: 'offline' });
  const { currentUser } = useAuth();

  // Inizializza i servizi una sola volta all'inizio
  const encryptionService = EncryptionService.getInstance();
  const notificationService = NotificationService.getInstance();

  // Aggiungiamo uno state locale per tracciare se siamo nella chat
  const [isInChat, setIsInChat] = useState(false);

  useEffect(() => {
    // Monitora quando entriamo/usciamo dalla chat
    if (!chatId || !currentUser) return;

    const currentPath = window.location.pathname;
    const newIsInChat = currentPath.includes(`/chat/${chatId}`) || currentPath.includes(`/messages/${chatId}`);
    
    // Se lo stato della chat è cambiato
    if (newIsInChat !== isInChat) {
      setIsInChat(newIsInChat);

      // Se siamo entrati nella chat, azzera il contatore e marca i messaggi come letti
      if (newIsInChat) {
        const chatRef = doc(db, 'chats', chatId);
        updateDoc(chatRef, {
          [`unreadCount.${currentUser.uid}`]: 0
        }).catch(err => console.error('Errore azzeramento contatore:', err));

        // Marca tutti i messaggi non letti come letti
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const unreadQuery = query(
          messagesRef,
          where('readBy', 'not-in', [currentUser.uid]),
          where('senderId', '!=', currentUser.uid)
        );

        getDocs(unreadQuery).then(snapshot => {
          if (snapshot.size > 0) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
              batch.update(doc.ref, {
                readBy: arrayUnion(currentUser.uid),
                readTimestamps: {
                  ...doc.data().readTimestamps,
                  [currentUser.uid]: serverTimestamp()
                }
              });
            });
            batch.commit().catch(err => console.error('Errore aggiornamento stato lettura:', err));
          }
        });
      }
    }
  }, [chatId, currentUser, isInChat]);

  useEffect(() => {
    if (!currentUser || !chatId) return;

    const loadChat = async () => {
      try {
        setLoading(true);
        setError(null);

        // Carica i dati della chat
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        
        if (!chatDoc.exists()) {
          throw new Error('Chat non trovata');
        }

        const chatData = chatDoc.data();
        const isGroupChat = chatData.isGroupChat || false;
        const participants = chatData.participants || [];
        
        // Carica i dati dei partecipanti dal database
        const participantsData: { [key: string]: any } = {};
        if (isGroupChat && participants.length > 0) {
          await Promise.all(participants.map(async (participantId: string) => {
            const userDoc = await getDoc(doc(db, 'users', participantId));
            if (userDoc.exists()) {
              participantsData[participantId] = {
                displayName: userDoc.data().displayName,
                photoURL: userDoc.data().photoURL
              };
            }
          }));
        }

        // Listen for chat options
        const unsubscribeOptions = onSnapshot(chatRef, async (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            
            // Aggiorna i dati dei partecipanti quando cambiano
            if (data.isGroupChat && data.participants) {
              await Promise.all(data.participants.map(async (participantId: string) => {
                const userDoc = await getDoc(doc(db, 'users', participantId));
                if (userDoc.exists()) {
                  participantsData[participantId] = {
                    displayName: userDoc.data().displayName,
                    photoURL: userDoc.data().photoURL
                  };
                }
              }));
            }

            setOptions({
              isBlocked: data.isBlocked || false,
              messageTimer: data.messageTimer || 0,
              screenshotPrevention: data.screenshotPrevention || false,
              recipientPublicKey: data.recipientPublicKey,
              unreadCount: data.unreadCount || {},
              isGroupChat: data.isGroupChat || false,
              groupName: data.groupName,
              groupPhoto: data.groupPhoto,
              groupAdmins: data.groupAdmins || [],
              groupCreator: data.groupCreator,
              participants: data.participants || [],
              participantsData
            });

            // Only set recipient status for individual chats
            if (!data.isGroupChat) {
              const recipientId = data.participants.find((id: string) => id !== currentUser.uid);
              if (recipientId) {
                const recipientRef = doc(db, 'users', recipientId);
                onSnapshot(recipientRef, (userDoc) => {
                  if (userDoc.exists()) {
                    setRecipientStatus({
                      status: userDoc.data()?.status || 'offline',
                      lastSeen: userDoc.data()?.lastSeen?.toDate()
                    });
                  }
                });
              }
            }
          }
          setLoading(false);
        });

        // Listen for messages
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(100));

        const unsubscribeMessages = onSnapshot(messagesQuery, async (snapshot) => {
          try {
            const batch = writeBatch(db);
            const decryptedMessages = await Promise.all(
              snapshot.docs.map(async (docSnapshot) => {
                const data = docSnapshot.data();
                let decryptedText = '';
                
                if (data.encrypted && data.nonce && data.senderPublicKey) {
                  try {
                    decryptedText = await encryptionService.decryptMessage(
                      data.encrypted,
                      data.nonce,
                      data.senderPublicKey
                    );
                  } catch (err) {
                    console.error('Error decrypting message:', err);
                    decryptedText = '[Messaggio criptato]';
                  }
                }

                // Gestione notifiche e conteggio per nuovi messaggi
                if (data.senderId !== currentUser.uid && docSnapshot.metadata.hasPendingWrites) {
                  try {
                    const chatRef = doc(db, 'chats', chatId);
                    
                    if (!isInChat) {
                      // Aggiorna il contatore solo se non siamo nella chat
                      const chatDoc = await getDoc(chatRef);
                      const currentCount = chatDoc.data()?.unreadCount?.[currentUser.uid] || 0;
                      await updateDoc(chatRef, {
                        [`unreadCount.${currentUser.uid}`]: currentCount + 1
                      });

                      // Mostra notifica
                      const senderData = isGroupChat 
                        ? participantsData[data.senderId]
                        : { displayName: data.senderName };

                      await notificationService.showMessageNotification(
                        chatId,
                        senderData?.displayName || 'Nuovo messaggio',
                        decryptedText || data.text
                      );
                    } else {
                      // Se siamo nella chat, marca subito il messaggio come letto
                      batch.update(docSnapshot.ref, {
                        readBy: arrayUnion(currentUser.uid),
                        [`readTimestamps.${currentUser.uid}`]: serverTimestamp()
                      });
                    }
                  } catch (err) {
                    console.error('Errore gestione notifiche:', err);
                  }
                }

                // Aggiorna l'anteprima della chat solo per il messaggio più recente
                if (docSnapshot.id === snapshot.docs[0].id) {
                  await updateDoc(doc(db, 'chats', chatId), {
                    lastMessage: decryptedText || data.text,
                    lastMessageTime: data.timestamp,
                    lastMessageSender: data.senderId,
                    updatedAt: serverTimestamp()
                  });
                }

                // Gestione consegna messaggi
                if (!data.deliveredTo?.includes(currentUser.uid)) {
                  batch.update(docSnapshot.ref, {
                    deliveredTo: arrayUnion(currentUser.uid)
                  });
                }

                return {
                  id: docSnapshot.id,
                  text: decryptedText || data.text,
                  timestamp: data.timestamp,
                  senderId: data.senderId,
                  senderName: participantsData[data.senderId]?.displayName || data.senderName,
                  senderPhotoURL: participantsData[data.senderId]?.photoURL || data.senderPhotoURL,
                  isMe: data.senderId === currentUser.uid,
                  mediaUrl: data.mediaUrl,
                  mediaType: data.mediaType,
                  fileName: data.fileName,
                  deletedFor: data.deletedFor,
                  readBy: data.readBy || [],
                  deliveredTo: data.deliveredTo || [],
                  readTimestamps: data.readTimestamps || {},
                  type: data.type,
                  systemType: data.systemType,
                  visibleTo: data.visibleTo,
                  actions: data.actions,
                  serviceRequest: data.serviceRequest,
                  isGroupChat,
                  groupParticipants: isGroupChat ? participantsData : undefined
                } as Message;
              })
            );

            await batch.commit();
            setMessages(decryptedMessages.filter(Boolean).reverse());
            setError(null);
          } catch (err) {
            console.error('Error processing messages:', err);
            setError('Errore nel processamento dei messaggi');
          }
        });

        return () => {
          unsubscribeOptions();
          unsubscribeMessages();
        };
      } catch (error: any) {
        console.error('Error loading chat:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadChat();
  }, [chatId, currentUser]);

  const resetUnreadCount = async () => {
    if (!currentUser || !chatId) return;
    
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        [`unreadCount.${currentUser.uid}`]: 0
      });
    } catch (err) {
      console.warn('Errore nel reset del contatore:', err);
    }
  };

  const sendMessage = async (text: string, metadata?: MessageMetadata) => {
    if (!currentUser || (!text.trim() && !metadata) || options.isBlocked) return;

    try {
      const chatRef = doc(db, 'chats', chatId);
      const messageData: any = {
        text: text.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: serverTimestamp(),
        readBy: [],
        deliveredTo: [currentUser.uid],
        readTimestamps: {}
      };

      // Aggiungi i metadati del file se presenti
      if (metadata) {
        messageData.type = metadata.type;
        messageData.url = metadata.url;
        messageData.fileName = metadata.fileName;
        messageData.fileSize = metadata.fileSize;
        messageData.mimeType = metadata.mimeType;
        messageData.duration = metadata.duration;
        messageData.metadata = metadata; // Salva tutti i metadati
      }

      if (options.recipientPublicKey) {
        const { encrypted, nonce } = await encryptionService.encryptMessage(
          text.trim(),
          options.recipientPublicKey
        );
        messageData.encrypted = encrypted;
        messageData.nonce = nonce;
        messageData.senderPublicKey = encryptionService.getPublicKey();
      }

      const batch = writeBatch(db);

      // Add message to subcollection
      const messageRef = doc(collection(db, `chats/${chatId}/messages`));
      batch.set(messageRef, messageData);

      // Update chat metadata
      const lastMessage = metadata?.type ? `${metadata.type}: ${metadata.fileName || 'Media'}` : text.trim();
      
      // Aggiorna i contatori di lettura per tutti i partecipanti tranne il mittente
      const unreadUpdates = options.participants?.reduce((acc, participantId) => {
        if (participantId !== currentUser.uid) {
          acc[`unreadCount.${participantId}`] = increment(1);
        }
        return acc;
      }, {} as { [key: string]: any }) || {};

      batch.update(chatRef, {
        lastMessage,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...unreadUpdates,
        isVisible: true
      });

      await batch.commit();
      setError(null);
      return messageRef;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Errore nell\'invio del messaggio');
      throw err;
    }
  };

  const markAsRead = async () => {
    if (!currentUser || !chatId) return;

    try {
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        where('readBy', 'array-contains', currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        if (!doc.data().readBy?.includes(currentUser.uid)) {
          batch.update(doc.ref, {
            readBy: arrayUnion(currentUser.uid),
            readTimestamps: {
              ...doc.data().readTimestamps,
              [currentUser.uid]: serverTimestamp()
            }
          });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    if (!currentUser) return;

    try {
      const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error('Messaggio non trovato');
      }

      const messageData = messageDoc.data();

      // Check permissions for group chats
      if (options.isGroupChat && deleteForEveryone) {
        const isAdmin = options.groupAdmins?.includes(currentUser.uid);
        const isCreator = options.groupCreator === currentUser.uid;
        const isSender = messageData.senderId === currentUser.uid;

        if (!isAdmin && !isCreator && !isSender) {
          throw new Error('Non hai i permessi per eliminare questo messaggio');
        }
      }

      // Check permissions for individual chats
      if (!options.isGroupChat && deleteForEveryone && messageData.senderId !== currentUser.uid) {
        throw new Error('Non hai i permessi per eliminare questo messaggio');
      }

      const batch = writeBatch(db);

      // Delete media file if exists
      if (messageData.mediaUrl) {
        try {
          const fileRef = ref(storage, messageData.mediaUrl);
          await deleteObject(fileRef);
        } catch (error) {
          console.error('Error deleting media file:', error);
        }
      }

      if (deleteForEveryone) {
        // Delete message for everyone
        batch.delete(messageRef);
      } else {
        // Mark message as deleted for current user
        batch.update(messageRef, {
          [`deletedFor.${currentUser.uid}`]: true
        });
      }

      await batch.commit();
      setError(null);
    } catch (err) {
      console.error('Error deleting message:', err);
      setError('Errore durante l\'eliminazione del messaggio');
      throw err;
    }
  };

  const blockUser = async () => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        isBlocked: true,
        updatedAt: serverTimestamp()
      });
      setError(null);
    } catch (err) {
      console.error('Error blocking user:', err);
      setError('Errore durante il blocco dell\'utente');
    }
  };

  const unblockUser = async () => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        isBlocked: false,
        updatedAt: serverTimestamp()
      });
      setError(null);
    } catch (err) {
      console.error('Error unblocking user:', err);
      setError('Errore durante lo sblocco dell\'utente');
    }
  };

  const setMessageTimer = async (seconds: number) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        messageTimer: seconds,
        updatedAt: serverTimestamp()
      });
      setError(null);
    } catch (err) {
      console.error('Error setting message timer:', err);
      setError('Errore durante l\'impostazione del timer');
    }
  };

  const toggleScreenshotPrevention = async () => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        screenshotPrevention: !options.screenshotPrevention,
        updatedAt: serverTimestamp()
      });
      setError(null);
    } catch (err) {
      console.error('Error toggling screenshot prevention:', err);
      setError('Errore durante la modifica delle impostazioni screenshot');
    }
  };

  return {
    messages,
    options,
    loading,
    error,
    recipientStatus,
    blockUser,
    unblockUser,
    setMessageTimer,
    toggleScreenshotPrevention,
    sendMessage,
    markAsRead,
    deleteMessage
  };
}

export default useChat;