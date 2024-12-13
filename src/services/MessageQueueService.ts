import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import P2PMessageService from './P2PMessageService';

interface QueuedMessage {
  id?: string;
  chatId: string;
  type: 'text' | 'image' | 'audio' | 'file';
  content: any;
  sender: string;
  timestamp: number;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  retryCount: number;
  localId: string;
  messageId?: string;
  error?: string;
}

class MessageQueueService {
  private static instance: MessageQueueService;
  private isProcessing: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 secondi

  private constructor() {
    this.startQueueProcessor();
  }

  static getInstance(): MessageQueueService {
    if (!MessageQueueService.instance) {
      MessageQueueService.instance = new MessageQueueService();
    }
    return MessageQueueService.instance;
  }

  async queueMessage(message: Omit<QueuedMessage, 'id' | 'status' | 'retryCount'>): Promise<string> {
    try {
      // Salva il messaggio nella coda locale (Firestore)
      const queuedMessage: QueuedMessage = {
        ...message,
        status: 'queued',
        retryCount: 0,
        localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Aggiungi alla collezione messageQueue in Firestore
      const queueRef = collection(db, 'messageQueue');
      const docRef = await addDoc(queueRef, queuedMessage);

      // Aggiungi immediatamente alla UI
      await this.addMessageToChat(queuedMessage);

      // Avvia il processore della coda se non è già in esecuzione
      if (!this.isProcessing) {
        this.startQueueProcessor();
      }

      return queuedMessage.localId;
    } catch (error) {
      console.error('Error queuing message:', error);
      throw error;
    }
  }

  private async addMessageToChat(message: QueuedMessage) {
    try {
      // Aggiungi il messaggio alla chat con stato "in attesa"
      const messageRef = await addDoc(collection(db, 'chats', message.chatId, 'messages'), {
        id: message.localId,
        type: message.type,
        content: message.content,
        sender: message.sender,
        timestamp: message.timestamp,
        status: message.status,
        isLocal: true,
        retryCount: message.retryCount,
        error: null
      });

      // Aggiorna l'ID del messaggio nel documento della coda
      const queueRef = collection(db, 'messageQueue');
      const q = query(queueRef, where('localId', '==', message.localId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, {
          messageId: messageRef.id
        });
      }

    } catch (error) {
      console.error('Error adding message to chat:', error);
      throw error;
    }
  }

  private async startQueueProcessor() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      try {
        // Recupera i messaggi in coda
        const queueRef = collection(db, 'messageQueue');
        const q = query(queueRef, where('status', 'in', ['queued', 'failed']));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          // Se non ci sono messaggi in coda, interrompi il processore
          this.isProcessing = false;
          break;
        }

        // Processa ogni messaggio
        for (const doc of snapshot.docs) {
          const message = doc.data() as QueuedMessage;

          if (message.retryCount >= this.maxRetries) {
            // Se superato il numero massimo di tentativi, marca come fallito definitivamente
            await this.markMessageAsFailed(doc.id, message);
            continue;
          }

          try {
            // Verifica la connessione prima di inviare
            const connectionState = P2PMessageService.getConnectionState(message.chatId);

            if (connectionState === 'disconnected') {
              // Se non c'è connessione, incrementa il contatore dei tentativi
              await this.updateRetryCount(doc.id, message);
              continue;
            }

            // Tenta di inviare il messaggio
            const status = await P2PMessageService.sendMessage(message.chatId, {
              type: message.type,
              content: message.content,
              sender: message.sender
            });

            if (status === 'sent') {
              // Se l'invio ha successo, rimuovi dalla coda e aggiorna lo stato nella chat
              await this.removeFromQueue(doc.id, message);
            } else {
              // Se il messaggio è in coda, aggiorna lo stato
              await this.updateMessageStatus(doc.id, message, 'queued');
            }
          } catch (error) {
            console.error('Error sending message:', error);
            // Incrementa il contatore dei tentativi e aggiorna lo stato
            await this.updateRetryCount(doc.id, message);
          }
        }

        // Attendi prima del prossimo ciclo
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      } catch (error) {
        console.error('Error in queue processor:', error);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  private async sendMessage(message: QueuedMessage) {
    // Invia il messaggio tramite P2PMessageService
    await P2PMessageService.sendMessage(message.chatId, {
      type: message.type,
      content: message.content,
      sender: message.sender
    });
  }

  private async removeFromQueue(docId: string, message: QueuedMessage) {
    try {
      // Rimuovi dalla coda
      await deleteDoc(doc(db, 'messageQueue', docId));

      // Aggiorna lo stato del messaggio nella chat
      if (message.messageId) {
        await updateDoc(doc(db, 'chats', message.chatId, 'messages', message.messageId), {
          status: 'sent',
          isLocal: false,
          sentAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error removing message from queue:', error);
      throw error;
    }
  }

  private async updateMessageStatus(docId: string, message: QueuedMessage, status: 'queued' | 'sending' | 'sent' | 'failed') {
    try {
      // Aggiorna lo stato nella coda
      await updateDoc(doc(db, 'messageQueue', docId), {
        status
      });

      // Aggiorna lo stato nella chat
      if (message.messageId) {
        await updateDoc(doc(db, 'chats', message.chatId, 'messages', message.messageId), {
          status,
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  private async markMessageAsFailed(docId: string, message: QueuedMessage) {
    try {
      const error = 'Impossibile inviare il messaggio dopo multipli tentativi';

      // Aggiorna lo stato nella coda
      await updateDoc(doc(db, 'messageQueue', docId), {
        status: 'failed',
        error
      });

      // Aggiorna lo stato nella chat
      if (message.messageId) {
        await updateDoc(doc(db, 'chats', message.chatId, 'messages', message.messageId), {
          status: 'failed',
          error,
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error marking message as failed:', error);
    }
  }

  private async updateRetryCount(docId: string, message: QueuedMessage) {
    try {
      await updateDoc(doc(db, 'messageQueue', docId), {
        retryCount: message.retryCount + 1,
        lastRetry: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating retry count:', error);
    }
  }

  // Metodo per verificare se ci sono messaggi in coda per una specifica chat
  async hasQueuedMessages(chatId: string): Promise<boolean> {
    const queueRef = collection(db, 'messageQueue');
    const q = query(queueRef, where('chatId', '==', chatId));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  // Metodo per ottenere il numero di messaggi in coda per una specifica chat
  async getQueuedMessageCount(chatId: string): Promise<number> {
    const queueRef = collection(db, 'messageQueue');
    const q = query(queueRef, where('chatId', '==', chatId));
    const snapshot = await getDocs(q);
    return snapshot.size;
  }
}

export default MessageQueueService.getInstance();
