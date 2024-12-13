import { Dialog } from '../ui/Dialog';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Heart, MessageCircle, Trash2, X, MoreVertical, ChevronDown, ChevronUp, Eye, Share2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

interface VideoDetailDialogProps {
  video: Video;
  onClose: () => void;
  isOwnVideo: boolean;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: any;
  replyTo?: string;
  replyToUserName?: string;
}

interface Video {
  id: string;
  url: string;
  title?: string;
  description: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: any;
  likes?: string[];
  comments?: Comment[];
}

// Modifica il componente video
const VideoPlayer = ({ videoUrl }: { videoUrl: string }) => {
  return (
    <iframe 
      className="absolute inset-0 w-full h-full"
      src={videoUrl}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    ></iframe>
  );
};

export function VideoDetailDialog({ video, onClose, isOwnVideo, onNavigate }: VideoDetailDialogProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [comment, setComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes?.length || 0);
  const [replyingTo, setReplyingTo] = useState<{ id: string; userName: string; } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState(video.title || '');
  const [editDescription, setEditDescription] = useState(video.description || '');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [videoUser, setVideoUser] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [shareCount, setShareCount] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>("");

  useEffect(() => {
    const loadVideo = async () => {
      try {
        const videoRef = ref(storage, video.url);
        const url = await getDownloadURL(videoRef);
        setVideoUrl(url);
      } catch (error) {
        console.error('Errore caricamento video:', error);
      }
    };

    loadVideo();
  }, [video]);

  useEffect(() => {
    if (currentUser && video.likes) {
      setIsLiked(video.likes.includes(currentUser.uid));
      setLikesCount(video.likes.length);
    }
  }, [video.likes, currentUser]);

  useEffect(() => {
    if (!currentUser || !video.id) return;
    
    const trackView = async () => {
      try {
        // Riferimento al documento delle visualizzazioni del video
        const viewsRef = doc(db, 'videos', video.id, 'stats', 'views');
        const now = new Date();
        const viewerId = currentUser.uid;
        
        // Recupera il documento delle visualizzazioni
        const viewsDoc = await getDoc(viewsRef);
        const viewsData = viewsDoc.data() || { views: {} };
        
        // Controlla se l'utente ha già visualizzato il video nelle ultime 24 ore
        const lastView = viewsData.views[viewerId];
        const hasRecentView = lastView && 
          (now.getTime() - lastView.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
        
        if (!hasRecentView) {
          // Aggiorna la visualizzazione dell'utente
          await setDoc(viewsRef, {
            views: {
              ...viewsData.views,
              [viewerId]: {
                timestamp: now,
                userId: viewerId
              }
            }
          }, { merge: true });
        }
        
        // Conta le visualizzazioni uniche nelle ultime 24 ore
        const uniqueViews = Object.values(viewsData.views).filter((view: any) => {
          return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
        }).length;
        
        setViewCount(uniqueViews);
      } catch (error) {
        console.error('Errore nel tracciamento della visualizzazione:', error);
      }
    };

    trackView();
  }, [video.id, currentUser]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!video.userId) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', video.userId));
        if (userDoc.exists()) {
          setVideoUser(userDoc.data());
        }
      } catch (error) {
        console.error('Errore nel caricamento dati utente:', error);
      }
    };

    fetchUserData();
  }, [video.userId]);

  useEffect(() => {
    if (!video.id) return;

    const videoRef = doc(db, 'videos', video.id);
    const unsubscribe = onSnapshot(videoRef, (doc) => {
      if (doc.exists()) {
        const videoData = doc.data();
        setComments(videoData.comments || []);
      }
    }, (error) => {
      console.error('Errore nell\'ascolto dei commenti:', error);
    });

    return () => unsubscribe();
  }, [video.id]);

  useEffect(() => {
    if (!video.id) return;

    const videoRef = doc(db, 'videos', video.id);
    const unsubscribe = onSnapshot(videoRef, (doc) => {
      if (doc.exists()) {
        const videoData = doc.data();
        setShareCount(videoData.shares?.length || 0);
      }
    });

    return () => unsubscribe();
  }, [video.id]);

  const handleLike = async () => {
    if (!currentUser) return;

    try {
      const videoRef = doc(db, 'videos', video.id);
      const newLikes = isLiked 
        ? (video.likes || []).filter(id => id !== currentUser.uid)
        : [...(video.likes || []), currentUser.uid];
      
      await updateDoc(videoRef, {
        likes: newLikes
      });

      setIsLiked(!isLiked);
      setLikesCount(newLikes.length);
      
      // Aggiorna anche il video originale
      video.likes = newLikes;
    } catch (error) {
      console.error('Errore nel gestire il like:', error);
    }
  };

  const handleComment = async () => {
    if (!currentUser || !comment.trim()) return;

    try {
      const newComment: Comment = {
        id: crypto.randomUUID(),
        text: comment.trim(),
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Utente',
        userPhotoURL: currentUser.photoURL || undefined,
        createdAt: new Date().toISOString(),
        ...(replyingTo && {
          replyTo: replyingTo.id,
          replyToUserName: replyingTo.userName
        })
      };

      const videoRef = doc(db, 'videos', video.id);
      const updatedComments = [...(video.comments || []), newComment];
      
      await updateDoc(videoRef, {
        comments: updatedComments
      });

      // Aggiorna il video originale
      video.comments = updatedComments;

      setComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
    }
  };

  // Funzione helper per formattare le date
  const formatDate = (dateValue: any) => {
    try {
      // Se è un timestamp di Firestore
      if (dateValue?.toDate) {
        return formatDistanceToNow(dateValue.toDate(), { 
          addSuffix: true,
          locale: it 
        });
      }
      // Se è una stringa ISO o un oggetto Date
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      if (date instanceof Date && !isNaN(date.getTime())) {
        return formatDistanceToNow(date, { 
          addSuffix: true,
          locale: it 
        });
      }
      return 'Data non disponibile';
    } catch (error) {
      console.error('Errore nella formattazione della data:', error);
      return 'Data non disponibile';
    }
  };

  const handleEdit = async () => {
    if (!currentUser) return;

    try {
      const videoRef = doc(db, 'videos', video.id);
      await updateDoc(videoRef, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });

      // Aggiorna il video originale
      video.title = editTitle.trim();
      video.description = editDescription.trim();
      
      setShowEditDialog(false);
    } catch (error) {
      console.error('Errore nella modifica del video:', error);
    }
  };

  const handleDelete = async () => {
    if (!currentUser) return;
    
    try {
      // Elimina il video
      await deleteDoc(doc(db, 'videos', video.id));
      
      // Aggiorna il conteggio dei video
      const userRef = doc(db, 'users', video.userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const currentCount = userDoc.data()?.stats?.videos || 0;
        await updateDoc(userRef, {
          'stats.videos': Math.max(0, currentCount - 1)
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Errore durante l\'eliminazione del video:', error);
    }
  };

  const handleUserClick = (userId: string) => {
    onClose(); // Chiudi il dialog
    navigate(`/profile/${userId}`); // Naviga al profilo
  };

  const handleCommentLike = async (commentId: string) => {
    if (!currentUser) return;
    
    try {
      const videoRef = doc(db, 'videos', video.id);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) return;
      
      const updatedComments = [...comments];
      const commentIndex = updatedComments.findIndex((c) => c.id === commentId);
      
      if (commentIndex === -1) return;
      
      const comment = updatedComments[commentIndex];
      const likes = comment.likes || [];
      const isLiked = likes.includes(currentUser.uid);
      
      updatedComments[commentIndex] = {
        ...comment,
        likes: isLiked 
          ? likes.filter((uid: string) => uid !== currentUser.uid)
          : [...likes, currentUser.uid]
      };
      
      await updateDoc(videoRef, { comments: updatedComments });
    } catch (error) {
      console.error('Errore nel like al commento:', error);
    }
  };

  const handleShare = async () => {
    if (!currentUser) return;

    try {
      const videoRef = doc(db, 'videos', video.id);
      const videoDoc = await getDoc(videoRef);

      if (!videoDoc.exists()) return;

      const shares = videoDoc.data().shares || [];
      const hasShared = shares.includes(currentUser.uid);

      if (!hasShared) {
        await updateDoc(videoRef, {
          shares: arrayUnion(currentUser.uid)
        });
      }

      const shareUrl = `${window.location.origin}/video/${video.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: video.title || 'Video condiviso',
          text: video.description || 'Guarda questo video!',
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copiato negli appunti!'); // Usiamo un semplice alert per ora
      }
    } catch (error) {
      console.error('Errore nella condivisione:', error);
      alert('Errore durante la condivisione'); // Usiamo un semplice alert per ora
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]" aria-hidden="true" />
      <div className="fixed inset-0 bottom-[60px] flex items-center justify-center z-[100]">
        <div className="theme-bg-primary w-full h-full md:h-[90vh] md:max-w-5xl md:rounded-xl md:shadow-lg overflow-hidden">
          {/* Header principale */}
          <div className="p-4 border-b theme-border flex justify-between items-center">
            <h2 className="font-medium theme-text text-lg truncate pr-4">
              {video.title || 'Video senza titolo'}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {isOwnVideo && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="theme-text"
                  onClick={() => setShowEditDialog(true)}
                >
                  Modifica
                </Button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:theme-bg-secondary transition-colors"
              >
                <X className="w-5 h-5 theme-text" />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row h-[calc(100%-60px)]">
            {/* Container video e dettagli */}
            <div className="w-full md:w-[60%] flex flex-col">
              {/* Video container */}
              <div className="w-full h-[35vh] md:h-[60%] bg-black relative">
                <iframe 
                  className="absolute inset-0 w-full h-full"
                  src={videoUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>

                {/* Controlli di navigazione */}
                {onNavigate && (
                  <>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                      <button
                        onClick={() => onNavigate('prev')}
                        className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                      >
                        <ArrowLeft className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                      <button
                        onClick={() => onNavigate('next')}
                        className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                      >
                        <ArrowRight className="w-6 h-6" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Menu espandibile dettagli */}
              <div className="border-t theme-border">
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="w-full px-4 py-3 flex items-center justify-between theme-text hover:theme-bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={videoUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(videoUser?.displayName || 'U')}`}
                      fallback={(videoUser?.displayName?.[0] || 'U').toUpperCase()}
                      className="w-8 h-8"
                    />
                    <div className="text-left">
                      <div className="font-medium">
                        {videoUser?.displayName || 'Utente'}
                      </div>
                      <div className="text-sm opacity-70">
                        {formatDistanceToNow(
                          video.createdAt?.toDate() || new Date(),
                          { addSuffix: true, locale: it }
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike();
                      }}
                      className={`flex items-center gap-1 hover:opacity-80 transition-opacity ${
                        isLiked ? 'text-red-500' : 'theme-text'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                      <span className="text-sm">{likesCount}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare();
                      }}
                      className="flex items-center gap-1 hover:opacity-80 transition-opacity theme-text"
                    >
                      <Share2 className="w-5 h-5" />
                      <span className="text-sm">{shareCount || ''}</span>
                    </button>
                    <div className="flex items-center gap-1 theme-text">
                      <Eye className="w-5 h-5" />
                      <span className="text-sm">{viewCount}</span>
                    </div>
                    {isDescriptionExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>
                
                {isDescriptionExpanded && (
                  <div className="px-4 py-3 theme-text border-t theme-border theme-bg-secondary">
                    <h3 className="font-medium mb-2">Descrizione</h3>
                    <p className="text-sm whitespace-pre-wrap break-words opacity-90">
                      {video.description || 'Nessuna descrizione disponibile'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Container commenti e descrizione */}
            <div className="w-full md:w-[40%] flex flex-col border-t md:border-t-0 md:border-l theme-border h-[calc(65vh-60px)] md:h-full">
              {/* Area commenti scrollabile con padding aumentato */}
              <div className="flex-1 overflow-y-auto min-h-0 pb-[180px]">
                <div className="p-4 space-y-4">
                  {comments.map((comment: any) => {
                    if (comment.replyTo) return null;

                    const commentLikes = comment.likes || [];
                    const isCommentLiked = currentUser && commentLikes.includes(currentUser.uid);

                    return (
                      <div key={comment.id} className="space-y-3">
                        {/* Commento principale */}
                        <div className="flex gap-3">
                          <div 
                            onClick={() => handleUserClick(comment.userId)}
                            className="cursor-pointer hover:opacity-80"
                          >
                            <Avatar
                              src={comment.userPhotoURL}
                              fallback={(comment.userName?.[0] || 'U').toUpperCase()}
                              className="w-8 h-8"
                            />
                          </div>
                          <div className="flex-1">
                            <div 
                              onClick={() => handleUserClick(comment.userId)}
                              className="font-medium cursor-pointer hover:underline"
                            >
                              {comment.userName || 'Utente'}
                            </div>
                            <p className="text-sm mt-1 mb-1">{comment.text}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <button
                                onClick={() => handleCommentLike(comment.id)}
                                className={`flex items-center gap-1 hover:opacity-80 transition-opacity ${
                                  isCommentLiked ? 'text-red-500' : 'theme-text-secondary'
                                }`}
                              >
                                <Heart className={`w-4 h-4 ${isCommentLiked ? 'fill-current' : ''}`} />
                                <span className="text-xs">{commentLikes.length || ''}</span>
                              </button>
                              <button
                                onClick={() => setReplyingTo({ id: comment.id, userName: comment.userName })}
                                className="text-sm theme-text-secondary hover:opacity-80 transition-opacity"
                              >
                                Rispondi
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Risposte al commento */}
                        {comments.filter(reply => reply.replyTo === comment.id).map((reply: any) => {
                          const replyLikes = reply.likes || [];
                          const isReplyLiked = currentUser && replyLikes.includes(currentUser.uid);

                          return (
                            <div key={reply.id} className="ml-11 flex gap-3 border-l-2 theme-border pl-4">
                              <div 
                                onClick={() => handleUserClick(reply.userId)}
                                className="cursor-pointer hover:opacity-80"
                              >
                                <Avatar
                                  src={reply.userPhotoURL}
                                  fallback={(reply.userName?.[0] || 'U').toUpperCase()}
                                  className="w-8 h-8"
                                />
                              </div>
                              <div className="flex-1">
                                <div 
                                  onClick={() => handleUserClick(reply.userId)}
                                  className="font-medium cursor-pointer hover:underline"
                                >
                                  {reply.userName || 'Utente'}
                                </div>
                                <p className="text-sm mt-1 mb-1">{reply.text}</p>
                                <div className="flex items-center gap-4 mt-1">
                                  <button
                                    onClick={() => handleCommentLike(reply.id)}
                                    className={`flex items-center gap-1 hover:opacity-80 transition-opacity ${
                                      isReplyLiked ? 'text-red-500' : 'theme-text-secondary'
                                    }`}
                                  >
                                    <Heart className={`w-4 h-4 ${isReplyLiked ? 'fill-current' : ''}`} />
                                    <span className="text-xs">{replyLikes.length || ''}</span>
                                  </button>
                                  <button
                                    onClick={() => setReplyingTo({ id: comment.id, userName: reply.userName })}
                                    className="text-sm theme-text-secondary hover:opacity-80 transition-opacity"
                                  >
                                    Rispondi
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input commento fisso sopra la barra di navigazione */}
      <div className="fixed bottom-[60px] left-0 right-0 border-t theme-border theme-bg-primary z-[100]">
        {replyingTo && (
          <div className="flex justify-between items-center px-4 py-2 text-sm theme-text opacity-70 theme-bg-secondary">
            <span>Risposta a @{replyingTo.userName}</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="hover:opacity-100"
            >
              Annulla
            </button>
          </div>
        )}
        <div className="p-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={replyingTo ? `Rispondi a @${replyingTo.userName}...` : "Aggiungi un commento..."}
              className="w-full px-4 py-2 pr-12 rounded-full theme-bg-secondary theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && comment.trim()) {
                  handleComment();
                }
              }}
            />
            <button
              onClick={handleComment}
              disabled={!comment.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 theme-text disabled:opacity-50 hover:opacity-90"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dialog di modifica */}
      {showEditDialog && (
        <div className="fixed inset-0 bottom-[60px] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <div 
            className="theme-bg-primary w-full h-full md:h-auto md:max-w-md md:rounded-xl md:shadow-lg p-6 overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold theme-text">
                Modifica video
              </h3>
              <button
                onClick={() => setShowEditDialog(false)}
                className="p-1 rounded-full hover:theme-bg-secondary transition-colors"
              >
                <X className="w-5 h-5 theme-text" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium theme-text mb-1">
                  Titolo
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Titolo del video"
                />
              </div>

              <div>
                <label className="block text-sm font-medium theme-text mb-1">
                  Descrizione
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  placeholder="Descrizione del video"
                />
              </div>

              <div className="flex flex-col gap-2 pt-4">
                {/* Pulsanti di azione con layout modificato */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowEditDialog(false)}
                    className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-90 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={!editTitle.trim() || !editDescription.trim()}
                    className="px-4 py-2 rounded-lg theme-bg-accent theme-text-accent disabled:opacity-50 transition-colors"
                  >
                    Salva
                  </button>
                </div>

                {/* Separatore */}
                <div className="border-t theme-border my-2"></div>

                {/* Pulsante elimina */}
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
} 