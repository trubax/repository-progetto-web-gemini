import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, serverTimestamp, setDoc, increment } from 'firebase/firestore';

interface ShareData {
  id: string;
  type: 'video' | 'post';
  title: string;
  thumbnail?: string;
  userId: string;
  sharedAt: Date;
  sharedBy: string;
}

export class ShareService {
  static async shareItem(itemId: string, itemType: 'video' | 'post', userId: string) {
    try {
      const itemRef = doc(db, `${itemType}s`, itemId);
      const itemDoc = await getDoc(itemRef);

      if (!itemDoc.exists()) {
        throw new Error(`${itemType} non trovato`);
      }

      const itemData = itemDoc.data();
      
      // Aggiorna l'array delle condivisioni nel documento principale
      await updateDoc(itemRef, {
        shares: arrayUnion(userId),
        shareCount: increment(1)
      });

      // Aggiorna le statistiche di condivisione
      const statsRef = doc(db, `${itemType}s`, itemId, 'stats', 'shares');
      await setDoc(statsRef, {
        totalShares: increment(1),
        [`shares.${userId}`]: {
          timestamp: serverTimestamp(),
          userId: userId
        }
      }, { merge: true });

      // Crea il record di condivisione
      const shareData: ShareData = {
        id: itemId,
        type: itemType,
        title: itemData.title || itemData.caption || `${itemType} senza titolo`,
        thumbnail: itemData.thumbnailUrl || itemData.imageUrl,
        userId: itemData.userId,
        sharedAt: new Date(),
        sharedBy: userId
      };

      // Aggiorna la cronologia delle condivisioni dell'utente
      const userSharesRef = doc(db, 'users', userId, 'shares', itemId);
      await setDoc(userSharesRef, shareData);

      // Genera l'URL di condivisione
      const shareUrl = `${window.location.origin}/${itemType}/${itemId}`;
      
      return shareUrl;
    } catch (error) {
      console.error('Errore durante la condivisione:', error);
      throw error;
    }
  }

  static async unshareItem(itemId: string, itemType: 'video' | 'post', userId: string) {
    try {
      const itemRef = doc(db, `${itemType}s`, itemId);
      
      // Rimuovi l'utente dall'array delle condivisioni
      await updateDoc(itemRef, {
        shares: arrayRemove(userId),
        shareCount: increment(-1)
      });

      // Rimuovi la statistica di condivisione
      const statsRef = doc(db, `${itemType}s`, itemId, 'stats', 'shares');
      const statsDoc = await getDoc(statsRef);
      if (statsDoc.exists()) {
        const stats = statsDoc.data();
        if (stats.shares && stats.shares[userId]) {
          delete stats.shares[userId];
          await setDoc(statsRef, { shares: stats.shares, totalShares: increment(-1) }, { merge: true });
        }
      }

      // Rimuovi il record di condivisione dell'utente
      const userSharesRef = doc(db, 'users', userId, 'shares', itemId);
      await deleteDoc(userSharesRef);
    } catch (error) {
      console.error('Errore durante la rimozione della condivisione:', error);
      throw error;
    }
  }

  static async getSharedItems(userId: string) {
    try {
      const userSharesRef = collection(db, 'users', userId, 'shares');
      const snapshot = await getDocs(userSharesRef);
      return snapshot.docs.map(doc => doc.data() as ShareData);
    } catch (error) {
      console.error('Errore nel recupero delle condivisioni:', error);
      throw error;
    }
  }
}
