import { db, auth } from '../firebase';
import { doc, setDoc, deleteDoc, collection, writeBatch, increment, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export async function sendFollowRequest(currentUserId: string, targetUserId: string) {
  if (!currentUserId || !targetUserId) {
    throw new Error('ID utente mancanti');
  }

  try {
    console.log('📨 Invio richiesta di follow:', { currentUserId, targetUserId });

    // Crea un riferimento alla sottocollezione followRequests dell'utente target
    const followRequestRef = doc(
      db,
      'users',
      targetUserId,
      'followRequests',
      currentUserId
    );

    // Ottieni i dati dell'utente che fa la richiesta
    const requesterDoc = await getDoc(doc(db, 'users', currentUserId));
    const requesterData = requesterDoc.data();

    if (!requesterData) {
      throw new Error('Dati utente richiedente non trovati');
    }

    // Salva la richiesta con i dati dell'utente richiedente
    await setDoc(followRequestRef, {
      requestedAt: new Date(),
      requesterId: currentUserId,
      requesterName: requesterData.displayName,
      requesterPhoto: requesterData.photoURL,
      status: 'pending' // pending, accepted, rejected
    });

    console.log('✅ Richiesta di follow inviata con successo');
    return true;
  } catch (error) {
    console.error('❌ Errore nell\'invio della richiesta di follow:', error);
    throw error;
  }
}

export const followUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
  if (!currentUserId || !targetUserId) {
    console.log('🚫 ID mancanti:', { currentUserId, targetUserId });
    throw new Error('ID utente mancanti');
  }

  try {
    console.log('👤 Tentativo di follow:', { currentUserId, targetUserId });
    
    const batch = writeBatch(db);
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    // Verifica esistenza documenti
    const [currentUserDoc, targetUserDoc] = await Promise.all([
      getDoc(currentUserRef),
      getDoc(targetUserRef)
    ]);

    if (!currentUserDoc.exists() || !targetUserDoc.exists()) {
      console.error('❌ Uno o entrambi i documenti utente non trovati');
      return false;
    }

    // Ottieni i dati attuali
    const currentUserData = currentUserDoc.data();
    const following = Array.isArray(currentUserData?.following) ? currentUserData.following : [];
    const isFollowing = following.includes(targetUserId);
    
    console.log('📊 Stato attuale:', { isFollowing, following });

    if (isFollowing) {
      batch.update(currentUserRef, {
        following: arrayRemove(targetUserId)
      });
      batch.update(targetUserRef, {
        followers: arrayRemove(currentUserId)
      });
    } else {
      batch.update(currentUserRef, {
        following: arrayUnion(targetUserId)
      });
      batch.update(targetUserRef, {
        followers: arrayUnion(currentUserId)
      });
    }

    await batch.commit();
    console.log('✅ Batch completato con successo');
    return !isFollowing;
  } catch (error) {
    console.error('❌ Errore durante l\'operazione di follow:', error);
    return false;
  }
};

export async function unfollowUser(targetUserId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Utente non autenticato');

  // Riferimenti ai documenti
  const currentUserRef = doc(db, 'users', currentUser.uid);
  const targetUserRef = doc(db, 'users', targetUserId);
  
  await deleteDoc(doc(db, 'users', currentUser.uid, 'following', targetUserId));
  await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUser.uid));

  // Aggiorna i contatori
  const batch = writeBatch(db);
  batch.update(currentUserRef, {
    'stats.following': increment(-1)
  });
  batch.update(targetUserRef, {
    'stats.followers': increment(-1)
  });
  
  await batch.commit();
}

export async function acceptFollowRequest(targetUserId: string, requesterId: string) {
  if (!targetUserId || !requesterId) {
    throw new Error('ID utente mancanti');
  }

  try {
    console.log('🤝 Accettazione richiesta di follow:', { targetUserId, requesterId });
    
    const batch = writeBatch(db);
    
    // Aggiorna lo stato della richiesta
    const requestRef = doc(db, 'users', targetUserId, 'followRequests', requesterId);
    batch.update(requestRef, {
      status: 'accepted',
      acceptedAt: new Date()
    });

    // Aggiungi il follower alla lista dei followers
    const targetUserRef = doc(db, 'users', targetUserId);
    const requesterRef = doc(db, 'users', requesterId);

    // Aggiorna entrambi i profili per stabilire la relazione di follow
    batch.update(targetUserRef, {
      followers: arrayUnion(requesterId)
    });

    batch.update(requesterRef, {
      following: arrayUnion(targetUserId)
    });

    // Aggiungi il documento che traccia lo stato del follow
    const followStateRef = doc(db, 'users', targetUserId, 'followState', requesterId);
    batch.set(followStateRef, {
      status: 'accepted',
      updatedAt: new Date(),
      isFollowing: true
    });

    await batch.commit();
    console.log('✅ Richiesta di follow accettata con successo');
    return true;
  } catch (error) {
    console.error('❌ Errore nell\'accettazione della richiesta di follow:', error);
    throw error;
  }
}

export async function checkFollowRequestStatus(targetUserId: string, requesterId: string) {
  if (!targetUserId || !requesterId) return null;
  
  try {
    // Controlla prima se c'è già una relazione di follow
    const followStateRef = doc(db, 'users', targetUserId, 'followState', requesterId);
    const followStateDoc = await getDoc(followStateRef);
    
    if (followStateDoc.exists()) {
      return followStateDoc.data().status;
    }
    
    // Se non c'è uno stato di follow, controlla le richieste pendenti
    const requestRef = doc(db, 'users', targetUserId, 'followRequests', requesterId);
    const requestDoc = await getDoc(requestRef);
    
    if (requestDoc.exists()) {
      return requestDoc.data().status || 'pending';
    }
    
    return null;
  } catch (error) {
    console.error('❌ Errore nel controllo dello stato della richiesta:', error);
    return null;
  }
}

export async function checkFollowRequestStatusOld(targetUserId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Utente non autenticato');

  const requestDoc = await getDoc(
    doc(db, 'users', targetUserId, 'followRequests', currentUser.uid)
  );
  
  return requestDoc.exists();
}