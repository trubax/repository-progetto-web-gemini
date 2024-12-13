import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import ProfileLayout from './ProfileLayout';
import { UserPlus, UserMinus } from 'lucide-react';
import { Lock } from 'lucide-react';
import { useFollow } from '../../hooks/useFollow';

interface PublicProfileProps {
  userId: string;
  profileData: {
    displayName: string;
    photoURL: string;
    bio: string;
    location?: string;
    website?: string;
    stats: {
      posts: number;
      followers: number;
      following: number;
    };
    followers?: string[];
    following?: string[];
    isPrivate?: boolean;
  };
}

export default function PublicProfileView({ userId, profileData }: PublicProfileProps) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [followersCount, setFollowersCount] = useState(profileData.stats?.followers || 0);
  const { isFollowing, isPending, handleFollow, handleUnfollow } = useFollow(userId, currentUser?.uid || '');

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!currentUser) return;
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      setFollowersCount(userData?.followers?.length || 0);
    };

    checkFollowStatus();
  }, [userId, currentUser]);

  const handleFollowClick = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      if (isFollowing || isPending) {
        await handleUnfollow();
        if (isFollowing) {
          setFollowersCount(prev => prev - 1);
        }
      } else {
        await handleFollow(!!profileData.isPrivate);
        if (!profileData.isPrivate) {
          setFollowersCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Errore durante l\'aggiornamento del follow:', error);
    }
  };

  return (
    <ProfileLayout>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8 p-6">
        <div className="flex-shrink-0">
          <img
            src={profileData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.displayName)}`}
            alt={profileData.displayName}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-2 theme-border"
          />
        </div>

        <div className="flex-grow">
          {profileData.isPrivate && !isFollowing && currentUser?.uid !== userId ? (
            <div className="flex flex-col items-center gap-4">
              <Lock className="w-8 h-8 theme-text opacity-70" />
              <p className="text-center theme-text opacity-70">
                Questo account è privato. Segui questo account per vedere i suoi contenuti.
              </p>
              {currentUser?.uid !== userId && (
                <button
                  onClick={handleFollowClick}
                  className="px-4 py-1.5 rounded-lg theme-bg-accent theme-text text-sm font-medium flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Segui
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-xl font-semibold theme-text">{profileData.displayName}</h1>
                {currentUser?.uid !== userId && (
                  <button
                    onClick={handleFollowClick}
                    className={`px-4 py-1.5 rounded-lg ${
                      isFollowing 
                        ? 'theme-bg-secondary theme-text' 
                        : 'theme-bg-accent theme-text'
                    } text-sm font-medium flex items-center gap-2`}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Non seguire più
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Segui
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex gap-8 mb-4">
                <div className="text-center">
                  <span className="font-semibold theme-text block">{profileData.stats?.posts || 0}</span>
                  <span className="text-sm theme-text opacity-70">post</span>
                </div>
                <div className="text-center">
                  <span className="font-semibold theme-text block">{followersCount}</span>
                  <span className="text-sm theme-text opacity-70">follower</span>
                </div>
                <div className="text-center">
                  <span className="font-semibold theme-text block">{profileData.stats?.following || 0}</span>
                  <span className="text-sm theme-text opacity-70">seguiti</span>
                </div>
              </div>

              {profileData.bio && (
                <p className="theme-text whitespace-pre-wrap">{profileData.bio}</p>
              )}
              
              {profileData.location && (
                <p className="text-sm theme-text opacity-70 mt-2">{profileData.location}</p>
              )}
              
              {profileData.website && (
                <a 
                  href={profileData.website}
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="text-sm theme-accent hover:underline mt-1 block"
                >
                  {profileData.website}
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </ProfileLayout>
  );
}