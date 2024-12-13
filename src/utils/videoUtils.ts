import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function generateVideoThumbnail(videoFile: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof videoFile === 'string') {
      // Se è già un URL, lo restituiamo direttamente
      resolve(videoFile);
      return;
    }

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    video.onloadeddata = async () => {
      try {
        // Impostiamo le dimensioni del canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Andiamo a 1 secondo nel video per evitare il frame nero
        video.currentTime = 1;
      } catch (error) {
        reject(error);
      }
    };

    video.onseeked = async () => {
      try {
        // Disegniamo il frame corrente sul canvas
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convertiamo il canvas in un blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob as Blob);
          }, 'image/jpeg', 0.7);
        });

        // Carichiamo il blob su Firebase Storage
        const thumbnailRef = ref(storage, `thumbnails/${Date.now()}.jpg`);
        await uploadBytes(thumbnailRef, blob);
        const thumbnailUrl = await getDownloadURL(thumbnailRef);

        resolve(thumbnailUrl);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error("Errore nel caricamento del video"));
    };

    // Se è un File, creiamo un URL temporaneo
    video.src = URL.createObjectURL(videoFile);
  });
}

export function getVideoThumbnail(url: string, fallbackUrl?: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    
    video.onloadeddata = () => {
      resolve(url);
    };

    video.onerror = () => {
      resolve(fallbackUrl || '/placeholder-video.png');
    };

    video.src = url;
  });
} 