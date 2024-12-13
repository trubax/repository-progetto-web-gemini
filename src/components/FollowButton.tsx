import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { followUser, unfollowUser } from '../lib/follow';

interface FollowButtonProps {
  targetUserId: string;
}

export function FollowButton({ targetUserId }: FollowButtonProps) {
  const { currentUser } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRequestPending, setHasRequestPending] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // Controlla lo stato del follow e se l'account è privato
  useEffect(() => {
    const checkStatus = async () => {
      if (!currentUser) return;
      
      try {
        // Controlla se stiamo già seguendo l'utente
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const following = userDoc.data()?.following || [];
        setIsFollowing(following.includes(targetUserId));

        // Controlla se abbiamo una richiesta in sospeso
        const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
        const followRequests = targetUserDoc.data()?.followRequests || [];
        setHasRequestPending(followRequests.includes(currentUser.uid));

        // Controlla se l'account è privato
        const privacyDoc = await getDoc(doc(db, 'users', targetUserId, 'settings', 'privacy'));
        setIsPrivate(privacyDoc.data()?.accountType === 'private');
      } catch (error) {
        console.error('Errore nel controllo dello stato:', error);
      }
    };

    checkStatus();
  }, [currentUser, targetUserId]);

  const handleClick = async () => {
    if (!currentUser) return;
    
    try {
      setIsLoading(true);

      if (isFollowing) {
        // Rimuovi il follow
        await unfollowUser(currentUser.uid, targetUserId);
        setIsFollowing(false);
        setHasRequestPending(false);
      } else if (isPrivate && !hasRequestPending) {
        // Invia richiesta di follow per account privato
        const targetUserRef = doc(db, 'users', targetUserId);
        await updateDoc(targetUserRef, {
          followRequests: arrayUnion(currentUser.uid)
        });
        setHasRequestPending(true);
      } else if (!isPrivate) {
        // Segui direttamente per account pubblico
        await followUser(currentUser.uid, targetUserId);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Errore durante l\'operazione:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser || currentUser.uid === targetUserId) return null;

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`px-4 py-2 rounded-lg transition-colors ${
        isFollowing
          ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
          : hasRequestPending
          ? 'bg-gray-500 text-white cursor-not-allowed'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      }`}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : isFollowing ? (
        'Non seguire più'
      ) : hasRequestPending ? (
        'Richiesta inviata'
      ) : (
        'Segui'
      )}
    </button>
  );
}