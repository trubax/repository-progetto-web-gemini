import { useState, useCallback } from 'react';

type MediaType = 'camera' | 'microphone' | 'both';

export const useMediaPermissions = () => {
  const [hasAccess, setHasAccess] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const requestAccess = async (type: 'camera' | 'microphone') => {
    try {
      const constraints = {
        audio: type === 'microphone',
        video: type === 'camera'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new Error(`Permesso ${type} negato dall'utente`);
        } else if (error.name === 'NotFoundError') {
          throw new Error(`${type} non trovato sul dispositivo`);
        }
      }
      throw new Error(`Errore nell'accesso a ${type}: ${error}`);
    }
  };

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setHasAccess(false);
    }
  }, [stream]);

  return { hasAccess, requestAccess, stopStream, stream };
}; 