import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { followUser, unfollowUser } from '../services/FollowerService';

export function useFollow(targetUserId: string, currentUserId: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    // Controlla se l'utente sta già seguendo o ha una richiesta pendente
    const checkFollowStatus = async () => {
      if (!targetUserId || !currentUserId) return;

      try {
        // Controlla se sta già seguendo
        const followersQuery = query(
          collection(db, 'followers'),
          where('followerId', '==', currentUserId),
          where('followedId', '==', targetUserId)
        );
        const followersSnapshot = await getDocs(followersQuery);
        setIsFollowing(!followersSnapshot.empty);

        // Controlla se c'è una richiesta pendente
        const requestsQuery = query(
          collection(db, 'followRequests'),
          where('followerId', '==', currentUserId),
          where('followedId', '==', targetUserId),
          where('status', '==', 'pending')
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        setIsPending(!requestsSnapshot.empty);
      } catch (error) {
        console.error('Errore nel controllo dello stato del follow:', error);
      }
    };

    checkFollowStatus();
  }, [targetUserId, currentUserId]);

  const handleFollow = async (isPrivate: boolean) => {
    if (!targetUserId || !currentUserId) return;

    try {
      // Usa il FollowerService per gestire il follow
      const result = await followUser(currentUserId, targetUserId, isPrivate);
      
      if (result.status === 'pending') {
        setIsPending(true);
        setIsFollowing(false);
      } else if (result.status === 'following') {
        setIsFollowing(true);
        setIsPending(false);
      }
    } catch (error) {
      console.error('Errore nel follow:', error);
      throw error;
    }
  };

  const handleUnfollow = async () => {
    if (!targetUserId || !currentUserId) return;

    try {
      // Usa il FollowerService per gestire l'unfollow
      await unfollowUser(currentUserId, targetUserId);
      setIsFollowing(false);
      setIsPending(false);
    } catch (error) {
      console.error('Errore nell\'unfollow:', error);
      throw error;
    }
  };

  return {
    isFollowing,
    isPending,
    handleFollow,
    handleUnfollow
  };
}