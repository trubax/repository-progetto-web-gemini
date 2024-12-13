import { useState } from 'react';
import { collection, doc, addDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCreateChat } from './useCreateChat';
import type { ChatPreview } from '../components/chat/types';

export function useChatCreation() {
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const { createChatWithMessage } = useCreateChat();

  // Crea una chat per una richiesta di servizio
  const createServiceRequestChat = async (
    serviceOwnerId: string,
    serviceData: {
      id: string;
      name: string;
      category: string;
      message: string;
    }
  ): Promise<ChatPreview> => {
    if (!currentUser) throw new Error('Devi effettuare l\'accesso per inviare una richiesta');
    if (!serviceData.message.trim()) throw new Error('Inserisci un messaggio per la richiesta');

    try {
      setLoading(true);
      
      // Crea la chat base con batch per operazioni atomiche
      const batch = writeBatch(db);
      
      // Crea il documento della chat
      const chatRef = doc(collection(db, 'chats'));
      batch.set(chatRef, {
        type: 'service',
        participants: [currentUser.uid, serviceOwnerId],
        participantsData: {
          [currentUser.uid]: {
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            isAnonymous: currentUser.isAnonymous
          }
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'Richiesta di servizio',
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [serviceOwnerId]: 1
        },
        isVisible: true,
        isGroup: false,
        status: 'pending',
        blocked: true,
        pendingUserId: currentUser.uid,
        serviceId: serviceData.id,
        serviceName: serviceData.name,
        serviceCategory: serviceData.category,
        serviceRequest: {
          serviceId: serviceData.id,
          serviceName: serviceData.name,
          serviceCategory: serviceData.category,
          status: 'pending',
          senderId: currentUser.uid,
          serviceOwnerId: serviceOwnerId,
          message: serviceData.message
        }
      });

      // Crea il messaggio di richiesta
      const requestMessageRef = doc(collection(db, `chats/${chatRef.id}/messages`));
      batch.set(requestMessageRef, {
        text: serviceData.message.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: serverTimestamp(),
        readBy: [],
        deliveredTo: [currentUser.uid],
        readTimestamps: {},
        type: 'serviceRequest',
        serviceRequest: {
          serviceId: serviceData.id,
          serviceName: serviceData.name,
          serviceCategory: serviceData.category,
          status: 'pending'
        }
      });

      // Crea il messaggio di sistema per il richiedente
      const requesterMessageRef = doc(collection(db, `chats/${chatRef.id}/messages`));
      batch.set(requesterMessageRef, {
        text: 'In attesa che il proprietario del servizio accetti la richiesta...',
        senderId: 'system',
        timestamp: serverTimestamp(),
        type: 'system',
        systemType: 'waiting',
        visibleTo: [currentUser.uid],
        serviceRequest: {
          serviceId: serviceData.id,
          status: 'pending'
        }
      });

      // Crea il messaggio di sistema per il proprietario
      const ownerMessageRef = doc(collection(db, `chats/${chatRef.id}/messages`));
      batch.set(ownerMessageRef, {
        text: 'Nuova richiesta di servizio. Accetta per iniziare la conversazione.',
        senderId: 'system',
        timestamp: serverTimestamp(),
        type: 'system',
        systemType: 'action',
        visibleTo: [serviceOwnerId],
        actions: [{
          type: 'accept',
          label: 'Accetta'
        }, {
          type: 'reject',
          label: 'Rifiuta'
        }],
        serviceRequest: {
          serviceId: serviceData.id,
          status: 'pending'
        }
      });

      await batch.commit();

      // Costruisci e ritorna la preview della chat
      return {
        id: chatRef.id,
        name: serviceData.name,
        lastMessage: 'Richiesta di servizio',
        timestamp: 'Adesso',
        unread: 0,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(serviceData.name)}&background=random`,
        serviceRequest: {
          serviceId: serviceData.id,
          serviceName: serviceData.name,
          serviceCategory: serviceData.category,
          status: 'pending',
          senderId: currentUser.uid,
          recipientId: serviceOwnerId
        }
      };
    } catch (error: any) {
      console.error('Error creating service request chat:', error);
      throw new Error(error.message || 'Errore nella creazione della richiesta');
    } finally {
      setLoading(false);
    }
  };

  // Crea una chat dal profilo utente
  const createProfileChat = async (
    userId: string,
    message: string,
    requiresFollowing: boolean = false
  ): Promise<ChatPreview> => {
    if (!currentUser) throw new Error('Devi effettuare l\'accesso per inviare un messaggio');
    if (!message.trim()) throw new Error('Inserisci un messaggio');

    try {
      setLoading(true);
      
      // Crea la chat base
      const chatPreview = await createChatWithMessage(userId, message);

      if (requiresFollowing) {
        // Aggiorna lo stato della chat come bloccata fino all'accettazione
        const chatRef = doc(db, 'chats', chatPreview.id);
        await updateDoc(chatRef, {
          status: 'pending',
          blocked: true,
          pendingUserId: currentUser.uid
        });

        // Invia un messaggio di sistema
        const messagesRef = collection(db, 'messages');
        await addDoc(messagesRef, {
          chatId: chatPreview.id,
          type: 'system',
          text: 'In attesa che l\'utente accetti la richiesta di messaggio...',
          timestamp: serverTimestamp(),
          systemType: 'waiting'
        });

        return {
          ...chatPreview,
          blocked: true,
          status: 'pending'
        };
      }

      return chatPreview;
    } catch (error: any) {
      console.error('Error creating profile chat:', error);
      throw new Error(error.message || 'Errore nell\'invio del messaggio');
    } finally {
      setLoading(false);
    }
  };

  // Crea una chat dalla videochat P2P
  const createP2PVideoChat = async (
    userId: string,
    message: string,
    videoData: {
      sessionId: string;
      duration: number;
    }
  ): Promise<ChatPreview> => {
    if (!currentUser) throw new Error('Devi effettuare l\'accesso per inviare un messaggio');

    try {
      setLoading(true);
      
      // Crea la chat base
      const chatPreview = await createChatWithMessage(userId, message);

      // Aggiungi i dati della sessione video
      const chatRef = doc(db, 'chats', chatPreview.id);
      await updateDoc(chatRef, {
        videoSession: {
          id: videoData.sessionId,
          duration: videoData.duration,
          timestamp: serverTimestamp()
        }
      });

      // Invia un messaggio di sistema con i dettagli della chiamata
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        chatId: chatPreview.id,
        type: 'system',
        text: `Videochat terminata - Durata: ${Math.floor(videoData.duration / 60)}:${(videoData.duration % 60).toString().padStart(2, '0')}`,
        timestamp: serverTimestamp(),
        systemType: 'video',
        videoData: {
          sessionId: videoData.sessionId,
          duration: videoData.duration
        }
      });

      return chatPreview;
    } catch (error: any) {
      console.error('Error creating P2P video chat:', error);
      throw new Error(error.message || 'Errore nella creazione della chat video');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    createServiceRequestChat,
    createProfileChat,
    createP2PVideoChat
  };
}
