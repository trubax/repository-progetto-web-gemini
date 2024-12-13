import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '../firebase';
import { Lock, UserPlus, UserMinus } from 'lucide-react';
import { useFollow } from '../hooks/useFollow';
import { Edit3, Bell, Shield, Globe, Briefcase, HelpCircle } from 'lucide-react';
import ProfileView from '../components/profile/ProfileView';

interface PrivacySettings {
  accountType: 'public' | 'private';
  profileVisibility: 'public' | 'private' | 'followers';
  showLastSeen: boolean;
  showStatus: boolean;
  showBio: boolean;
  showPosts: boolean;
  showServices: boolean;
  whoCanMessageMe: 'everyone' | 'followers' | 'none';
  whoCanSeeMyPosts: 'everyone' | 'followers' | 'none';
  blockedUsers: string[];
  closeFollowers: string[];
}

const ProfilePage = () => {
  const { theme } = useTheme();
  const { userId } = useParams();
  const { currentUser, isAnonymous } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    posts: 0,
    videos: 0,
    followers: 0,
    following: 0
  });

  const [profileData, setProfileData] = useState({
    id: userId || currentUser?.uid,
    uid: userId || currentUser?.uid,
    displayName: currentUser?.displayName || 'Utente',
    photoURL: currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent('Utente')}`,
    bio: '',
    phoneNumbers: [],
    secondaryEmail: '',
    socialLinks: {},
    stats: {
      posts: 0,
      videos: 0,
      followers: 0,
      following: 0
    },
    servicesOffered: [],
    servicesRequested: []
  });

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    accountType: 'public',
    profileVisibility: 'public',
    showLastSeen: true,
    showStatus: true,
    showBio: true,
    showPosts: true,
    showServices: true,
    whoCanMessageMe: 'everyone',
    whoCanSeeMyPosts: 'everyone',
    blockedUsers: [],
    closeFollowers: []
  });

  const { isFollowing, isPending, handleFollow, handleUnfollow } = useFollow(userId || '', currentUser?.uid || '');

  if (isAnonymous) {
    return <Navigate to="/" replace />;
  }

  const handleFollowToggle = async () => {
    if (!currentUser) {
      return;
    }

    try {
      if (isFollowing || isPending) {
        await handleUnfollow();
      } else {
        await handleFollow(privacy.accountType === 'private');
      }
    } catch (error) {
      console.error('Errore durante l\'operazione di follow:', error);
    }
  };

  const handlePhotoChange = async (photoURL: string) => {
    try {
      setLoading(true);
      
      // Aggiorna il documento utente
      const userRef = doc(db, 'users', currentUser?.uid || '');
      await updateDoc(userRef, {
        photoURL,
        updatedAt: serverTimestamp()
      });

      // Aggiorna lo stato locale immediatamente dopo l'upload
      setProfileData(prev => ({
        ...prev,
        photoURL
      }));

      // Aggiorna l'auth state di Firebase
      if (currentUser) {
        await updateProfile(currentUser, {
          photoURL
        });
      }

      // Aggiorna tutti i contatti dell'utente
      const contactsRef = collection(db, 'users');
      const contactsQuery = query(contactsRef, where('contacts', 'array-contains', currentUser?.uid));
      const contactsSnapshot = await getDocs(contactsQuery);

      const batch = writeBatch(db);
      contactsSnapshot.docs.forEach(doc => {
        const contactRef = doc.ref;
        batch.update(contactRef, {
          [`contacts.${currentUser?.uid}.photoURL`]: photoURL
        });
      });
      await batch.commit();

      // Aggiorna tutte le chat dell'utente
      const chatsRef = collection(db, 'chats');
      const chatsQuery = query(chatsRef, where('participants', 'array-contains', currentUser?.uid));
      const chatsSnapshot = await getDocs(chatsQuery);

      const chatsBatch = writeBatch(db);
      chatsSnapshot.docs.forEach(doc => {
        const chatRef = doc.ref;
        chatsBatch.update(chatRef, {
          [`participants.${currentUser?.uid}.photoURL`]: photoURL
        });
      });
      await chatsBatch.commit();

    } catch (error) {
      console.error('Errore durante l\'aggiornamento della foto:', error);
      throw new Error('Impossibile aggiornare la foto del profilo');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const userRef = doc(db, 'users', currentUser?.uid || '');
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const isOffered = userData.servicesOffered?.some((s: any) => s.id === serviceId);
      
      if (isOffered) {
        await updateDoc(userRef, {
          servicesOffered: arrayRemove(...userData.servicesOffered.filter((s: any) => s.id === serviceId))
        });
        setProfileData(prev => ({
          ...prev,
          servicesOffered: prev.servicesOffered.filter(s => s.id !== serviceId)
        }));
      } else {
        await updateDoc(userRef, {
          servicesRequested: arrayRemove(...userData.servicesRequested.filter((s: any) => s.id === serviceId))
        });
        setProfileData(prev => ({
          ...prev,
          servicesRequested: prev.servicesRequested.filter(s => s.id !== serviceId)
        }));
      }
    } catch (error) {
      console.error('Errore durante l\'eliminazione del servizio:', error);
    }
  };

  const handleAddService = async (type: 'offered' | 'requested', service: any) => {
    const newService = {
      id: crypto.randomUUID(),
      userId: currentUser?.uid,
      ...service,
      createdAt: new Date(),
    };

    try {
      const userRef = doc(db, 'users', currentUser?.uid || '');
      
      if (type === 'offered') {
        await updateDoc(userRef, {
          servicesOffered: arrayUnion(newService)
        });
        setProfileData(prev => ({
          ...prev,
          servicesOffered: [...(prev.servicesOffered || []), newService]
        }));
      } else {
        await updateDoc(userRef, {
          servicesRequested: arrayUnion(newService)
        });
        setProfileData(prev => ({
          ...prev,
          servicesRequested: [...(prev.servicesRequested || []), newService]
        }));
      }
      
      return true;
    } catch (error) {
      console.error('Errore durante il salvataggio del servizio:', error);
      return false;
    }
  };

  const loadStats = async (userId: string) => {
    try {
      // Query per i post
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', userId)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsCount = postsSnapshot.docs.length;

      // Query per i video
      const videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', userId)
      );
      const videosSnapshot = await getDocs(videosQuery);
      const videosCount = videosSnapshot.docs.length;

      // Query per follower e following
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      setStats({
        posts: postsCount,
        videos: videosCount,
        followers: userData?.followers?.length || 0,
        following: userData?.following?.length || 0
      });

      // Aggiorna anche profileData con le nuove statistiche
      setProfileData(prev => ({
        ...prev,
        stats: {
          posts: postsCount,
          videos: videosCount,
          followers: userData?.followers?.length || 0,
          following: userData?.following?.length || 0
        }
      }));

      console.log('Statistiche caricate:', {
        posts: postsCount,
        videos: videosCount,
        followers: userData?.followers?.length || 0,
        following: userData?.following?.length || 0
      });
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche:', error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const targetUserId = userId || currentUser?.uid;
        
        if (!targetUserId) {
          console.error('🚫 ID utente non disponibile');
          setLoading(false);
          return;
        }

        console.log('🔄 Caricamento dati per utente:', {
          targetUserId,
          urlUserId: userId,
          currentUserId: currentUser?.uid
        });
        
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Assicurati che le statistiche siano inizializzate
          const stats = {
            posts: userData.stats?.posts || 0,
            videos: userData.stats?.videos || 0,
            followers: userData.stats?.followers || 0,
            following: userData.stats?.following || 0
          };

          setProfileData({
            ...userData,
            id: targetUserId,
            uid: targetUserId,
            stats  // Imposta le statistiche inizializzate
          });

          // Carica immediatamente le statistiche aggiornate
          loadStats(targetUserId);
        }
      } catch (error) {
        console.error('❌ Errore nel caricamento del profilo:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!isAnonymous) {
      fetchUserData();
    }
  }, [userId, currentUser, isAnonymous]);

  useEffect(() => {
    const fetchPrivacySettings = async () => {
      const privacyDoc = await getDoc(doc(db, 'users', userId || currentUser?.uid, 'settings', 'privacy'));
      if (privacyDoc.exists()) {
        setPrivacy(privacyDoc.data() as PrivacySettings);
      }
    };
    
    fetchPrivacySettings();
  }, [userId, currentUser]);

  useEffect(() => {
    if (profileData.uid) {
      loadStats(profileData.uid);
    }
  }, [profileData.uid]);

  const isOwnProfile = userId === currentUser?.uid || !userId;

  return (
    <div className="min-h-screen theme-bg-base">
      <div className="container mx-auto max-w-4xl">
        <ProfileView 
          profileData={profileData}
          isOwnProfile={isOwnProfile}
          privacy={privacy}
          onPhotoChange={handlePhotoChange}
          onDeleteService={handleDeleteService}
          onAddService={handleAddService}
          stats={stats}
        />
      </div>
    </div>
  );
};

export default ProfilePage;