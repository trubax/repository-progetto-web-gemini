import { Globe, Users, Lock, Plus, Search, Briefcase, HandHeart, Grid, Play, Bookmark, Heart, MessageCircle, Layers, Trash2, Instagram, Facebook, Twitter, Linkedin, Youtube, Edit, Settings, UserMinus, UserPlus, Clock } from 'lucide-react';
import { PrivacySettings } from '../../pages/ProfilePage';
import { useNavigate, useParams } from 'react-router-dom';
import ProfilePhotoUpload from './ProfilePhotoUpload';
import ProfileLayout from './ProfileLayout';
import { useTheme } from '../../contexts/ThemeContext';
import { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../ui/Dialog';
import { useAuth } from '@/hooks/useAuth';
import { ServiceModal } from './ServiceModal';
import { PostGrid } from './PostGrid';
import { VideoGrid } from './VideoGrid';
import { CollectionGrid } from './CollectionGrid';
import { ServiceDetailDialog } from '../ui/ServiceDetailDialog';
import { followUser, unfollowUser, sendFollowRequest, checkFollowRequestStatus } from '@/lib/follow';
import { db } from '@/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { FollowersDialog } from '../dialogs/FollowersDialog';
import { FollowingDialog } from '../dialogs/FollowingDialog';
import { useFollowers } from '@/hooks/useFollowers';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  rate?: string;
  availability?: string;
}

interface SocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
}

interface ProfileData {
  uid: string;
  id: string;
  displayName: string;
  photoURL: string;
  bio?: string;
  socialLinks?: SocialLinks;
  stats: {
    posts: number;
    videos: number;
    followers: number;
    following: number;
  };
  posts?: {
    imageUrl: string;
    caption: string;
    likes: number;
    comments: number;
  }[];
  videos?: {
    url: string;
    views: number;
  }[];
  collections?: {
    coverUrl: string;
    name: string;
    itemCount: number;
  }[];
  servicesOffered: Service[];
  servicesRequested: Service[];
}

interface ProfileViewProps {
  profileData: any;
  isOwnProfile: boolean;
  privacy: PrivacySettings;
  onPhotoChange: (url: string) => Promise<void>;
  onDeleteService: (id: string) => Promise<void>;
  onAddService: (type: 'offered' | 'requested', service: Partial<Service>) => Promise<boolean>;
}

interface ProfileStats {
  posts: number;
  videos: number;
  followers: number;
  following: number;
}

