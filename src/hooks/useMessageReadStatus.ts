import { useEffect } from 'react';
import { doc, updateDoc, writeBatch, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useMessageReadStatus(chatId: string | null) {
  const { currentUser } = useAuth();

  // Gestisce la lettura dei messaggi quando l'utente è nella chat
  useEffect(() => {
    if (!chatId || !currentUser) return;

    const currentPath = window.location.pathname;
    const isInChat = currentPath.includes(`/chat/${chatId}`) || currentPath.includes(`/messages/${chatId}`);

    if (isInChat) {
      const batch = writeBatch(db);
      const messageRef = doc(db, 'messages', chatId);

      // Marca il messaggio come letto
      batch.update(messageRef, {
        readBy: arrayUnion(currentUser.uid),
        [`readTimestamps.${currentUser.uid}`]: serverTimestamp()
      });

      batch.commit().catch(console.error);
    }
  }, [chatId, currentUser, window.location.pathname]);

  // Funzione per marcare manualmente un messaggio come letto
  const markMessageAsRead = async (messageId: string) => {
    if (!currentUser) return;

    const messageRef = doc(db, 'messages', messageId);
    await updateDoc(messageRef, {
      readBy: arrayUnion(currentUser.uid),
      [`readTimestamps.${currentUser.uid}`]: serverTimestamp()
    });
  };

  return { markMessageAsRead };
}
