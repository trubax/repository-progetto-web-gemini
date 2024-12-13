import { EncryptionService } from './EncryptionService';
import { NotificationService } from './NotificationService';

export interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  stream?: MediaStream;
}

export class CallService {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private localStream?: MediaStream;
  private encryptionService: EncryptionService;
  private notificationService: NotificationService;
  
  private static instance: CallService;
  
  private constructor() {
    this.encryptionService = EncryptionService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  async initializeLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video,
        audio
      });
      return this.localStream;
    } catch (error) {
      console.error('Errore nell\'accesso ai dispositivi media:', error);
      throw error;
    }
  }

  async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    
    // Aggiungi le tracce locali alla connessione
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    // Gestisci gli eventi ICE
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        // Invia il candidato ICE all'altro peer attraverso il tuo sistema di segnalazione
        this.notificationService.sendSignalingMessage(userId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Gestisci le tracce remote
    peerConnection.ontrack = event => {
      const stream = event.streams[0];
      // Decripta lo stream prima di usarlo
      this.encryptionService.decryptStream(stream).then(decryptedStream => {
        const peerData = this.peerConnections.get(userId);
        if (peerData) {
          this.peerConnections.set(userId, {
            ...peerData,
            stream: decryptedStream
          });
        }
      });
    };

    const peerData: PeerConnection = {
      connection: peerConnection
    };
    
    this.peerConnections.set(userId, peerData);
    return peerConnection;
  }

  async createOffer(userId: string): Promise<RTCSessionDescriptionInit> {
    const peerData = this.peerConnections.get(userId);
    if (!peerData) {
      throw new Error('Connessione peer non trovata');
    }

    const offer = await peerData.connection.createOffer();
    await peerData.connection.setLocalDescription(offer);
    
    // Cripta l'offerta prima di inviarla
    const encryptedOffer = await this.encryptionService.encryptData(JSON.stringify(offer));
    
    // Invia l'offerta attraverso il tuo sistema di segnalazione
    this.notificationService.sendSignalingMessage(userId, {
      type: 'offer',
      offer: encryptedOffer
    });

    return offer;
  }

  async handleOffer(userId: string, encryptedOffer: string): Promise<void> {
    // Decripta l'offerta
    const offerStr = await this.encryptionService.decryptData(encryptedOffer);
    const offer = JSON.parse(offerStr);

    let peerConnection = this.peerConnections.get(userId)?.connection;
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(userId);
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Cripta la risposta prima di inviarla
    const encryptedAnswer = await this.encryptionService.encryptData(JSON.stringify(answer));
    
    // Invia la risposta attraverso il tuo sistema di segnalazione
    this.notificationService.sendSignalingMessage(userId, {
      type: 'answer',
      answer: encryptedAnswer
    });
  }

  async handleAnswer(userId: string, encryptedAnswer: string): Promise<void> {
    const peerData = this.peerConnections.get(userId);
    if (!peerData) {
      throw new Error('Connessione peer non trovata');
    }

    // Decripta la risposta
    const answerStr = await this.encryptionService.decryptData(encryptedAnswer);
    const answer = JSON.parse(answerStr);

    await peerData.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidate): Promise<void> {
    const peerData = this.peerConnections.get(userId);
    if (!peerData) {
      throw new Error('Connessione peer non trovata');
    }

    await peerData.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  closeConnection(userId: string): void {
    const peerData = this.peerConnections.get(userId);
    if (peerData) {
      if (peerData.stream) {
        peerData.stream.getTracks().forEach(track => track.stop());
      }
      if (peerData.dataChannel) {
        peerData.dataChannel.close();
      }
      peerData.connection.close();
      this.peerConnections.delete(userId);
    }
  }

  closeAllConnections(): void {
    for (const userId of this.peerConnections.keys()) {
      this.closeConnection(userId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = undefined;
    }
  }
}