import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, collection, query, where, onSnapshot, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';

export const useFollowerManagement = (userId: string) => {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ascolta le richieste di follow pendenti
      const requestsRef = collection(db, 'users', userId, 'followRequests');
      const q = query(requestsRef, where('status', '==', 'pending'));

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setPendingRequests(requests);
          setLoading(false);
        },
        (error) => {
          console.error('Errore nel caricamento delle richieste:', error);
          setError('Errore nel caricamento delle richieste');
          setLoading(false);
        }
      );

      return () => {
        unsubscribe();
        setLoading(false);
      };
    } catch (error) {
      console.error('Errore nell\'inizializzazione del listener:', error);
      setError('Errore nel caricamento delle richieste');
      setLoading(false);
    }
  }, [userId]);

  const acceptFollowRequest = async (requesterId: string) => {
    try {
      const batch = writeBatch(db);

      // Aggiorna lo stato della richiesta
      const requestRef = doc(db, 'users', userId, 'followRequests', requesterId);
      batch.update(requestRef, {
        status: 'accepted',
        acceptedAt: new Date()
      });

      // Aggiungi il follower alla lista dei followers
      const userRef = doc(db, 'users', userId);
      batch.update(userRef, {
        followers: arrayUnion(requesterId)
      });

      // Aggiungi l'utente alla lista following del richiedente
      const requesterRef = doc(db, 'users', requesterId);
      batch.update(requesterRef, {
        following: arrayUnion(userId)
      });

      // Aggiorna lo stato del follow
      const followStateRef = doc(db, 'users', userId, 'followState', requesterId);
      batch.set(followStateRef, {
        status: 'accepted',
        updatedAt: new Date(),
        isFollowing: true
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Errore nell\'accettazione della richiesta:', error);
      return false;
    }
  };

  const rejectFollowRequest = async (requesterId: string) => {
    try {
      const batch = writeBatch(db);

      // Aggiorna lo stato della richiesta a rejected
      const requestRef = doc(db, 'users', userId, 'followRequests', requesterId);
      batch.update(requestRef, {
        status: 'rejected',
        rejectedAt: new Date()
      });

      // Rimuovi lo stato del follow
      const followStateRef = doc(db, 'users', userId, 'followState', requesterId);
      batch.delete(followStateRef);

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Errore nel rifiuto della richiesta:', error);
      return false;
    }
  };

  return {
    pendingRequests,
    loading,
    error,
    acceptFollowRequest,
    rejectFollowRequest
  };
};
