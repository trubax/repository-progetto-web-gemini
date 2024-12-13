import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function createPost(userId: string, postData: {
  imageUrl: string;
  caption: string;
}) {
  if (!userId) throw new Error('UserId non fornito');
  
  console.log('Creazione post per userId:', userId); // Debug
  
  try {
    // Percorso esatto dove viene creato il post
    const postsRef = collection(db, 'users', userId, 'posts');
    console.log('Percorso creazione post:', `users/${userId}/posts`); // Debug

    const newPost = {
      ...postData,
      userId,
      createdAt: serverTimestamp(),
      likes: 0,
      comments: 0
    };

    const docRef = await addDoc(postsRef, newPost);
    console.log('Post creato con ID:', docRef.id); // Debug
    
    return docRef.id;
  } catch (error) {
    console.error('Errore nella creazione del post:', error);
    throw error;
  }
} 