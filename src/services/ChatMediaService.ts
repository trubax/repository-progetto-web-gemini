import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import { compressImage } from '../utils/imageCompression';
import { doc, getDoc } from 'firebase/firestore';

interface MediaUploadOptions {
  chatId: string;
  userId: string;
  isGroup: boolean;
  messageType: 'audio' | 'image' | 'video' | 'file';
  fileName?: string;
}

export class ChatMediaService {
  private static instance: ChatMediaService;
  
  static getInstance() {
    if (!ChatMediaService.instance) {
      ChatMediaService.instance = new ChatMediaService();
    }
    return ChatMediaService.instance;
  }

  async processAndUploadMedia(file: File | Blob, options: MediaUploadOptions): Promise<string> {
    // Verifica permessi
    await this.verifyPermissions(options.chatId, options.userId);

    // Verifica dimensione file
    if (file.size > 100 * 1024 * 1024) { // 100MB
      throw new Error('File troppo grande. Massimo 100MB.');
    }

    let processedFile: File | Blob = file;
    let contentType = file instanceof File ? file.type : 'audio/webm';
    
    switch (options.messageType) {
      case 'image':
        processedFile = await this.processImage(file as File);
        break;
      case 'video':
        processedFile = await this.processVideo(file as File);
        break;
      case 'audio':
        processedFile = await this.processAudio(file as Blob);
        contentType = 'audio/webm;codecs=opus';
        break;
    }

    const fileName = options.fileName || `${Date.now()}_${file instanceof File ? file.name : 'audio.webm'}`;
    const path = this.getStoragePath(options.chatId, fileName);
    
    return this.uploadToStorage(processedFile, path, {
      contentType,
      customMetadata: {
        userId: options.userId,
        messageType: options.messageType,
        isGroup: options.isGroup.toString(),
        originalName: file instanceof File ? file.name : 'audio.webm'
      }
    });
  }

  private async verifyPermissions(chatId: string, userId: string): Promise<void> {
    const chatRef = doc(db, 'chats', chatId);
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists()) {
      throw new Error('Chat non trovata');
    }

    const chatData = chatDoc.data();
    if (!chatData.participants.includes(userId)) {
      throw new Error('Non hai i permessi per caricare file in questa chat');
    }
  }

  private getStoragePath(chatId: string, fileName: string): string {
    // Path diretto secondo le regole di storage
    return `chats/${chatId}/${fileName}`;
  }

  private async uploadToStorage(file: File | Blob, path: string, metadata: any): Promise<string> {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, metadata);
      return getDownloadURL(storageRef);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw new Error('Errore nel caricamento del file');
    }
  }

  private async processImage(file: File): Promise<File> {
    if (file.size > 1024 * 1024) { // > 1MB
      return compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8
      });
    }
    return file;
  }

  private async processVideo(file: File): Promise<File> {
    // Per ora ritorniamo il file originale
    // In futuro implementare compressione video
    return file;
  }

  private async processAudio(blob: Blob): Promise<Blob> {
    // Verifica che il blob sia nel formato corretto
    if (!(blob instanceof Blob)) {
      throw new Error('Invalid audio data');
    }
    return blob;
  }

  async deleteMedia(chatId: string, userId: string, mediaUrl: string): Promise<void> {
    try {
      // Verifica permessi
      await this.verifyPermissions(chatId, userId);

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

export default ChatMediaService.getInstance();