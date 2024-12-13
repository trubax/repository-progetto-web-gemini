import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useSessionManager() {
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    let hasUnloaded = false;

    // Funzione per aggiornare lo stato online
    const updateOnlineStatus = async (status: 'online' | 'offline') => {
      if (hasUnloaded) return; // Previeni aggiornamenti multipli

      try {
        await updateDoc(userDocRef, {
          status,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    };

    // Gestisci cambio visibilità pagina
    const handleVisibilityChange = () => {
      const status = document.visibilityState === 'visible' ? 'online' : 'offline';
      updateOnlineStatus(status);
    };

    // Gestisci chiusura finestra/tab
    const handleUnload = () => {
      hasUnloaded = true;
      // Usa sendBeacon per garantire l'invio dei dati
      const data = JSON.stringify({
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
      navigator.sendBeacon(`/api/users/${currentUser.uid}/status`, data);
    };

    // Imposta stato iniziale
    updateOnlineStatus('online');

    // Aggiungi event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload, { once: true });

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      if (!hasUnloaded) {
        updateOnlineStatus('offline');
      }
    };
  }, [currentUser]);
} 