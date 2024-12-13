import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface PeerConnection {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  isConnected: boolean;
  isConnecting: boolean;
  lastAttempt: number;
  retryCount: number;
}

class P2PMessageService {
  private static instance: P2PMessageService;
  private connections: Map<string, PeerConnection> = new Map();
  private messageQueue: Map<string, any[]> = new Map();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000;
  private readonly CONNECTION_TIMEOUT = 20000;
  private isInitialized = false;
  private messageStatusListeners: ((messageId: string, status: string) => void)[] = [];

  private constructor() {
    this.setupConnectionCleanup();
  }

  static getInstance(): P2PMessageService {
    if (!P2PMessageService.instance) {
      P2PMessageService.instance = new P2PMessageService();
    }
    return P2PMessageService.instance;
  }

  private setupConnectionCleanup() {
    // Pulisci le connessioni inattive ogni minuto
    setInterval(() => {
      const now = Date.now();
      this.connections.forEach((conn, peerId) => {
        if (!conn.isConnected && (now - conn.lastAttempt) > this.CONNECTION_TIMEOUT) {
          this.closeConnection(peerId);
        }
      });
    }, 60000);
  }

  private async createPeerConnection(peerId: string): Promise<PeerConnection> {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    const connection: PeerConnection = {
      pc,
      dataChannel: null,
      isConnected: false,
      isConnecting: true,
      lastAttempt: Date.now(),
      retryCount: 0
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        connection.isConnected = true;
        connection.isConnecting = false;
        this.processMessageQueue(peerId);
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        connection.isConnected = false;
        if (connection.retryCount < this.MAX_RETRY_ATTEMPTS) {
          this.retryConnection(peerId);
        }
      }
    };

    pc.ondatachannel = (event) => {
      connection.dataChannel = event.channel;
      this.setupDataChannel(connection.dataChannel, peerId);
    };

    return connection;
  }

  private setupDataChannel(dataChannel: RTCDataChannel, peerId: string) {
    dataChannel.onopen = () => {
      const connection = this.connections.get(peerId);
      if (connection) {
        connection.isConnected = true;
        connection.isConnecting = false;
        this.processMessageQueue(peerId);
      }
    };

    dataChannel.onclose = () => {
      const connection = this.connections.get(peerId);
      if (connection) {
        connection.isConnected = false;
      }
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.retryConnection(peerId);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleIncomingMessage(message, peerId);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
  }

  private async retryConnection(peerId: string) {
    const connection = this.connections.get(peerId);
    if (!connection) return;

    connection.retryCount++;
    connection.lastAttempt = Date.now();
    connection.isConnecting = true;

    if (connection.retryCount > this.MAX_RETRY_ATTEMPTS) {
      this.closeConnection(peerId);
      throw new Error('Connection failed after retry');
    }

    console.log(`Connection attempt ${connection.retryCount} failed, retrying...`);
    
    // Attendi prima di riprovare
    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
    
    try {
      await this.initializeConnection(peerId);
    } catch (error) {
      console.error('Retry failed:', error);
      this.retryConnection(peerId);
    }
  }

  private closeConnection(peerId: string) {
    const connection = this.connections.get(peerId);
    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      connection.pc.close();
      this.connections.delete(peerId);
    }
  }

  async initializeConnection(peerId: string): Promise<void> {
    try {
      let connection = this.connections.get(peerId);
      
      if (!connection || (!connection.isConnected && !connection.isConnecting)) {
        connection = await this.createPeerConnection(peerId);
        this.connections.set(peerId, connection);
        
        const dataChannel = connection.pc.createDataChannel('messageChannel');
        connection.dataChannel = dataChannel;
        this.setupDataChannel(dataChannel, peerId);

        const offer = await connection.pc.createOffer();
        await connection.pc.setLocalDescription(offer);

        // Salva l'offerta su Firestore per la segnalazione
        await addDoc(collection(db, 'signaling'), {
          type: 'offer',
          offer: offer,
          from: peerId,
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error initializing connection:', error);
      throw error;
    }
  }

  async sendMessage(peerId: string, message: any): Promise<string> {
    try {
      const connection = this.connections.get(peerId);
      
      if (!connection || !connection.isConnected) {
        // Se non c'è connessione, accoda il messaggio
        if (!this.messageQueue.has(peerId)) {
          this.messageQueue.set(peerId, []);
        }
        this.messageQueue.get(peerId)?.push(message);
        
        // Prova a stabilire la connessione
        await this.initializeConnection(peerId);
        return 'queued';
      }

      // Se c'è connessione, invia il messaggio
      if (connection.dataChannel?.readyState === 'open') {
        connection.dataChannel.send(JSON.stringify(message));
        return 'sent';
      } else {
        throw new Error('Data channel not ready');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  private async processMessageQueue(peerId: string) {
    const messages = this.messageQueue.get(peerId) || [];
    const connection = this.connections.get(peerId);

    if (!connection || !connection.isConnected || !connection.dataChannel) {
      return;
    }

    while (messages.length > 0) {
      const message = messages.shift();
      if (message) {
        try {
          await this.sendMessage(peerId, message);
        } catch (error) {
          console.error('Error processing message queue:', error);
          // Rimetti il messaggio in coda se fallisce
          messages.unshift(message);
          break;
        }
      }
    }

    this.messageQueue.set(peerId, messages);
  }

  private async handleIncomingMessage(message: any, peerId: string) {
    // Implementa la logica per gestire i messaggi in arrivo
    console.log('Received message from:', peerId, message);
  }

  onMessageStatusChanged(callback: (messageId: string, status: string) => void) {
    this.messageStatusListeners.push(callback);
    return () => {
      this.messageStatusListeners = this.messageStatusListeners.filter(cb => cb !== callback);
    };
  }

  private notifyMessageStatusChange(messageId: string, status: string) {
    this.messageStatusListeners.forEach(listener => {
      try {
        listener(messageId, status);
      } catch (error) {
        console.error('Error in message status listener:', error);
      }
    });
  }

  private async updateMessageStatus(messageId: string, status: string) {
    try {
      // Aggiorna lo stato del messaggio nel database
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        status,
        updatedAt: serverTimestamp()
      });

      // Notifica i listener del cambiamento di stato
      this.notifyMessageStatusChange(messageId, status);
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  isConnected(peerId: string): boolean {
    const connection = this.connections.get(peerId);
    return connection?.isConnected || false;
  }

  getConnectionState(peerId: string): string {
    const connection = this.connections.get(peerId);
    if (!connection) return 'disconnected';
    if (connection.isConnecting) return 'connecting';
    return connection.isConnected ? 'connected' : 'disconnected';
  }
}

export default P2PMessageService.getInstance();
