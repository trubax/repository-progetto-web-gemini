import { useState, useEffect, useRef } from 'react';
import { Dialog } from '../ui/dialog';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, serverTimestamp } from 'firebase/firestore';
import { generateUUID } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface VideoDetailDialogProps {
  video: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (videoId: string) => Promise<void>;
  onUpdate?: (videoId: string, data: any) => Promise<void>;
}

export function VideoDetailDialog({
  video,
  open,
  onOpenChange,
  onDelete,
  onUpdate
}: VideoDetailDialogProps) {
  const { currentUser } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const startTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const watchTimeRef = useRef<number>(0);
  const videoDurationRef = useRef<number>(0);
  const lastPlayedPositionRef = useRef<number>(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Funzione per aggiornare le statistiche
  const updateStats = async (watchTime: number, completionRate: number, currentPosition: number, duration: number) => {
    if (!currentUser || !video) return;

    try {
      const viewsRef = doc(db, 'videos', video.id, 'stats', 'views');
      await updateDoc(viewsRef, {
        [`views.${currentUser.uid}.watchTime`]: watchTime,
        [`views.${currentUser.uid}.completionRate`]: Math.min(completionRate, 100),
        [`views.${currentUser.uid}.lastPosition`]: currentPosition,
        [`views.${currentUser.uid}.duration`]: duration,
        [`views.${currentUser.uid}.lastUpdate`]: serverTimestamp()
      });

      // Aggiorna anche le statistiche aggregate del video
      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, {
        'stats.totalWatchTime': watchTime,
        'stats.averageCompletionRate': completionRate,
        'stats.lastUpdate': serverTimestamp()
      });
    } catch (error) {
      console.error('Errore aggiornamento statistiche:', error);
    }
  };

  useEffect(() => {
    if (video) {
      setComments(video.comments || []);
      setLikesCount(video.likes?.length || 0);
      setIsLiked(video.likes?.includes(currentUser?.uid) || false);

      // Registra la visualizzazione quando il dialog viene aperto
      if (currentUser) {
        const viewsRef = doc(db, 'videos', video.id, 'stats', 'views');
        updateDoc(viewsRef, {
          [`views.${currentUser.uid}`]: {
            timestamp: serverTimestamp(),
            userId: currentUser.uid,
            watchTime: 0,
            completionRate: 0,
            lastPosition: 0,
            lastUpdate: serverTimestamp()
          }
        }).catch(error => console.error('Errore aggiornamento visualizzazione:', error));
      }
    }

    // Cleanup dell'intervallo quando il componente viene smontato
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [video, currentUser]);

  const handleLike = async () => {
    if (!currentUser || !video) return;

    try {
      const videoRef = doc(db, 'videos', video.id);
      const operation = isLiked ? arrayRemove : arrayUnion;

      await updateDoc(videoRef, {
        likes: operation(currentUser.uid)
      });

      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    } catch (error) {
      console.error('Errore nel like:', error);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser || !video || !newComment.trim()) return;

    try {
      setLoading(true);
      const comment = {
        id: generateUUID(),
        text: newComment.trim(),
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userPhotoURL: currentUser.photoURL,
        createdAt: new Date().toISOString(),
        likes: []
      };

      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, {
        comments: arrayUnion(comment)
      });

      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPlay = () => {
    startTimeRef.current = Date.now();
    lastPlayedPositionRef.current = (document.querySelector('video') as HTMLVideoElement)?.currentTime || 0;

    // Avvia l'aggiornamento periodico delle statistiche
    updateIntervalRef.current = setInterval(() => {
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (videoElement && !videoElement.paused) {
        const currentTime = Date.now();
        const sessionDuration = (currentTime - startTimeRef.current) / 1000;
        const totalWatchTime = watchTimeRef.current + sessionDuration;
        const completionRate = (videoElement.currentTime / videoElement.duration) * 100;

        updateStats(totalWatchTime, completionRate, videoElement.currentTime, videoElement.duration);
      }
    }, 5000); // Aggiorna ogni 5 secondi
  };

  const handleVideoPause = async () => {
    if (!currentUser || !video || !startTimeRef.current) return;

    // Ferma l'aggiornamento periodico
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    const videoElement = document.querySelector('video') as HTMLVideoElement;
    if (!videoElement) return;

    const endTime = Date.now();
    const sessionDuration = (endTime - startTimeRef.current) / 1000;
    watchTimeRef.current += sessionDuration;

    const currentPosition = videoElement.currentTime;
    const duration = videoElement.duration;
    videoDurationRef.current = duration;
    const completionRate = (currentPosition / duration) * 100;

    await updateStats(watchTimeRef.current, completionRate, currentPosition, duration);
    lastUpdateRef.current = endTime;
  };

  const handleVideoEnded = () => {
    if (!currentUser || !video) return;

    // Ferma l'aggiornamento periodico
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    handleVideoPause();
    watchTimeRef.current = 0;
    
    // Aggiorna le statistiche finali
    updateStats(videoDurationRef.current, 100, videoDurationRef.current, videoDurationRef.current);
  };

  const formatDate = (date: any) => {
    if (!date) return '';

    try {
      // Se è un timestamp di Firestore
      if (date?.toDate) {
        return formatDistanceToNow(date.toDate(), { addSuffix: true, locale: it });
      }

      // Se è una stringa ISO
      if (typeof date === 'string') {
        return formatDistanceToNow(new Date(date), { addSuffix: true, locale: it });
      }

      return '';
    } catch (error) {
      console.error('Errore nel formato data:', error);
      return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex">
          {/* Video Section */}
          <div className="flex-1 relative">
            <video
              src={video?.videoUrl}
              className="w-full h-full object-contain"
              controls
              playsInline
              preload="metadata"
              controlsList="nodownload"
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onEnded={handleVideoEnded}
              onLoadedMetadata={(e) => {
                const videoElement = e.target as HTMLVideoElement;
                videoDurationRef.current = videoElement.duration;
                const viewsRef = doc(db, 'videos', video.id, 'stats', 'views');
                updateDoc(viewsRef, {
                  duration: videoElement.duration,
                  [`views.${currentUser?.uid}.videoDuration`]: videoElement.duration
                }).catch(error => console.error('Errore salvataggio durata:', error));
              }}
            />
          </div>

          {/* Comments Section */}
          <div className="w-[400px] flex flex-col border-l dark:border-gray-700">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={video?.userPhotoURL || `https://ui-avatars.com/api/?name=${video?.userName}`}
                    alt={video?.userName}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="font-medium">{video?.userName}</span>
                </div>
                {onDelete && (
                  <button
                    onClick={() => onDelete(video.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
                )}
              </div>
              <p className="mt-2">{video?.caption}</p>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <img
                    src={comment.userPhotoURL || `https://ui-avatars.com/api/?name=${comment.userName}`}
                    alt={comment.userName}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                      <p className="font-medium text-sm">{comment.userName}</p>
                      <p>{comment.text}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span>{formatDate(comment.createdAt)}</span>
                      <button className="hover:text-blue-500">Mi piace</button>
                      <button className="hover:text-blue-500">Rispondi</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t dark:border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={handleLike}
                  className="flex items-center gap-1 hover:text-red-500"
                >
                  <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                  <span>{likesCount}</span>
                </button>
                <button className="flex items-center gap-1">
                  <MessageCircle className="w-6 h-6" />
                  <span>{comments.length}</span>
                </button>
              </div>

              {/* Comment Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Aggiungi un commento..."
                  className="flex-1 p-2 rounded border dark:border-gray-700 dark:bg-gray-700"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newComment.trim()) {
                      handleAddComment();
                    }
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || loading}
                  className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-full disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}