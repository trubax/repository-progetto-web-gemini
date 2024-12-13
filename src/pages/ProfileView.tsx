import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfileData } from '../context/ProfileContext';
import { useFirestore } from '../context/FirestoreContext';
import { ProfileLayout } from '../components/ProfileLayout';
import { PostGrid } from '../components/PostGrid';
import { Lock } from 'lucide-react';
import { useFollow } from '../hooks/useFollow';
import DemographicInfo from '../components/profile/DemographicInfo';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

const ProfileView = () => {
  const { currentUser } = useAuth();
  const { profileData, setProfileData } = useProfileData();
  const { db } = useFirestore();
  const navigate = useNavigate();

  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private' | 'followers'>('public');
  const { isFollowing, isPending, handleFollow, handleUnfollow } = useFollow(profileData.uid, currentUser?.uid || '');

  useEffect(() => {
    const loadProfileVisibility = async () => {
      if (!currentUser || !profileData.uid) return;
      
      try {
        // Crea un listener in tempo reale per le impostazioni di privacy
        const userDocRef = doc(db, 'users', profileData.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            setProfileVisibility(userData?.privacy?.profileVisibility || 'public');
            setIsOwnProfile(currentUser.uid === profileData.uid);
          }
        }, (error) => {
          console.error('Errore nel monitoraggio della visibilità:', error);
        });

        // Cleanup del listener quando il componente viene smontato
        return () => unsubscribe();
      } catch (error) {
        console.error('Errore nel caricamento della visibilità:', error);
      }
    };

    loadProfileVisibility();
  }, [currentUser, profileData.uid]);

  // Funzione per controllare se l'utente può vedere i contenuti
  const canViewContent = () => {
    if (isOwnProfile) return true;
    
    switch (profileVisibility) {
      case 'public':
        return true;
      case 'private':
        return isFollowing;
      case 'followers':
        return isFollowing;
      default:
        return false;
    }
  };

  // Modifica la funzione handleFollowToggle
  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      if (isFollowing || isPending) {
        await handleUnfollow();
      } else {
        await handleFollow(profileVisibility === 'private');
      }
    } catch (error) {
      console.error('Errore durante l\'operazione di follow:', error);
      alert('Errore durante l\'operazione. Riprova più tardi.');
    }
  };

  return (
    <ProfileLayout>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8 p-6">
        {/* Immagine del profilo */}
        <div className="flex-shrink-0">
          <img
            src={profileData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.displayName)}`}
            alt={profileData.displayName}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-2 theme-border"
          />
        </div>

        {/* Info profilo */}
        <div className="flex-grow">
          {/* Nome e pulsante segui */}
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-xl font-semibold theme-text">
              {profileData.displayName}
              {profileVisibility === 'private' && (
                <Lock className="inline-block ml-2 w-4 h-4 opacity-70" />
              )}
            </h1>
            {!isOwnProfile && (profileVisibility === 'public' || isFollowing) && (
              <button
                onClick={handleFollowToggle}
                className={`px-4 py-1.5 rounded-lg ${
                  isFollowing || isPending
                    ? 'theme-bg-secondary theme-text' 
                    : 'theme-bg-accent theme-text'
                } text-sm font-medium`}
              >
                {isFollowing ? 'Non seguire più' : isPending ? 'Richiesta inviata' : 'Segui'}
              </button>
            )}
          </div>

          {/* Contatori */}
          <div className="flex gap-8 mb-4">
            <div className="text-center">
              <span className="font-semibold theme-text block">{profileData.stats?.posts || 0}</span>
              <span className="text-sm theme-text opacity-70">post</span>
            </div>
            <div className="text-center">
              <span className="font-semibold theme-text block">{profileData.stats?.followers - (isFollowing ? 1 : 0) || 0}</span>
              <span className="text-sm theme-text opacity-70">follower</span>
            </div>
            <div className="text-center">
              <span className="font-semibold theme-text block">{profileData.stats?.following || 0}</span>
              <span className="text-sm theme-text opacity-70">seguiti</span>
            </div>
          </div>

          {/* Informazioni demografiche */}
          {canViewContent() && (
            <div className="mt-4">
              <DemographicInfo 
                userData={{
                  birthYear: profileData.birthYear,
                  country: profileData.country,
                  platform: profileData.platform,
                  location: profileData.location,
                  email: profileData.email,
                  phone: profileData.phone,
                  secondaryEmail: profileData.secondaryEmail
                }}
              />
            </div>
          )}
        </div>
      </div>

      {canViewContent() ? (
        <>
          {/* Contenuti del profilo */}
          <div className="grid md:grid-cols-2 gap-4 p-6">
            {/* ... servizi e altri contenuti ... */}
          </div>
          
          {/* Griglia dei post */}
          <div className="p-4 mb-20">
            {/* <div className="p-4">
              <PostGrid 
                isOwnProfile={isOwnProfile} 
                userId={profileData.uid}
              />
            </div> */}
          </div>
        </>
      ) : (
        <div className="p-6 text-center theme-text">
          <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold mb-2">
            {profileVisibility === 'private' 
              ? 'Questo account è privato'
              : 'Contenuto visibile solo ai follower'}
          </h3>
          <p className="mb-4 text-sm opacity-70">
            Segui questo account per vedere i suoi contenuti
          </p>
          {!isFollowing && !isOwnProfile && (
            <button
              onClick={handleFollowToggle}
              className="px-4 py-2 rounded-lg theme-bg-accent theme-text-on-accent"
            >
              {isPending ? 'Richiesta inviata' : 'Segui'}
            </button>
          )}
        </div>
      )}
    </ProfileLayout>
  );
};

export default ProfileView;