import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  increment, 
  arrayUnion, 
  arrayRemove,
  Timestamp
} from 'firebase/firestore';
import { NotificationService } from './NotificationService';

export const followUser = async (followerId: string, followedId: string, isPrivateAccount: boolean = false) => {
  try {
    // Verifica che l'utente esista
    const followedUserRef = doc(db, 'users', followedId);
    const followedUserDoc = await getDoc(followedUserRef);
    
    if (!followedUserDoc.exists()) {
      throw new Error('Utente non trovato');
    }

    // Ottieni il nome dell'utente che fa la richiesta per la notifica
    const followerUserRef = doc(db, 'users', followerId);
    const followerUserDoc = await getDoc(followerUserRef);
    const followerName = followerUserDoc.data()?.displayName || 'Utente';
    const followedUserName = followedUserDoc.data()?.displayName || 'Utente';

    // Se è un account privato, crea una richiesta di follow
    if (isPrivateAccount) {
      // Verifica se esiste già una richiesta pendente
      const pendingRequestQuery = query(
        collection(db, 'followRequests'),
        where('followerId', '==', followerId),
        where('followedId', '==', followedId),
        where('status', '==', 'pending')
      );
      
      const existingRequests = await getDocs(pendingRequestQuery);
      if (!existingRequests.empty) {
        throw new Error('Richiesta di follow già inviata');
      }

      // Crea una nuova richiesta di follow
      await addDoc(collection(db, 'followRequests'), {
        followerId,
        followedId,
        followerName,
        followedName: followedUserName,
        status: 'pending',
        timestamp: Timestamp.now()
      });

      // Invia una notifica all'utente target (proprietario dell'account privato)
      const notificationService = NotificationService.getInstance();
      await notificationService.sendFollowRequestNotification(followedId, followerName);

      return { status: 'pending' };
    }

    // Per account pubblici, procedi con il follow diretto
    await updateDoc(followedUserRef, {
      followers: arrayUnion(followerId),
      followersCount: increment(1)
    });

    // Aggiorna il documento dell'utente che segue
    if (!followerUserDoc.exists()) {
      await setDoc(followerUserRef, {
        followers: [],
        followersCount: 0,
        following: [followedId],
        followingCount: 1
      });
    } else {
      await updateDoc(followerUserRef, {
        following: arrayUnion(followedId),
        followingCount: increment(1)
      });
    }

    // Registra la relazione di follow
    await addDoc(collection(db, 'followers'), {
      followerId,
      followedId,
      followerName,
      followedName: followedUserName,
      timestamp: Timestamp.now()
    });

    // Invia una notifica per il nuovo follower
    const notificationService = NotificationService.getInstance();
    await notificationService.sendNewFollowerNotification(followedId, followerName);

    return { status: 'following' };

  } catch (error) {
    console.error('Errore nel seguire l\'utente:', error);
    throw error;
  }
};

export const unfollowUser = async (followerId: string, followedId: string) => {
  try {
    // Rimuovi eventuali richieste di follow pendenti
    const pendingRequestQuery = query(
      collection(db, 'followRequests'),
      where('followerId', '==', followerId),
      where('followedId', '==', followedId)
    );
    
    const pendingRequests = await getDocs(pendingRequestQuery);
    for (const doc of pendingRequests.docs) {
      await deleteDoc(doc.ref);
    }

    // Rimuovi la relazione di follow se esiste
    const followQuery = query(
      collection(db, 'followers'), 
      where('followerId', '==', followerId),
      where('followedId', '==', followedId)
    );
    
    const followDocs = await getDocs(followQuery);
    for (const doc of followDocs.docs) {
      await deleteDoc(doc.ref);
    }

    // Aggiorna i contatori solo se esisteva una relazione di follow
    if (!followDocs.empty) {
      const followedUserRef = doc(db, 'users', followedId);
      await updateDoc(followedUserRef, {
        followersCount: increment(-1),
        followers: arrayRemove(followerId)
      });

      const followerUserRef = doc(db, 'users', followerId);
      await updateDoc(followerUserRef, {
        followingCount: increment(-1),
        following: arrayRemove(followedId)
      });
    }

    return { status: 'unfollowed' };

  } catch (error) {
    console.error('Errore nel smettere di seguire l\'utente:', error);
    throw error;
  }
}; 

export const acceptFollowRequest = async (followerId: string, followedId: string) => {
  try {
    // Trova la richiesta di follow pendente
    const requestQuery = query(
      collection(db, 'followRequests'),
      where('followerId', '==', followerId),
      where('followedId', '==', followedId),
      where('status', '==', 'pending')
    );
    
    const requests = await getDocs(requestQuery);
    if (requests.empty) {
      throw new Error('Richiesta di follow non trovata');
    }

    const requestDoc = requests.docs[0];
    const requestData = requestDoc.data();

    // Aggiorna lo stato della richiesta
    await updateDoc(requestDoc.ref, {
      status: 'accepted',
      acceptedAt: Timestamp.now()
    });

    // Crea la relazione di follow
    await addDoc(collection(db, 'followers'), {
      followerId,
      followedId,
      followerName: requestData.followerName,
      followedName: requestData.followedName,
      timestamp: Timestamp.now()
    });

    // Aggiorna i contatori
    const followedUserRef = doc(db, 'users', followedId);
    await updateDoc(followedUserRef, {
      followersCount: increment(1),
      followers: arrayUnion(followerId)
    });

    const followerUserRef = doc(db, 'users', followerId);
    await updateDoc(followerUserRef, {
      followingCount: increment(1),
      following: arrayUnion(followedId)
    });

    // Invia una notifica all'utente che ha fatto la richiesta
    const notificationService = NotificationService.getInstance();
    await notificationService.sendFollowRequestAcceptedNotification(followerId, followedId);

    return { status: 'accepted' };

  } catch (error) {
    console.error('Errore nell\'accettare la richiesta di follow:', error);
    throw error;
  }
};

export const rejectFollowRequest = async (followerId: string, followedId: string) => {
  try {
    const requestQuery = query(
      collection(db, 'followRequests'),
      where('followerId', '==', followerId),
      where('followedId', '==', followedId),
      where('status', '==', 'pending')
    );
    
    const requests = await getDocs(requestQuery);
    if (requests.empty) {
      throw new Error('Richiesta di follow non trovata');
    }

    // Aggiorna lo stato della richiesta
    const requestDoc = requests.docs[0];
    await updateDoc(requestDoc.ref, {
      status: 'rejected',
      rejectedAt: Timestamp.now()
    });

    // Invia una notifica all'utente che ha fatto la richiesta
    const notificationService = NotificationService.getInstance();
    await notificationService.sendFollowRequestRejectedNotification(followerId, followedId);

    return { status: 'rejected' };

  } catch (error) {
    console.error('Errore nel rifiutare la richiesta di follow:', error);
    throw error;
  }
};