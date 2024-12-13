import { useState, useEffect, useCallback } from 'react';
import { VideoDetailDialog } from './VideoDetailDialog';
import { VideoModal } from './VideoModal';
import { Plus, Loader2, Heart, MessageCircle, Trash2, X, Play } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { getVideoThumbnail, generateVideoThumbnail } from '../../utils/videoUtils';

interface Video {
  id: string;
  url: string;
  thumbnail?: string;
  title: string;
  description: string;
  userId: string;
  createdAt: any;
  likes?: string[];
  comments?: {
    id: string;
    text: string;
    userId: string;
    createdAt: string;
    userName: string;
    userPhotoURL?: string;
  }[];
}

interface VideoGridProps {
  userId: string;
  isOwnProfile: boolean;
  onError?: (error: any) => void;
  onVideoCountChange?: (count: number) => void;
}

export function VideoGrid({ userId, isOwnProfile, onError, onVideoCountChange }: VideoGridProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { currentUser } = useAuth();
  const [quickCommentVideo, setQuickCommentVideo] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState('');

  useEffect(() => {
    if (!userId) return;

    try {
      const videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', userId)
      );

      const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
        const videosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const sortedVideos = videosData.sort((a, b) => {
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });
        
        setVideos(sortedVideos);
        setIsLoading(false);

        if (onVideoCountChange) {
          onVideoCountChange(videosData.length);
        }
      }, (error) => {
        console.error('Errore nella query dei video:', error);
        onError?.(error);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Errore nel caricamento dei video:', error);
      onError?.(error);
      setIsLoading(false);
    }
  }, [userId, onVideoCountChange]);

  const updateVideoCount = async (userId: string, count: number) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        'stats.videos': count
      });
    } catch (error) {
      console.error('Errore nell\'aggiornamento del conteggio video:', error);
    }
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
  };

  const handleCloseDetail = () => {
    setSelectedVideo(null);
  };

  const handleVideoUpload = async (file: File, title: string, description: string) => {
    if (!currentUser) return;

    try {
      const MAX_SIZE = 100 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert("Il video non può superare i 100MB");
        return;
      }

      setIsUploading(true);
      
      const thumbnailUrl = await generateVideoThumbnail(file);
      
      const videoRef = ref(storage, `videos/${currentUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytesResumable(videoRef, file);
      const videoUrl = await getDownloadURL(videoRef);
      
      const videosRef = collection(db, 'videos');
      const docRef = await addDoc(videosRef, {
        url: videoUrl,
        thumbnailUrl,
        title,
        description,
        userId: currentUser.uid,
        createdAt: new Date(),
        likes: [],
        comments: []
      });

      const newVideo = {
        id: docRef.id,
        url: videoUrl,
        thumbnail: thumbnailUrl,
        title,
        description,
        userId: currentUser.uid,
        createdAt: new Date(),
        likes: [],
        comments: []
      };

      setVideos(prevVideos => [newVideo, ...prevVideos]);
      setIsVideoModalOpen(false);
      
      if (onVideoCountChange) {
        onVideoCountChange(videos.length + 1);
      }

    } catch (error) {
      console.error('Errore nel caricamento del video:', error);
      onError?.(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuickLike = async (videoId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser) return;

    try {
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        console.error('Video non trovato');
        return;
      }

      const videoData = videoDoc.data();
      const likes = videoData.likes || [];
      const hasLiked = likes.includes(currentUser.uid);

      await updateDoc(videoRef, {
        likes: hasLiked ? 
          arrayRemove(currentUser.uid) : 
          arrayUnion(currentUser.uid)
      });

      // Aggiorna lo stato locale in modo immutabile
      setVideos(prevVideos => 
        prevVideos.map(video => {
          if (video.id === videoId) {
            const currentLikes = video.likes || [];
            return {
              ...video,
              likes: hasLiked ?
                currentLikes.filter(id => id !== currentUser.uid) :
                [...currentLikes, currentUser.uid]
            };
          }
          return video;
        })
      );
    } catch (error) {
      console.error('Errore nel gestire il like:', error);
    }
  };

  const handleQuickDelete = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questo video?')) return;

    try {
      await deleteDoc(doc(db, 'videos', videoId));
      setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
    } catch (error) {
      console.error('Errore nell\'eliminazione del video:', error);
    }
  };

  const handleQuickComment = async (videoId: string) => {
    if (!quickComment.trim() || !currentUser) return;

    try {
      const newComment = {
        id: crypto.randomUUID(),
        userId: currentUser.uid,
        text: quickComment.trim(),
        createdAt: new Date().toISOString(),
        userName: currentUser.displayName || 'Utente',
        userPhotoURL: currentUser.photoURL
      };

      const videoRef = doc(db, 'videos', videoId);
      await updateDoc(videoRef, {
        comments: arrayUnion(newComment)
      });

      // Aggiorna stato locale
      setVideos(prevVideos => prevVideos.map(video => {
        if (video.id === videoId) {
          return {
            ...video,
            comments: [...(video.comments || []), newComment]
          };
        }
        return video;
      }));

      setQuickComment('');
      setQuickCommentVideo(null);
    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedVideo) return;
    
    const currentIndex = videos.findIndex(v => v.id === selectedVideo.id);
    const newIndex = direction === 'next' 
      ? (currentIndex + 1) % videos.length 
      : (currentIndex - 1 + videos.length) % videos.length;
    
    console.log('Navigazione video:', {
      direction,
      currentIndex,
      newIndex,
      nextVideoId: videos[newIndex].id
    });
    
    setSelectedVideo(videos[newIndex]);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {isOwnProfile && (
          <div 
            className="aspect-square relative cursor-pointer"
            onClick={() => setIsVideoModalOpen(true)}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed theme-border rounded-lg hover:opacity-70">
              {isUploading ? (
                <Loader2 className="w-8 h-8 animate-spin theme-text" />
              ) : (
                <>
                  <Plus className="w-8 h-8 theme-text" />
                  <span className="mt-2 text-sm theme-text">Carica video</span>
                </>
              )}
            </div>
          </div>
        )}
        
        {videos.map((video) => (
          <div
            key={video.id}
            className="aspect-square relative cursor-pointer overflow-hidden rounded-lg group"
            onClick={() => handleVideoClick(video)}
          >
            {/* Anteprima Video */}
            <div className="absolute inset-0">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={video.url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  poster={video.thumbnail}
                  onLoadedMetadata={(e) => {
                    const videoElement = e.target as HTMLVideoElement;
                    videoElement.currentTime = 1;
                  }}
                />
              )}
              {/* Overlay scuro e icona play */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Play className="w-12 h-12 text-white opacity-80" />
              </div>
            </div>
            
            {/* Overlay con azioni al hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Titolo del video */}
              <div className="absolute top-2 left-2 right-10 truncate">
                <span className="text-white text-sm font-medium">
                  {video.title || 'Video senza titolo'}
                </span>
              </div>

              {/* Pulsante elimina */}
              {isOwnProfile && (
                <button
                  onClick={(e) => handleQuickDelete(video.id, e)}
                  className="absolute top-2 right-2 p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              {/* Azioni in basso */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                <button
                  onClick={(e) => handleQuickLike(video.id, e)}
                  className={`p-2 rounded-full hover:bg-white/20 transition-colors flex items-center gap-1 ${
                    video.likes?.includes(currentUser?.uid || '') 
                      ? 'text-red-500' 
                      : 'text-white'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${
                    video.likes?.includes(currentUser?.uid || '') 
                      ? 'fill-current' 
                      : ''
                  }`} />
                  <span className="text-xs text-white">
                    {video.likes?.length || 0}
                  </span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuickCommentVideo(video.id);
                  }}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors text-white flex items-center gap-1"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-xs text-white">
                    {video.comments?.length || 0}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog per la visualizzazione del video */}
      {selectedVideo && (
        <VideoDetailDialog
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          isOwnVideo={isOwnProfile}
          onNavigate={handleNavigate}
        />
      )}

      {/* Dialog per il caricamento di nuovi video */}
      {isVideoModalOpen && (
        <VideoModal
          open={isVideoModalOpen}
          onOpenChange={setIsVideoModalOpen}
          onSubmit={handleVideoUpload}
        />
      )}

      {/* Dialog per commento rapido */}
      {quickCommentVideo && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setQuickCommentVideo(null)}
        >
          <div 
            className="theme-bg-primary rounded-xl shadow-lg max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold theme-text">
                  Aggiungi un commento
                </h3>
                <button
                  onClick={() => setQuickCommentVideo(null)}
                  className="p-1 rounded-full hover:theme-bg-secondary transition-colors"
                >
                  <X className="w-5 h-5 theme-text" />
                </button>
              </div>

              <input
                type="text"
                value={quickComment}
                onChange={(e) => setQuickComment(e.target.value)}
                placeholder="Scrivi un commento..."
                className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && quickComment.trim()) {
                    handleQuickComment(quickCommentVideo);
                  }
                }}
              />
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setQuickCommentVideo(null)}
                  className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-90 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => handleQuickComment(quickCommentVideo)}
                  disabled={!quickComment.trim()}
                  className="px-4 py-2 rounded-lg theme-bg-accent theme-text-accent disabled:opacity-50 transition-colors"
                >
                  Commenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 