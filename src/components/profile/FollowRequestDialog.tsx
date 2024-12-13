import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/Dialog';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { UserCheck, UserX } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

interface FollowRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterPhoto: string;
  requestedAt: Date;
}

interface FollowRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FollowRequestDialog({ isOpen, onClose }: FollowRequestDialogProps) {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const requestsRef = collection(db, 'users', currentUser.uid, 'followRequests');
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      const newRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date()
      })) as FollowRequest[];
      
      setRequests(newRequests);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAccept = async (request: FollowRequest) => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);
      
      // Verifica che l'utente sia ancora privato
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const isPrivate = userDoc.data()?.isPrivate;

      if (!isPrivate) {
        console.warn('Account non più privato, la richiesta verrà rimossa');
        const requestRef = doc(db, 'users', currentUser.uid, 'followRequests', request.requesterId);
        await deleteDoc(requestRef);
        return;
      }

      // Aggiungi il follower
      const followerRef = doc(db, 'users', currentUser.uid, 'followers', request.requesterId);
      batch.set(followerRef, {
        followedAt: new Date(),
        approved: true
      });

      // Aggiungi ai following dell'altro utente
      const followingRef = doc(db, 'users', request.requesterId, 'following', currentUser.uid);
      batch.set(followingRef, {
        followedAt: new Date(),
        approved: true
      });

      // Rimuovi la richiesta
      const requestRef = doc(db, 'users', currentUser.uid, 'followRequests', request.requesterId);
      batch.delete(requestRef);

      await batch.commit();
    } catch (error) {
      console.error('Errore nell\'accettare la richiesta:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (request: FollowRequest) => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);

      // Rimuovi la richiesta
      const requestRef = doc(db, 'users', currentUser.uid, 'followRequests', request.requesterId);
      batch.delete(requestRef);

      // Aggiorna lo stato del following dell'altro utente
      const followingRef = doc(db, 'users', request.requesterId, 'following', currentUser.uid);
      batch.delete(followingRef);

      await batch.commit();
    } catch (error) {
      console.error('Errore nel rifiutare la richiesta:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md theme-bg-primary">
        <DialogHeader>
          <DialogTitle className="theme-text">Richieste di follow</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
          {requests.length === 0 ? (
            <p className="text-center theme-text-secondary">Nessuna richiesta di follow</p>
          ) : (
            requests.map((request) => (
              <div 
                key={request.id} 
                className="flex items-center justify-between p-3 rounded-lg theme-bg-secondary"
              >
                <div className="flex items-center space-x-3">
                  <Avatar src={request.requesterPhoto} fallback={request.requesterName[0]} />
                  <div>
                    <p className="font-medium theme-text">{request.requesterName}</p>
                    <p className="text-sm theme-text-secondary">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAccept(request)}
                    disabled={loading}
                    className="p-2 rounded-full hover:theme-bg-primary transition-colors"
                    title="Accetta richiesta"
                  >
                    <UserCheck className="w-5 h-5 text-green-500" />
                  </button>
                  <button
                    onClick={() => handleReject(request)}
                    disabled={loading}
                    className="p-2 rounded-full hover:theme-bg-primary transition-colors"
                    title="Rifiuta richiesta"
                  >
                    <UserX className="w-5 h-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            OK
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
