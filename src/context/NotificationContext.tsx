import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

interface Notification {
  id: string;
  type: 'follow_request' | 'follow_request_accepted' | 'follow_request_rejected' | 'new_follower' | 
        'post_like' | 'video_like' | 'post_comment' | 'video_comment';
  read: boolean;
  timestamp: Timestamp;
  senderName?: string;
  senderId?: string;
  senderPhotoURL?: string;
  message: string;
  postId?: string;
  postImage?: string;
  videoId?: string;
  videoThumbnail?: string;
  comment?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Ascolta le notifiche in tempo reale
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const markAsRead = async (notificationId: string) => {
    if (!currentUser) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
    } catch (error) {
      console.error('Errore nel marcare la notifica come letta:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification => 
        updateDoc(doc(db, 'notifications', notification.id), {
          read: true
        })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Errore nel marcare tutte le notifiche come lette:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications deve essere usato all\'interno di un NotificationProvider');
  }
  return context;
}
