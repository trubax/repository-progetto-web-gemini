import React, { useState, useEffect } from 'react';
import { X, Settings, Shield, Bell, LogOut, UserPlus, BarChart2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNotifications } from '../../context/NotificationContext';
import PrivacySettingsExpanded from '../settings/PrivacySettingsExpanded';
import type { PrivacySettings } from '@/types/privacy';
import FollowRequestDialog from './FollowRequestDialog';
import NotificationDialog from '../notifications/NotificationDialog';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showRequestsDialog, setShowRequestsDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
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

  useEffect(() => {
    if (!currentUser) return;
    
    const requestsRef = collection(db, 'users', currentUser.uid, 'followRequests');
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      setRequestCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const fetchPrivacySettings = async () => {
      if (!currentUser) return;
      
      const privacyDoc = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'privacy'));
      if (privacyDoc.exists()) {
        setPrivacy(privacyDoc.data() as PrivacySettings);
      }
    };

    fetchPrivacySettings();
  }, [currentUser]);

  const handlePrivacyUpdate = async (updates: Partial<PrivacySettings>) => {
    try {
      const userRef = doc(db, 'users', currentUser?.uid || '', 'settings', 'privacy');
      await setDoc(userRef, { ...privacy, ...updates }, { merge: true });
      setPrivacy(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Errore durante l\'aggiornamento della privacy:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Errore durante il logout:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed top-0 left-0 bottom-0 w-72 z-50 theme-bg-primary shadow-xl transform transition-transform duration-200 overflow-y-auto">
        <div className="p-4 flex justify-between items-center border-b theme-divide">
          <h2 className="text-lg font-semibold theme-text">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 theme-text" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={() => {
              navigate('/settings');
              onClose();
            }}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:theme-bg-secondary theme-text"
          >
            <Settings className="w-5 h-5" />
            <span>Impostazioni</span>
          </button>

          <PrivacySettingsExpanded
            privacy={privacy}
            onUpdate={handlePrivacyUpdate}
            expanded={showPrivacySettings}
            onToggle={() => setShowPrivacySettings(!showPrivacySettings)}
          />

          <button
            onClick={() => setShowNotificationsDialog(true)}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:theme-bg-secondary theme-text relative"
          >
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5" />
              <span>Notifiche</span>
            </div>
            {unreadCount > 0 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowRequestsDialog(true)}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:theme-bg-secondary theme-text relative"
          >
            <div className="flex items-center space-x-3">
              <UserPlus className="w-5 h-5" />
              <span>Richieste</span>
            </div>
            {requestCount > 0 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {requestCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              navigate('/statistics');
              onClose();
            }}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:theme-bg-secondary theme-text"
          >
            <BarChart2 className="w-5 h-5" />
            <span>Statistiche</span>
          </button>

          <button
            onClick={() => {
              navigate('/match-updates');
              onClose();
            }}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:theme-bg-secondary theme-text"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Aggiornamenti match</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:theme-bg-secondary text-red-500"
          >
            <LogOut className="w-5 h-5" />
            <span>Esci</span>
          </button>
        </div>
      </div>

      <FollowRequestDialog 
        isOpen={showRequestsDialog} 
        onClose={() => setShowRequestsDialog(false)} 
      />

      <NotificationDialog
        isOpen={showNotificationsDialog}
        onClose={() => setShowNotificationsDialog(false)}
      />
    </>
  );
}