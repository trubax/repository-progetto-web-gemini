import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { compressImage } from '../utils/imageCompression';

interface MediaUploadOptions {
  chatId: string;
  userId: string;
  isGroup: boolean;
  isAnonymous: boolean;
  messageType: 'audio' | 'image' | 'video' | 'file';
}

export class MediaHandlerService {
  private static instance: MediaHandlerService;
  
  static getInstance() {
    if (!MediaHandlerService.instance) {
      MediaHandlerService.instance = new MediaHandlerService();
    }
    return MediaHandlerService.instance;
  }

  async processAndUploadMedia(file: File | Blob, options: MediaUploadOptions): Promise<string> {
    try {
      // Verifica permessi
      await this.verifyPermissions(options.chatId, options.userId);

      // Verifica dimensione file
      const fileSize = file instanceof File ? file.size : file.size;
      if (fileSize > 100 * 1024 * 1024) { // 100MB
        throw new Error('File troppo grande. Massimo 100MB.');
      }

      // Processa il file in base al tipo
      const processedFile = await this.processMedia(file, options.messageType);
      
      // Genera il nome del file
      const fileName = file instanceof File ? file.name : `${Date.now()}_${options.messageType}`;
      const fileExtension = fileName.split('.').pop() || this.getDefaultExtension(options.messageType);
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
      
      // Carica il file
      const path = this.getStoragePath(options.chatId, uniqueFileName);
      const contentType = this.getContentType(file, options.messageType);

      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, processedFile, {
        contentType,
        customMetadata: {
          userId: options.userId,
          messageType: options.messageType,
          isGroup: options.isGroup.toString(),
          originalName: fileName,
          fileSize: processedFile.size.toString()
        }
      });

      // Ottieni l'URL di download
      return await getDownloadURL(storageRef);

    } catch (error: any) {
      console.error('Error in processAndUploadMedia:', error);
      throw new Error(error.message || 'Errore nel caricamento del file');
    }
  }

  private getDefaultExtension(type: string): string {
    switch(type) {
      case 'image': return 'jpg';
      case 'audio': return 'webm';
      case 'video': return 'mp4';
      default: return 'bin';
    }
  }

  private getContentType(file: File | Blob, type: string): string {
    if (file instanceof File && file.type) {
      return file.type;
    }
    
    switch(type) {
      case 'image': return 'image/jpeg';
      case 'audio': return 'audio/webm;codecs=opus';
      case 'video': return 'video/mp4';
      default: return 'application/octet-stream';
    }
  }

  private async verifyPermissions(chatId: string, userId: string): Promise<void> {
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        throw new Error('Chat non trovata');
      }

      const chatData = chatDoc.data();
      if (!chatData.participants.includes(userId)) {
        throw new Error('Non hai i permessi per caricare file in questa chat');
      }
    } catch (error: any) {
      console.error('Error verifying permissions:', error);
      throw new Error('Errore nella verifica dei permessi');
    }
  }

  private getStoragePath(chatId: string, fileName: string): string {
    return `chats/${chatId}/media/${fileName}`;
  }

  private async processMedia(file: File | Blob, type: string): Promise<File | Blob> {
    try {
      switch(type) {
        case 'image':
          return await this.processImage(file);
        case 'audio':
          return await this.processAudio(file);
        case 'video':
          return await this.processVideo(file);
        default:
          return file;
      }
    } catch (error) {
      console.error('Error processing media:', error);
      throw new Error('Errore nel processamento del file');
    }
  }

  private async processImage(file: File | Blob): Promise<File | Blob> {
    if (!(file instanceof File)) {
      throw new Error('Invalid image file');
    }

    try {
      // Comprimi solo se l'immagine è più grande di 1MB
      if (file.size > 1024 * 1024) {
        return await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8
        });
      }
      return file;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Errore nel processamento dell\'immagine');
    }
  }

  private async processAudio(blob: Blob): Promise<Blob> {
    try {
      // Verifica che il blob sia nel formato corretto
      if (!(blob instanceof Blob)) {
        throw new Error('Invalid audio data');
      }

      // Verifica il tipo di file
      if (!blob.type.startsWith('audio/')) {
        throw new Error('Invalid audio format');
      }

      // Verifica la dimensione
      if (blob.size > 100 * 1024 * 1024) { // 100MB
        throw new Error('File troppo grande. Massimo 100MB.');
      }

      // Per ora ritorniamo il blob originale
      // In futuro possiamo aggiungere compressione audio
      return new Blob([blob], { type: 'audio/webm;codecs=opus' });
    } catch (error) {
      console.error('Error processing audio:', error);
      throw new Error('Errore nel processamento dell\'audio');
    }
  }

  private async processVideo(file: File | Blob): Promise<File | Blob> {
    try {
      // Per ora ritorniamo il file originale
      // In futuro implementare compressione video
      return file;
    } catch (error) {
      console.error('Error processing video:', error);
      throw new Error('Errore nel processamento del video');
    }
  }

  async deleteMedia(chatId: string, userId: string, mediaUrl: string): Promise<void> {
    try {
      // Verifica permessi
      await this.verifyPermissions(chatId, userId);

      // Estrai il path del file dall'URL
      const storageRef = ref(storage, mediaUrl);
      const metadata = await getMetadata(storageRef);

      // Verifica che l'utente sia il proprietario del file
      if (metadata.customMetadata?.userId !== userId) {
        throw new Error('Non hai i permessi per eliminare questo file');
      }

      // Elimina il file
      await storageRef.delete();
    } catch (error: any) {
      console.error('Error deleting media:', error);
      throw new Error('Errore nell\'eliminazione del file');
    }
  }
}

export default MediaHandlerService.getInstance();