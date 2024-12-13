import { db } from '@/firebase';
import { doc, getDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';

export const followUser = async (currentUserId: string, targetUserId: string) => {
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

    if (!currentUserDoc.exists()) {
      console.error('❌ Documento utente corrente non trovato');
      throw new Error('Utente corrente non trovato');
    }

    if (!targetUserDoc.exists()) {
      console.error('❌ Documento utente target non trovato');
      throw new Error('Utente target non trovato');
    }

    // Ottieni i dati attuali
    const currentUserData = currentUserDoc.data();
    const targetUserData = targetUserDoc.data();

    // Inizializza gli array se non esistono
    const following = Array.isArray(currentUserData?.following) ? currentUserData.following : [];
    const followers = Array.isArray(targetUserData?.followers) ? targetUserData.followers : [];

    const isFollowing = following.includes(targetUserId);
    
    console.log('📊 Stato attuale:', { isFollowing, following, followers });

    try {
      if (isFollowing) {
        console.log('🔄 Rimozione follow...');
        batch.update(currentUserRef, {
          following: arrayRemove(targetUserId)
        });
        batch.update(targetUserRef, {
          followers: arrayRemove(currentUserId)
        });
      } else {
        console.log('🔄 Aggiunta follow...');
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
      console.error('❌ Errore durante il batch:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ Errore durante l\'operazione di follow:', error);
    throw error;
  }
}; 