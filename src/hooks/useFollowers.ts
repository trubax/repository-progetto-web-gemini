import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

export function useFollowers(userId: string) {
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔄 Inizializzazione listener followers per:', userId);
      const userRef = doc(db, 'users', userId);
      
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          // Usa direttamente gli array following/followers per il conteggio
          const followers = Array.isArray(userData.followers) ? userData.followers : [];
          const following = Array.isArray(userData.following) ? userData.following : [];
          
          setFollowersCount(followers.length);
          setFollowingCount(following.length);
          
          console.log('📊 Aggiornamento contatori:', {
            followersCount: followers.length,
            followingCount: following.length
          });
        }
        setIsLoading(false);
      }, (error) => {
        console.error('❌ Errore nel recupero followers:', error);
        setError('Errore nel caricamento dei followers');
        setIsLoading(false);
      });

      return () => {
        console.log('🧹 Pulizia listener followers');
        unsubscribe();
      };
    } catch (error) {
      console.error('❌ Errore nell\'inizializzazione del listener:', error);
      setError('Errore nel caricamento dei followers');
      setIsLoading(false);
    }
  }, [userId]);

  return {
    followersCount,
    followingCount,
    isLoading,
    error
  };
} 