import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const useAudioMessage = () => {
  const updateMessageDuration = async (messageId: string, duration: number) => {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        'metadata.duration': duration
      });
    } catch (error) {
      console.error('Error updating audio duration:', error);
    }
  };

  return {
    updateMessageDuration
  };
};
