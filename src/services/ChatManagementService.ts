import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp, DocumentReference } from 'firebase/firestore';
import { ChatData, ChatType, ChatParticipant, ChatSettings, ChatMetadata } from '../types/chat';
import { generateKeyPair } from '../utils/crypto';

class ChatManagementService {
  private static instance: ChatManagementService;

  private constructor() {}

  static getInstance(): ChatManagementService {
    if (!ChatManagementService.instance) {
      ChatManagementService.instance = new ChatManagementService();
    }
    return ChatManagementService.instance;
  }

  private async createChatDocument(
    type: ChatType,
    participants: string[],
    settings?: Partial<ChatSettings>,
    metadata?: ChatMetadata
  ): Promise<DocumentReference> {
    const chatRef = doc(collection(db, 'chats'));
    const timestamp = serverTimestamp();

    const participantsData: { [key: string]: ChatParticipant } = {};
    for (const participantId of participants) {
      const userDoc = await getDoc(doc(db, 'users', participantId));
      const userData = userDoc.data();
      if (userData) {
        participantsData[participantId] = {
          id: participantId,
          displayName: userData.displayName || 'Utente anonimo',
          photoURL: userData.photoURL || '/default-avatar.png',
          isAnonymous: userData.isAnonymous || false,
          isOnline: userData.isOnline || false,
          lastSeen: userData.lastSeen || timestamp,
          publicKey: userData.publicKey
        };
      }
    }

    const defaultSettings: ChatSettings = {
      messageTimer: 0,
      screenshotPrevention: false,
      encryption: true,
      notifications: true,
      mediaAutoDownload: true
    };

    const chatData: ChatData = {
      id: chatRef.id,
      type,
      participants,
      participantsData,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: type === 'pending' ? 'pending' : 'active',
      settings: { ...defaultSettings, ...settings },
      metadata
    };

    await setDoc(chatRef, chatData);
    return chatRef;
  }

  async createDirectChat(targetUserId: string): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    // Verifica se esiste già una chat diretta
    const existingChat = await this.findExistingDirectChat(targetUserId);
    if (existingChat) return existingChat;

    // Genera le chiavi per la crittografia
    const { publicKey, privateKey } = await generateKeyPair();

    const chatRef = await this.createChatDocument(
      'direct',
      [auth.currentUser.uid, targetUserId],
      { encryption: true },
      { serviceType: 'direct' }
    );

    // Salva le chiavi nel documento dell'utente
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      [`chatKeys.${chatRef.id}`]: {
        publicKey,
        privateKey,
        timestamp: serverTimestamp()
      }
    });

    return chatRef.id;
  }

  async createGroupChat(
    name: string,
    participants: string[],
    settings?: Partial<ChatSettings>,
    metadata?: ChatMetadata
  ): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const allParticipants = [...new Set([auth.currentUser.uid, ...participants])];
    const groupMetadata: ChatMetadata = {
      ...metadata,
      description: metadata?.description || '',
      avatar: metadata?.avatar || '/default-group.png',
      admins: [auth.currentUser.uid],
      maxParticipants: metadata?.maxParticipants || 100
    };

    const chatRef = await this.createChatDocument(
      'group',
      allParticipants,
      settings,
      groupMetadata
    );

    return chatRef.id;
  }

  async createServiceChat(
    serviceType: string,
    serviceData: any,
    settings?: Partial<ChatSettings>
  ): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const metadata: ChatMetadata = {
      serviceType,
      serviceData,
      description: 'Chat di servizio',
      avatar: '/service-avatar.png'
    };

    const chatRef = await this.createChatDocument(
      'service',
      [auth.currentUser.uid],
      settings,
      metadata
    );

    return chatRef.id;
  }

  async createPendingChat(targetUserId: string): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const chatRef = await this.createChatDocument(
      'pending',
      [auth.currentUser.uid, targetUserId],
      { encryption: true }
    );

    // Crea la richiesta di chat
    await setDoc(doc(db, 'chatRequests', chatRef.id), {
      from: auth.currentUser.uid,
      to: targetUserId,
      chatId: chatRef.id,
      status: 'pending',
      timestamp: serverTimestamp()
    });

    return chatRef.id;
  }

  private async findExistingDirectChat(targetUserId: string): Promise<string | null> {
    // Implementa la logica per trovare una chat diretta esistente
    return null;
  }

  async acceptChatRequest(chatId: string): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (!chatDoc.exists()) throw new Error('Chat not found');

    const chatData = chatDoc.data() as ChatData;
    if (chatData.type !== 'pending') throw new Error('Chat is not pending');

    // Aggiorna lo stato della chat
    await updateDoc(doc(db, 'chats', chatId), {
      status: 'active',
      updatedAt: serverTimestamp()
    });

    // Aggiorna la richiesta
    await updateDoc(doc(db, 'chatRequests', chatId), {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });
  }

  async rejectChatRequest(chatId: string): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    // Aggiorna lo stato della chat
    await updateDoc(doc(db, 'chats', chatId), {
      status: 'deleted',
      updatedAt: serverTimestamp()
    });

    // Aggiorna la richiesta
    await updateDoc(doc(db, 'chatRequests', chatId), {
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });
  }
}

export default ChatManagementService.getInstance();