export default function ProfileView({ 
  profileData, 
  isOwnProfile, 
  privacy, 
  onPhotoChange,
  onAddService,
  onDeleteService
}: ProfileViewProps) {
  const { isAnonymous, currentUser } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const targetUserId = useMemo(() => {
    return profileData?.id || userId || currentUser?.uid;
  }, [profileData?.id, userId, currentUser?.uid]);

  const { followersCount, followingCount, isLoading: followersLoading } = useFollowers(targetUserId);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceType, setServiceType] = useState<'offered' | 'requested'>('offered');
  const [newService, setNewService] = useState<Partial<Service>>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'posts' | 'collections'>('videos');
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [showAddCollectionModal, setShowAddCollectionModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequestedFollow, setHasRequestedFollow] = useState(false);
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [showFollowingDialog, setShowFollowingDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoCount, setVideoCount] = useState(0);

  useEffect(() => {
    console.log('Debug ProfileView:', {
      targetUserId,
      profileDataId: profileData?.id,
      urlUserId: userId,
      currentUserId: currentUser?.uid,
      isOwnProfile
    });
  }, [targetUserId, profileData, userId, currentUser, isOwnProfile]);

  // Corretto useEffect per il conteggio dei video
  useEffect(() => {
    if (!profileData?.uid) return;

    const videosRef = collection(db, 'videos');
    const q = query(videosRef, where('userId', '==', profileData.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const validVideos = snapshot.docs.filter(doc => !doc.data().deleted);
      setVideoCount(validVideos.length);
    });

    return () => unsubscribe();
  }, [profileData?.uid]);

  // Nascondi completamente il contenuto per utenti anonimi
  if (isAnonymous) {
    return (
      <div className="p-6 text-center theme-text">
        <h2 className="text-xl font-semibold mb-4">Accesso Limitato</h2>
        <p className="mb-4">Per visualizzare i profili degli utenti devi effettuare l'accesso.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 rounded-lg theme-bg-secondary theme-text"
        >
          Accedi
        </button>
      </div>
    );
  }

  const handleAddServiceClick = (type: 'offered' | 'requested') => {
    setServiceType(type);
    setShowServiceModal(true);
  };

  const handleServiceNavigate = (direction: 'prev' | 'next') => {
    if (!selectedService) return;
    
    const allServices = [...profileData.servicesOffered, ...profileData.servicesRequested];
    const currentIndex = allServices.findIndex(s => s.id === selectedService.id);
    
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : allServices.length - 1;
    } else {
      newIndex = currentIndex < allServices.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedService(allServices[newIndex]);
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await onDeleteService(serviceId);
      if (selectedService?.id === serviceId) {
        setSelectedService(null);
      }
    } catch (error) {
      console.error('Errore durante l\'eliminazione del servizio:', error);
    }
  };

  const handleEditProfile = () => {
    navigate('/profile/manage');
  };

  // Verifica se l'utente può vedere i contenuti
  const canViewContent = () => {
    if (isOwnProfile) return true;
    if (privacy.accountType === 'public') return true;
    return isFollowing;
  };

  // Aggiungiamo la funzione per gestire le richieste di follow
  const handleFollowToggle = async (e: React.MouseEvent) => {
    // Previeni il comportamento di default che potrebbe causare refresh
    e.preventDefault();
    
    if (!currentUser?.uid || !targetUserId) {
      console.log('🚫 Dati mancanti per follow:', { currentUserId: currentUser?.uid, targetUserId });
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 Inizio operazione follow:', { currentUserId: currentUser.uid, targetUserId });
      
      if (privacy.accountType === 'private' && !isFollowing && !hasRequestedFollow) {
        await sendFollowRequest(currentUser.uid, targetUserId);
        setHasRequestedFollow(true);
        console.log('✅ Richiesta follow inviata');
      } else {
        const isNowFollowing = await followUser(currentUser.uid, targetUserId);
        if (isNowFollowing !== undefined) {
          setIsFollowing(isNowFollowing);
          console.log('✅ Stato follow aggiornato:', { isNowFollowing });
        } else {
          console.error('❌ Errore: stato follow non definito');
        }
      }
    } catch (error) {
      console.error('❌ Errore durante l\'operazione di follow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Effetto per controllare lo stato del follow
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!currentUser?.uid || !targetUserId || isOwnProfile) {
        console.log('🚫 Skip controllo follow:', { currentUserId: currentUser?.uid, targetUserId, isOwnProfile });
        return;
      }

      try {
        console.log('🔍 Controllo stato follow...');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (!userDoc.exists()) {
          console.log('❌ Documento utente non trovato');
          return;
        }

        const userData = userDoc.data();
        const following = Array.isArray(userData?.following) ? userData.following : [];
        const isFollowing = following.includes(targetUserId);
        
        console.log('📊 Stato follow:', { following, isFollowing });
        setIsFollowing(isFollowing);
      } catch (error) {
        console.error('❌ Errore nel controllo dello stato del follow:', error);
      }
    };

    checkFollowStatus();
  }, [currentUser?.uid, targetUserId, isOwnProfile]);

  // Aggiungi questo useEffect per il debugging
  useEffect(() => {
    console.log('🔍 ProfileView - Dati completi:', {
      profileData,
      isOwnProfile,
      currentUserId: currentUser?.uid,
      providedUserId: isOwnProfile ? currentUser?.uid : profileData?.id,
      profileDataRaw: profileData
    });
  }, [profileData, isOwnProfile, currentUser]);

  const handleVideoCountChange = (count: number) => {
    setVideoCount(count);
  };

  return (
    <ProfileLayout isOwnProfile={isOwnProfile}>
      <div className="container mx-auto max-w-4xl mt-[60px] pb-[20px]">
        <div className="flex flex-col items-center gap-6 p-4">
          {/* Foto profilo */}
          <div className="relative z-10">
            {isOwnProfile ? (
              <ProfilePhotoUpload
                currentPhotoURL={currentUser?.photoURL || profileData.photoURL}
                onPhotoChange={onPhotoChange}
              />
            ) : (
              <img
                src={profileData.photoURL}
                alt={profileData.displayName}
                className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover border-2 theme-border"
              />
            )}
          </div>

          {/* Nome utente e pulsante modifica */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4">
              <h1 className="text-xl font-semibold theme-text">{profileData.displayName}</h1>
              {isOwnProfile && (
                <button 
                  onClick={handleEditProfile}
                  className="p-2 rounded-lg hover:theme-bg-secondary transition-colors theme-text flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Modifica profilo</span>
                </button>
              )}
            </div>

            {/* Statistiche profilo */}
            <div className="flex justify-center gap-8 mt-4">
              <div className="text-center">
                <div className="font-semibold theme-text">{profileData?.stats?.posts || 0}</div>
                <div className="text-sm theme-text-secondary">post</div>
              </div>
              
              <div className="text-center">
                <div className="font-semibold theme-text">{videoCount}</div>
                <div className="text-sm theme-text-secondary">video</div>
              </div>

              <button 
                onClick={() => setShowFollowersDialog(true)}
                className="text-center cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="font-semibold theme-text">{profileData?.stats?.followers || 0}</div>
                <div className="text-sm theme-text-secondary">follower</div>
              </button>

              <button
                onClick={() => setShowFollowingDialog(true)}
                className="text-center cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="font-semibold theme-text">{profileData?.stats?.following || 0}</div>
                <div className="text-sm theme-text-secondary">seguiti</div>
              </button>

              {!isOwnProfile && (
                <button
                  onClick={handleFollowToggle}
                  disabled={isLoading}
                  className="text-center cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {isLoading ? (
                    <div className="font-semibold theme-text">...</div>
                  ) : (
                    <>
                      <div className="font-semibold theme-text">
                        {isFollowing ? <UserMinus className="w-5 h-5 mx-auto" /> : <UserPlus className="w-5 h-5 mx-auto" />}
                      </div>
                      <div className="text-sm theme-text-secondary">
                        {isFollowing ? 'Non seguire' : 'Segui'}
                      </div>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sezione Servizi */}
        {canViewContent() ? (
          <div className="grid md:grid-cols-2 gap-4 p-6">
            {/* Servizi Offerti */}
            <div className="theme-bg-primary rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold theme-text flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Servizi Offerti
                </h3>
                {isOwnProfile && (
                  <button
                    onClick={() => handleAddServiceClick('offered')}
                    className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
                  >
                    <Plus className="w-5 h-5 theme-text" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {profileData.servicesOffered.map((service) => (
                  <div key={service.id} className="flex items-center justify-between w-full">
                    <button
                      onClick={() => setSelectedService(service)}
                      className="flex-1 p-3 text-left rounded-lg hover:theme-bg-secondary transition-colors theme-text"
                    >
                      {service.name}
                    </button>
                    {isOwnProfile && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewService(service);
                            setServiceType('offered');
                            setShowServiceModal(true);
                          }}
                          className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
                          title="Modifica servizio"
                        >
                          <Edit className="w-4 h-4 theme-text" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteService(service.id);
                          }}
                          className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
                          title="Elimina servizio"
                        >
                          <Trash2 className="w-4 h-4 theme-text" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Servizi Richiesti */}
            <div className="theme-bg-primary rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold theme-text flex items-center gap-2">
                  <HandHeart className="w-5 h-5" />
                  Servizi Richiesti
                </h3>
                {isOwnProfile && (
                  <button
                    onClick={() => handleAddServiceClick('requested')}
                    className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
                  >
                    <Plus className="w-5 h-5 theme-text" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {profileData.servicesRequested.map((service) => (
                  <div key={service.id} className="flex items-center justify-between w-full">
                    <button
                      onClick={() => setSelectedService(service)}
                      className="flex-1 p-3 text-left rounded-lg hover:theme-bg-secondary transition-colors theme-text"
                    >
                      {service.name}
                    </button>
                    {isOwnProfile && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewService(service);
                            setServiceType('requested');
                            setShowServiceModal(true);
                          }}
                          className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
                          title="Modifica servizio"
                        >
                          <Edit className="w-4 h-4 theme-text" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteService(service.id);
                          }}
                          className="p-2 rounded-full hover:theme-bg-secondary transition-colors"
                          title="Elimina servizio"
                        >
                          <Trash2 className="w-4 h-4 theme-text" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center theme-text">
            <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Questo account è privato</h3>
            <p className="mb-4 text-sm opacity-70">
              Segui questo account per vedere le sue foto e video
            </p>
            {!hasRequestedFollow ? (
              <button
                onClick={handleFollowToggle}
                className="px-4 py-2 rounded-lg theme-bg-accent theme-text-on-accent"
              >
                Segui
              </button>
            ) : (
              <button
                disabled
                className="px-4 py-2 rounded-lg theme-bg-secondary theme-text opacity-70"
              >
                Richiesta inviata
              </button>
            )}
          </div>
        )}

        {/* Service Detail Dialog */}
        {selectedService && (
          <ServiceDetailDialog
            service={selectedService}
            onClose={() => setSelectedService(null)}
            userId={profileData.uid}
          />
        )}

        {/* Tabs per post, video e raccolte */}
        <div className="border-t theme-border mt-8">
          <div className="flex justify-center px-4">
            <div className="flex">
              <button 
                className={`flex items-center gap-2 px-6 py-4 border-t-2 ${
                  activeTab === 'posts' ? 'theme-border-accent theme-text' : 'border-transparent theme-text-secondary'
                }`}
                onClick={() => setActiveTab('posts')}
              >
                <Grid className="w-5 h-5" />
                <span className="text-sm font-medium">Post</span>
              </button>
              <button 
                className={`flex items-center gap-2 px-6 py-4 border-t-2 ${
                  activeTab === 'videos' ? 'theme-border-accent theme-text' : 'border-transparent theme-text-secondary'
                }`}
                onClick={() => setActiveTab('videos')}
              >
                <Play className="w-5 h-5" />
                <span className="text-sm font-medium">Video</span>
              </button>
              <button 
                className={`flex items-center gap-2 px-6 py-4 border-t-2 ${
                  activeTab === 'collections' ? 'theme-border-accent theme-text' : 'border-transparent theme-text-secondary'
                }`}
                onClick={() => setActiveTab('collections')}
              >
                <Bookmark className="w-5 h-5" />
                <span className="text-sm font-medium">Raccolte</span>
              </button>
            </div>
          </div>
        </div>

        {/* Griglia dei contenuti */}
        <div className="p-4 mb-20">
          {activeTab === 'posts' && canViewContent() && (
            <div className="p-4">
              <PostGrid 
                userId={targetUserId}
                isOwnProfile={isOwnProfile}
                onError={(error) => {
                  console.log('Debug PostGrid:', {
                    targetUserId,
                    profileDataId: profileData?.id,
                    urlUserId: userId,
                    currentUserId: currentUser?.uid,
                    isOwnProfile,
                    error
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'videos' && canViewContent() && (
            <div className="p-4">
              <VideoGrid 
                userId={targetUserId}
                isOwnProfile={isOwnProfile}
                onVideoCountChange={handleVideoCountChange}
                onError={(error) => {
                  console.log('Debug VideoGrid:', {
                    targetUserId,
                    profileDataId: profileData?.id,
                    urlUserId: userId,
                    currentUserId: currentUser?.uid,
                    isOwnProfile,
                    error
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="p-4">
              <CollectionGrid isOwnProfile={isOwnProfile} />
            </div>
          )}
        </div>

        {/* Modal per aggiunta servizio */}
        <ServiceModal
          open={showServiceModal}
          onOpenChange={setShowServiceModal}
          type={serviceType}
          onSubmit={async (service) => {
            await onAddService(serviceType, service);
            setShowServiceModal(false);
          }}
        />

        {/* Dialog per follower e seguiti */}
        <FollowersDialog 
          isOpen={showFollowersDialog}
          onClose={() => setShowFollowersDialog(false)}
          userId={profileData.id}
        />

        <FollowingDialog 
          isOpen={showFollowingDialog}
          onClose={() => setShowFollowingDialog(false)}
          userId={profileData.id}
          isOwnProfile={isOwnProfile}
        />
      </div>
    </ProfileLayout>
  );
} 