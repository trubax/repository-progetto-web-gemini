import { EventEmitter } from '../utils/EventEmitter';

interface P2PConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

interface MediaMessage {
  id: string;
  type: 'audio' | 'image' | 'video';
  file: Blob;
  metadata: {
    name: string;
    size: number;
    type: string;
    timestamp: number;
  };
}

class P2PMediaService {
  private static instance: P2PMediaService;
  private connections: Map<string, P2PConnection>;
  private mediaStore: Map<string, MediaMessage>;
  private eventEmitter: EventEmitter;
  private iceServers: RTCIceServer[];

  private constructor() {
    this.connections = new Map();
    this.mediaStore = new Map();
    this.eventEmitter = new EventEmitter();
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  static getInstance(): P2PMediaService {
    if (!P2PMediaService.instance) {
      P2PMediaService.instance = new P2PMediaService();
    }
    return P2PMediaService.instance;
  }

  async storeMediaLocally(file: File | Blob, type: 'audio' | 'image' | 'video'): Promise<string> {
    const mediaId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mediaMessage: MediaMessage = {
      id: mediaId,
      type,
      file: file instanceof Blob ? file : new Blob([file]),
      metadata: {
        name: file instanceof File ? file.name : `${type}_${mediaId}`,
        size: file.size,
        type: file.type,
        timestamp: Date.now()
      }
    };

    this.mediaStore.set(mediaId, mediaMessage);
    this.eventEmitter.emit('mediaStored', mediaMessage);
    return mediaId;
  }

  async getMediaById(mediaId: string): Promise<MediaMessage | null> {
    return this.mediaStore.get(mediaId) || null;
  }

  async initializeP2PConnection(targetPeerId: string): Promise<void> {
    if (this.connections.has(targetPeerId)) return;

    const peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });
    const dataChannel = peerConnection.createDataChannel('mediaTransfer', {
      ordered: true,
    });

    this.setupDataChannelHandlers(dataChannel);

    const connection: P2PConnection = {
      peerId: targetPeerId,
      connection: peerConnection,
      dataChannel
    };

    this.connections.set(targetPeerId, connection);
    this.setupPeerConnectionHandlers(connection);
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel): void {
    dataChannel.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'mediaRequest') {
          const media = await this.getMediaById(data.mediaId);
          if (media) {
            // Invia il file in chunks
            this.sendMediaInChunks(dataChannel, media);
          }
        }
      } catch (error) {
        console.error('Error handling data channel message:', error);
      }
    };

    dataChannel.onopen = () => {
      console.log('Data channel opened');
      this.eventEmitter.emit('dataChannelOpen');
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.eventEmitter.emit('dataChannelClose');
    };
  }

  private setupPeerConnectionHandlers(connection: P2PConnection): void {
    connection.connection.onicecandidate = (event) => {
      if (event.candidate) {
        // Invia il candidate al peer tramite il tuo sistema di segnalazione
        this.eventEmitter.emit('iceCandidate', {
          peerId: connection.peerId,
          candidate: event.candidate
        });
      }
    };

    connection.connection.onconnectionstatechange = () => {
      console.log('Connection state:', connection.connection.connectionState);
      this.eventEmitter.emit('connectionStateChange', {
        peerId: connection.peerId,
        state: connection.connection.connectionState
      });
    };
  }

  private async sendMediaInChunks(dataChannel: RTCDataChannel, media: MediaMessage): Promise<void> {
    const CHUNK_SIZE = 16384; // 16KB chunks
    const file = media.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Invia metadata
    dataChannel.send(JSON.stringify({
      type: 'mediaMetadata',
      id: media.id,
      totalChunks,
      metadata: media.metadata
    }));

    // Invia chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      // Converti chunk in base64
      const reader = new FileReader();
      reader.readAsDataURL(chunk);
      reader.onloadend = () => {
        dataChannel.send(JSON.stringify({
          type: 'mediaChunk',
          id: media.id,
          chunkIndex: i,
          data: reader.result
        }));
      };

      // Attendi un po' per non sovraccaricare il canale
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}

export default P2PMediaService.getInstance();
