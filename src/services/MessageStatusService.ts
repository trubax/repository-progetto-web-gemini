import { EventEmitter } from '../utils/EventEmitter';

export type MessageStatus = 'sent' | 'delivered' | 'read';

interface MessageState {
  id: string;
  status: MessageStatus;
  timestamp: number;
}

class MessageStatusService {
  private static instance: MessageStatusService;
  private eventEmitter: EventEmitter;
  private messageStates: Map<string, MessageState>;
  private p2pConnections: Map<string, RTCDataChannel>;

  private constructor() {
    this.eventEmitter = new EventEmitter();
    this.messageStates = new Map();
    this.p2pConnections = new Map();
  }

  static getInstance(): MessageStatusService {
    if (!MessageStatusService.instance) {
      MessageStatusService.instance = new MessageStatusService();
    }
    return MessageStatusService.instance;
  }

  // Inizializza una connessione P2P per un peer
  async initializeP2PConnection(peerId: string, dataChannel: RTCDataChannel): Promise<void> {
    this.p2pConnections.set(peerId, dataChannel);
    
    dataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'messageStatus') {
        this.updateMessageStatus(data.messageId, data.status);
      }
    };
  }

  // Invia un nuovo messaggio
  sendMessage(messageId: string): void {
    this.messageStates.set(messageId, {
      id: messageId,
      status: 'sent',
      timestamp: Date.now()
    });
    this.eventEmitter.emit('messageStatusChanged', messageId, 'sent');
  }

  // Aggiorna lo stato di un messaggio
  updateMessageStatus(messageId: string, status: MessageStatus): void {
    const currentState = this.messageStates.get(messageId);
    if (!currentState || currentState.status === status) return;

    this.messageStates.set(messageId, {
      ...currentState,
      status,
      timestamp: Date.now()
    });

    this.eventEmitter.emit('messageStatusChanged', messageId, status);

    // Notifica gli altri peer del cambio di stato
    if (status === 'delivered' || status === 'read') {
      this.notifyPeers(messageId, status);
    }
  }

  // Notifica tutti i peer connessi del cambio di stato
  private notifyPeers(messageId: string, status: MessageStatus): void {
    const statusUpdate = {
      type: 'messageStatus',
      messageId,
      status
    };

    this.p2pConnections.forEach(dataChannel => {
      if (dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(statusUpdate));
      }
    });
  }

  // Ottieni lo stato corrente di un messaggio
  getMessageStatus(messageId: string): MessageStatus {
    return this.messageStates.get(messageId)?.status || 'sent';
  }

  // Ascolta i cambiamenti di stato dei messaggi
  onStatusChange(callback: (messageId: string, status: MessageStatus) => void): void {
    this.eventEmitter.on('messageStatusChanged', callback);
  }

  // Rimuovi un listener
  offStatusChange(callback: (messageId: string, status: MessageStatus) => void): void {
    this.eventEmitter.off('messageStatusChanged', callback);
  }
}

export default MessageStatusService.getInstance();
