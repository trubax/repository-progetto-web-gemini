import { useState } from 'react';
import { collection, setDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { ChatPreview } from '../components/chat/types';
import { v4 as uuidv4 } from 'uuid';

export function useCreateGroupChat() {
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  const createGroupChat = async (name: string, participantIds: string[]): Promise<ChatPreview> => {
    if (!currentUser) throw new Error('Devi effettuare l\'accesso per creare un gruppo');
    if (participantIds.length < 2) throw new Error('Seleziona almeno 2 partecipanti');
    
    try {
      setLoading(true);

      // Generate a unique group ID with a prefix
      const groupId = `group_${uuidv4()}`;

      // Add current user to participants if not already included
      const allParticipants = [currentUser.uid, ...participantIds.filter(id => id !== currentUser.uid)];

      // Get participant details
      const participantDetails = await Promise.all(
        allParticipants.map(async (id) => {
          const userDoc = await getDoc(doc(db, 'users', id));
          const userData = userDoc.data();
          if (!userData) throw new Error(`Utente ${id} non trovato`);
          return {
            id,
            ...userData
          };
        })
      );

      // Create chat document with the custom group ID
      const chatRef = doc(db, 'chats', groupId);
      await setDoc(chatRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        name,
        isGroup: true,
        participants: allParticipants,
        participantsData: Object.fromEntries(
          participantDetails.map(p => [
            p.id,
            {
              displayName: p.displayName,
              photoURL: p.photoURL,
              isAnonymous: p.isAnonymous
            }
          ])
        ),
        unreadCount: Object.fromEntries(
          allParticipants.map(id => [id, 0])
        ),
        lastMessage: 'Gruppo creato',
        lastMessageTime: serverTimestamp(),
        createdBy: currentUser.uid,
        groupAdmins: [currentUser.uid]
      });

      // Create first system message
      const messagesRef = collection(chatRef, 'messages');
      await setDoc(doc(messagesRef), {
        text: 'Gruppo creato',
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: serverTimestamp(),
        type: 'system',
        systemType: 'info'
      });

      return {
        id: groupId,
        name,
        lastMessage: 'Gruppo creato',
        lastMessageTime: new Date(),
        unreadCount: 0,
        participants: allParticipants,
        isGroup: true,
        groupAdmins: [currentUser.uid],
        createdBy: currentUser.uid
      };
    } catch (error) {
      console.error('Errore durante la creazione del gruppo:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createGroupChat,
    loading
  };
}