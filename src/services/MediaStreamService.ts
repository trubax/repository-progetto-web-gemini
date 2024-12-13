import { collection, doc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface MediaStreamOptions {
  userId: string;
  recipientId: string;
  chatId: string;
  type: 'audio' | 'video' | 'file';
  metadata?: {
    name?: string;
    size?: number;
    type?: string;
  };
}

class MediaStreamService {
  private static instance: MediaStreamService;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  private constructor() {}

  static getInstance(): MediaStreamService {
    if (!MediaStreamService.instance) {
      MediaStreamService.instance = new MediaStreamService();
    }
    return MediaStreamService.instance;
  }

  private async createPeerConnection(recipientId: string): Promise<RTCPeerConnection> {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Aggiungi qui altri STUN/TURN server se necessario
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnections.set(recipientId, peerConnection);

    // Gestione degli eventi ICE
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        // Invia il candidato ICE al destinatario tramite Firebase
        const signalRef = doc(collection(db, 'users', recipientId, 'signaling'));
        await setDoc(signalRef, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          timestamp: serverTimestamp()
        });
      }
    };

    return peerConnection;
  }

  private async createDataChannel(recipientId: string, peerConnection: RTCPeerConnection): Promise<RTCDataChannel> {
    const dataChannel = peerConnection.createDataChannel('mediaTransfer', {
      ordered: true
    });

    this.setupDataChannelHandlers(dataChannel, recipientId);
    this.dataChannels.set(recipientId, dataChannel);

    return dataChannel;
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel, recipientId: string) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${recipientId}`);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${recipientId}`);
      this.dataChannels.delete(recipientId);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${recipientId}:`, error);
    };
  }

  async initializeMediaStream(options: MediaStreamOptions): Promise<void> {
    try {
      const peerConnection = await this.createPeerConnection(options.recipientId);
      const dataChannel = await this.createDataChannel(options.recipientId, peerConnection);

      // Crea l'offerta
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Invia l'offerta al destinatario tramite Firebase
      const signalRef = doc(collection(db, 'users', options.recipientId, 'signaling'));
      await setDoc(signalRef, {
        type: 'offer',
        offer: offer,
        chatId: options.chatId,
        senderId: options.userId,
        mediaType: options.type,
        metadata: options.metadata,
        timestamp: serverTimestamp()
      });

    } catch (error) {
      console.error('Error initializing media stream:', error);
      throw new Error('Errore nell\'inizializzazione dello stream multimediale');
    }
  }

  async handleAnswer(recipientId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peerConnections.get(recipientId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleIceCandidate(recipientId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections.get(recipientId);
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async sendMediaChunk(recipientId: string, chunk: ArrayBuffer): Promise<void> {
    const dataChannel = this.dataChannels.get(recipientId);
    if (dataChannel?.readyState === 'open') {
      dataChannel.send(chunk);
    } else {
      throw new Error('Data channel non disponibile');
    }
  }

  async closeConnection(recipientId: string): Promise<void> {
    const dataChannel = this.dataChannels.get(recipientId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(recipientId);
    }

    const peerConnection = this.peerConnections.get(recipientId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(recipientId);
    }
  }

  // Metodo per aggiornare i metadati della chat dopo il trasferimento
  private async updateChatMetadata(options: MediaStreamOptions, fileUrl: string): Promise<void> {
    const { userId, recipientId, chatId, type, metadata } = options;
    const timestamp = serverTimestamp();

    // Aggiorna la chat del mittente
    const senderChatRef = doc(db, 'users', userId, 'chats', chatId);
    await updateDoc(senderChatRef, {
      lastMessage: `Ha inviato un ${type}`,
      lastMessageTime: timestamp,
      updatedAt: timestamp
    });

    // Aggiorna la chat del destinatario
    const recipientChatRef = doc(db, 'users', recipientId, 'chats', chatId);
    await updateDoc(recipientChatRef, {
      lastMessage: `Ha ricevuto un ${type}`,
      lastMessageTime: timestamp,
      updatedAt: timestamp,
      'unreadCount': increment(1)
    });

    // Salva il riferimento al file nella collezione appropriata
    const mediaRef = doc(collection(db, 'users', userId, type === 'file' ? 'files' : `${type}s`));
    await setDoc(mediaRef, {
      url: fileUrl,
      type,
      chatId,
      sender: userId,
      recipient: recipientId,
      timestamp,
      ...metadata
    });
  }
}

export const mediaStreamService = MediaStreamService.getInstance();
