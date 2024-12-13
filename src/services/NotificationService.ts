import { db } from '../firebase';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface NotificationSettings {
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private settings: NotificationSettings = {
    sound: true,
    vibration: true,
    desktop: true
  };

  private constructor() {}

  public async initialize() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('Stato permessi notifiche:', permission);
    }
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async showDesktopNotification(title: string, options: NotificationOptions) {
    if (!this.settings.desktop) return;

    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        // Rimuovo le actions poiché non sono supportate nelle notifiche desktop standard
        const { actions, ...restOptions } = options;
        
        // Creo la notifica senza suono e vibrazione iniziali
        const notification = new Notification(title, {
          ...restOptions,
          silent: true, // Disabilito il suono di default
          requireInteraction: false
        });

        // Gestisco il click sulla notifica
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Provo a riprodurre il suono solo se l'utente ha interagito con la pagina
        if (this.settings.sound && document.hasFocus()) {
          try {
            await this.playNotificationSound();
          } catch (error) {
            console.log('Suono notifica non disponibile - richiede interazione utente');
          }
        }

        // Provo a utilizzare la vibrazione solo se l'utente ha interagito con la pagina
        if (this.settings.vibration && document.hasFocus() && 'vibrate' in navigator) {
          try {
            navigator.vibrate(200);
          } catch (error) {
            console.log('Vibrazione non disponibile - richiede interazione utente');
          }
        }

        return notification;
      }
    } catch (error) {
      console.error('Errore nella visualizzazione della notifica:', error);
    }
  }

  private async playNotificationSound() {
    if (!this.settings.sound) return;
    
    try {
      const audio = new Audio('/notification-sound.mp3');
      await audio.play();
    } catch (error) {
      console.log('Errore nella riproduzione del suono:', error);
    }
  }

  private vibrate() {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(200);
      } catch (error) {
        console.error('Errore nell\'attivazione della vibrazione:', error);
      }
    }
  }

  public async markAsRead(userId: string, notificationId: string) {
    try {
      const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
      await setDoc(notificationRef, {
        status: 'read',
        readAt: serverTimestamp()
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('Errore nel marcare la notifica come letta:', error);
      return false;
    }
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<NotificationSettings>) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
  }

  // Notifica per nuova richiesta di follow
  public async sendFollowRequestNotification(targetUserId: string, requesterId: string) {
    try {
      // Ottieni i dati del richiedente
      const requesterDoc = await getDoc(doc(db, 'users', requesterId));
      const requesterData = requesterDoc.data();
      
      if (!requesterData) {
        console.error('Dati utente non trovati');
        return false;
      }

      // Salva la notifica nel database
      const notificationRef = collection(db, 'users', targetUserId, 'notifications');
      await addDoc(notificationRef, {
        type: 'follow_request',
        from: requesterId,
        fromName: requesterData.displayName,
        fromPhotoURL: requesterData.photoURL,
        status: 'unread',
        createdAt: serverTimestamp(),
        message: `${requesterData.displayName} vuole seguirti`
      });

      // Mostra notifica desktop
      await this.showDesktopNotification('Nuova richiesta di follow', {
        body: `${requesterData.displayName} vuole seguirti`,
        icon: requesterData.photoURL || '/default-avatar.png',
        tag: `follow-request-${requesterId}`
      });

      return true;
    } catch (error) {
      console.error('Errore nell\'invio della notifica:', error);
      return false;
    }
  }

  // Notifica per nuovo follower
  public async sendNewFollowerNotification(targetUserId: string, followerId: string) {
    try {
      // Ottieni i dati del nuovo follower
      const followerDoc = await getDoc(doc(db, 'users', followerId));
      const followerData = followerDoc.data();
      
      if (!followerData) {
        console.error('Dati utente non trovati');
        return false;
      }

      // Salva la notifica nel database
      const notificationRef = collection(db, 'users', targetUserId, 'notifications');
      await addDoc(notificationRef, {
        type: 'new_follower',
        from: followerId,
        fromName: followerData.displayName,
        fromPhotoURL: followerData.photoURL,
        status: 'unread',
        createdAt: serverTimestamp(),
        message: `${followerData.displayName} ha iniziato a seguirti`
      });

      // Mostra notifica desktop
      await this.showDesktopNotification('Nuovo follower', {
        body: `${followerData.displayName} ha iniziato a seguirti`,
        icon: followerData.photoURL || '/default-avatar.png',
        tag: `new-follower-${followerId}`
      });

      return true;
    } catch (error) {
      console.error('Errore nell\'invio della notifica:', error);
      return false;
    }
  }

  // Metodo per mostrare notifiche di messaggi
  public async showMessageNotification(chatId: string, senderName: string, messageText: string) {
    if (!this.settings.desktop) return;

    try {
      const title = `Nuovo messaggio da ${senderName}`;
      const options: NotificationOptions = {
        body: messageText,
        icon: '/notification-icon.png', // Assicurati che questo file esista nella cartella public
        tag: `message-${chatId}`, // Raggruppa le notifiche per chat
        data: { chatId },
        requireInteraction: false,
        silent: !this.settings.sound
      };

      await this.showDesktopNotification(title, options);

      // Riproduci il suono di notifica se abilitato
      if (this.settings.sound) {
        const audio = new Audio('/notification-sound.mp3'); // Assicurati che questo file esista nella cartella public
        await audio.play().catch(err => console.warn('Errore riproduzione suono:', err));
      }

      // Attiva la vibrazione se abilitata e supportata
      if (this.settings.vibration && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }
    } catch (error) {
      console.error('Errore durante la visualizzazione della notifica:', error);
    }
  }
}