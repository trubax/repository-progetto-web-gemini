import { useState, useEffect } from 'react';
import { Dialog } from './Dialog';
import { X, ArrowLeft, ArrowRight, Send, Heart, Edit, Trash2, Edit2, Check, MessageCircle, Share2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { updateDoc, arrayUnion, getDoc, onSnapshot, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ShareService } from '../../services/ShareService';

interface Comment {
  id: string;
  text: string;
  userId: string;
  createdAt: any;
  user: {
    displayName: string;
    photoURL: string;
  };
}

interface ContentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'post' | 'story';
  content: {
    id: string;
    userId: string;
    mediaUrl: string;
    caption?: string;
    comments: Comment[];
    createdAt: Date;
    likes?: Like[];
    stats?: PostStats;
    title?: string;
  };
  currentUser: {
    uid: string;
  };
  onDelete?: () => void;
  onUpdate?: (data: { caption?: string, title?: string }) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  onAddComment?: (text: string) => void;
  onLikeToggle?: (postId: string) => void;
  isLiked?: boolean;
  likesCount?: number;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function ContentDetailDialog({
  open,
  onOpenChange,
  type,
  content,
  currentUser,
  onDelete,
  onUpdate,
  onNavigate,
  onAddComment,
  onLikeToggle,
  isLiked,
  likesCount = 0
}: ContentDetailDialogProps) {
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(content.caption || '');
  const [isSaving, setIsSaving] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [localComments, setLocalComments] = useState(content.comments);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState(content.title || '');
  const [viewCount, setViewCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const postRef = doc(db, 'posts', content.id);
        const unsubscribe = onSnapshot(postRef, (doc) => {
          if (doc.exists()) {
            const postData = doc.data();
            setLocalComments(postData.comments || []);
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Errore nel caricamento dei commenti:', error);
        setCommentError('Impossibile caricare i commenti. Riprova più tardi.');
      }
    };

    if (open && content.id) {
      fetchComments();
    }
  }, [content.id, open]);

  useEffect(() => {
    const trackView = async () => {
      if (!currentUser || !content.id) return;

      try {
        // Reference to the views document in the stats subcollection
        const viewsRef = doc(db, 'posts', content.id, 'stats', 'views');
        const now = new Date();
        const viewerId = currentUser.uid;
        
        // Get current views data
        const viewsDoc = await getDoc(viewsRef);
        const viewsData = viewsDoc.data() || { views: {} };
        
        // Check if user has viewed in last 24 hours
        const lastView = viewsData.views[viewerId];
        const hasRecentView = lastView && 
          (now.getTime() - lastView.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
        
        if (!hasRecentView) {
          // Update user's view timestamp
          await setDoc(viewsRef, {
            views: {
              ...viewsData.views,
              [viewerId]: {
                timestamp: serverTimestamp(),
                userId: viewerId
              }
            }
          }, { merge: true });
        }
        
        // Count unique views in last 24 hours
        const uniqueViews = Object.values(viewsData.views).filter((view: any) => {
          return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
        }).length;
        
        setViewCount(uniqueViews);
      } catch (error) {
        console.error('Error tracking view:', error);
      }
    };

    if (open) {
      trackView();
    }
  }, [content.id, currentUser, open]);

  useEffect(() => {
    if (!content.id) return;

    const contentRef = doc(db, 'posts', content.id);
    const unsubscribe = onSnapshot(contentRef, (doc) => {
      if (doc.exists()) {
        const contentData = doc.data();
        setShareCount(contentData.shareCount || contentData.shares?.length || 0);
      }
    });

    return () => unsubscribe();
  }, [content.id]);

  const isOwnPost = currentUser?.uid === content.userId;

  const handleAddComment = async (text: string) => {
    if (!text.trim() || !currentUser) return;
    setCommentError(null);

    try {
      const newComment = {
        id: generateUUID(),
        userId: currentUser.uid,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        userName: currentUser.displayName || 'Utente',
        userPhotoURL: currentUser.photoURL,
        likes: [],
        replies: []
      };

      const postRef = doc(db, 'posts', content.id);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post non trovato');
      }

      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });

      const updatedComments = [...localComments, newComment];
      setLocalComments(updatedComments);
      
      if (onUpdate) {
        onUpdate({ 
          comments: updatedComments
        });
      }

      setNewComment('');

    } catch (error) {
      console.error('Errore nell\'aggiunta del commento:', error);
      setCommentError('Impossibile aggiungere il commento. Riprova più tardi.');
    }
  };

  const handleSave = async () => {
    if (!onUpdate) return;
    
    try {
      setIsSaving(true);
      await onUpdate({ caption: editedCaption });
      setIsEditing(false);
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      alert('Errore durante il salvataggio delle modifiche');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommentLike = async (commentId: string, isReply = false, parentCommentId?: string) => {
    if (!currentUser) return;
    
    try {
      const likeData = {
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      const postRef = doc(db, 'posts', content.id);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post non trovato');
      }

      const currentComments = postDoc.data().comments || [];
      const updatedComments = JSON.parse(JSON.stringify(currentComments));

      if (isReply && parentCommentId) {
        const parentComment = updatedComments.find(c => c.id === parentCommentId);
        if (!parentComment) return;

        const replyIndex = parentComment.replies?.findIndex(r => r.id === commentId);
        if (replyIndex === -1 || replyIndex === undefined) return;

        const hasLiked = parentComment.replies[replyIndex].likes?.some(
          like => like.userId === currentUser.uid
        );

        parentComment.replies[replyIndex].likes = hasLiked
          ? (parentComment.replies[replyIndex].likes || []).filter(
              like => like.userId !== currentUser.uid
            )
          : [...(parentComment.replies[replyIndex].likes || []), likeData];
      } else {
        const commentIndex = updatedComments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) return;

        const hasLiked = updatedComments[commentIndex].likes?.some(
          like => like.userId === currentUser.uid
        );

        updatedComments[commentIndex].likes = hasLiked
          ? (updatedComments[commentIndex].likes || []).filter(
              like => like.userId !== currentUser.uid
            )
          : [...(updatedComments[commentIndex].likes || []), likeData];
      }

      await updateDoc(postRef, { comments: updatedComments });
    } catch (error) {
      console.error('Errore nella gestione del like:', error);
      setCommentError('Impossibile aggiornare il like. Riprova più tardi.');
    }
  };

  const handleReplySubmit = async (commentId: string) => {
    if (!currentUser || !replyText.trim()) return;

    try {
      const newReply = {
        id: generateUUID(),
        userId: currentUser.uid,
        text: replyText.trim(),
        createdAt: new Date().toISOString(),
        userName: currentUser.displayName || 'Utente',
        userPhotoURL: currentUser.photoURL,
        likes: []
      };

      const postRef = doc(db, 'posts', content.id);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post non trovato');
      }

      const currentComments = postDoc.data().comments || [];
      const updatedComments = currentComments.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), newReply]
          };
        }
        return comment;
      });

      await updateDoc(postRef, { comments: updatedComments });
      setReplyText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Errore nell\'aggiunta della risposta:', error);
      setCommentError('Impossibile aggiungere la risposta. Riprova più tardi.');
    }
  };

  const handleShare = async () => {
    if (!currentUser || !content) return;

    try {
      // Aggiorna il contatore delle condivisioni nel documento principale
      const contentRef = doc(db, 'posts', content.id);
      const contentDoc = await getDoc(contentRef);

      if (!contentDoc.exists()) return;

      const shares = contentDoc.data().shares || [];
      const hasShared = shares.includes(currentUser.uid);

      if (!hasShared) {
        // Aggiorna l'array delle condivisioni
        await updateDoc(contentRef, {
          shares: arrayUnion(currentUser.uid)
        });

        // Aggiorna le statistiche di condivisione
        const sharesRef = doc(db, 'posts', content.id, 'stats', 'shares');
        await setDoc(sharesRef, {
          [`shares.${currentUser.uid}`]: {
            timestamp: serverTimestamp(),
            userId: currentUser.uid
          }
        }, { merge: true });
      }

      // Genera e copia il link di condivisione
      const shareUrl = `${window.location.origin}/post/${content.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: content.title || 'Post condiviso',
          text: content.caption || 'Guarda questo post!',
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copiato negli appunti!');
      }
    } catch (error) {
      console.error('Errore nella condivisione:', error);
      alert('Errore durante la condivisione');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9999]" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center z-[9999] pb-16">
        <div className="theme-bg-primary rounded-xl shadow-lg w-full h-[calc(100vh-5rem)] md:h-[90vh] flex flex-col md:max-w-5xl">
          {/* Header */}
          <div className="p-4 theme-border-base border-b flex justify-between items-center relative">
            <h2 className="text-lg font-semibold theme-text">
              {isEditing ? 'Modifica post' : (type === 'post' ? 'Post' : 'Storia')}
            </h2>

            {/* Pulsanti centrali solo se non in modalità modifica */}
            {isOwnPost && !isEditing && (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text group"
                  title="Modifica post"
                >
                  <Edit2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Sei sicuro di voler eliminare questo post?')) {
                      onDelete?.();
                      onOpenChange(false);
                    }
                  }}
                  className="p-2 hover:theme-bg-secondary rounded-full transition-colors text-red-500 group"
                  title="Elimina post"
                >
                  <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            )}

            {/* Pulsante di chiusura solo se non in modalità modifica */}
            {!isEditing && (
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Contenuto condizionale */}
          {isEditing ? (
            <div className="flex-1 flex flex-col h-[calc(100vh-10rem)]">
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="aspect-square bg-black rounded-lg overflow-hidden">
                    <img
                      src={content.mediaUrl}
                      alt={content.caption}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  <div className="space-y-6 mb-20">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium theme-text">
                        Titolo
                      </label>
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full p-3 rounded-lg theme-bg-secondary theme-text theme-border-base border"
                        placeholder="Aggiungi un titolo..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium theme-text">
                        Didascalia
                      </label>
                      <textarea
                        value={editedCaption}
                        onChange={(e) => setEditedCaption(e.target.value)}
                        className="w-full p-3 rounded-lg theme-bg-secondary theme-text theme-border-base border resize-none"
                        rows={4}
                        placeholder="Scrivi una didascalia..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra delle azioni fissa in basso - corretta la posizione */}
              <div className="fixed bottom-[3.7rem] left-0 right-0 p-4 theme-border-base border-t flex justify-between items-center bg-opacity-95 backdrop-blur-sm theme-bg-primary">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedCaption(content.caption || '');
                    setEditedTitle(content.title || '');
                  }}
                  className="px-4 py-2 rounded-lg hover:theme-bg-secondary theme-text transition-colors"
                >
                  Annulla
                </button>
                
                <button
                  onClick={() => {
                    handleSave();
                    onUpdate?.({ 
                      caption: editedCaption,
                      title: editedTitle 
                    });
                  }}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-2 ${
                    isSaving ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSaving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvataggio...
                    </> 
                  ) : (
                    <><Check className="w-4 h-4" />
                      Salva modifiche
                    </> 
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Contenuto normale del post
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Media Container - Altezza fissa su mobile */}
              <div className="relative bg-black md:flex-1 h-[40vh] md:h-auto flex-shrink-0">
                <img
                  src={content.mediaUrl}
                  alt={content.caption}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onLikeToggle) {
                        onLikeToggle(content.id);
                      }
                    }}
                    className="p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors group"
                  >
                    <Heart 
                      className={`w-6 h-6 transition-all group-hover:scale-110 ${
                        isLiked
                          ? 'fill-red-500 text-red-500'
                          : 'text-white'
                      }`}
                    />
                  </button>
                  <span className="text-white text-sm bg-black/50 px-2 py-1 rounded-full">
                    {likesCount}
                  </span>
                </div>

                {onNavigate && (
                  <><button
                    onClick={() => onNavigate('prev')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onNavigate('next')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  </>
                )}
              </div>

              {/* Comments Section */}
              <div className="flex flex-col w-full md:w-[400px] h-[calc(50vh-4rem)] md:h-auto theme-border-base md:border-l">
                {/* Caption */}
                <div className="p-4 theme-border-base border-b flex-shrink-0">
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editedCaption}
                        onChange={(e) => setEditedCaption(e.target.value)}
                        className="w-full p-2 rounded theme-bg-secondary theme-text theme-border-base border"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1 rounded text-sm hover:theme-bg-secondary theme-text"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={() => {
                            onUpdate?.({ caption: editedCaption });
                            setIsEditing(false);
                          }}
                          className="px-3 py-1 rounded text-sm theme-bg-accent theme-text-accent"
                        >
                          Salva
                        </button>
                      </div>
                    </div>
                  ) : (
                    <><div className="flex justify-between items-start">
                      <p className="theme-text flex-1">
                        {content.caption}
                      </p>
                      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                        <div className="flex items-center gap-1 theme-text-secondary">
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">
                            {viewCount.toLocaleString()} visualizzazioni
                          </span>
                        </div>
                        <button
                          onClick={handleShare}
                          className="p-1 rounded-full hover:theme-bg-secondary transition-colors"
                        >
                          <Share2 className="w-4 h-4 theme-text-secondary" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm theme-text-secondary mt-2">
                      {format(content.createdAt, 'd MMMM yyyy, HH:mm', { locale: it })}
                    </p>
                    </>
                  )}
                </div>

                {/* Comments list - Area scrollabile */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {commentError && (
                    <div className="p-2 mb-4 text-sm text-red-500 bg-red-100 rounded">
                      {commentError}
                    </div>
                  )}
                  
                  {localComments?.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      {/* Commento principale */}
                      <div className="flex items-start gap-3">
                        <img
                          src={comment.userPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName || 'User')}`}
                          alt={comment.userName || 'User'}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                          <div className="theme-bg-secondary rounded-lg p-3">
                            <p className="font-medium theme-text">{comment.userName || 'Utente'}</p>
                            <p className="theme-text">{comment.text}</p>
                          </div>
                          <div className="flex items-center gap-4 mt-1 ml-1">
                            <button
                              onClick={() => handleCommentLike(comment.id)}
                              className="text-sm theme-text-secondary hover:theme-text flex items-center gap-1"
                            >
                              <Heart className={`w-4 h-4 ${
                                comment.likes?.some(like => like.userId === currentUser?.uid)
                                  ? 'fill-red-500 text-red-500'
                                  : ''
                              }`} />
                              <span>{comment.likes?.length || 0}</span>
                            </button>
                            <button
                              onClick={() => setReplyingTo(comment.id)}
                              className="text-sm theme-text-secondary hover:theme-text flex items-center gap-1"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>{comment.replies?.length || 0}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Box risposta */}
                      {replyingTo === comment.id && (
                        <div className="ml-11 mt-2 flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Scrivi una risposta..."
                            className="flex-1 p-2 rounded-lg theme-bg-secondary theme-text text-sm"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && replyText.trim()) {
                                handleReplySubmit(comment.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleReplySubmit(comment.id)}
                            disabled={!replyText.trim()}
                            className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Risposte ai commenti */}
                      {comment.replies?.map((reply) => (
                        <div key={reply.id} className="ml-11 flex items-start gap-3">
                          <img
                            src={reply.userPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.userName || 'User')}`}
                            alt={reply.userName || 'User'}
                            className="w-6 h-6 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="theme-bg-secondary rounded-lg p-2">
                              <p className="font-medium text-sm theme-text">{reply.userName || 'Utente'}</p>
                              <p className="text-sm theme-text">{reply.text}</p>
                            </div>
                            <button
                              onClick={() => handleCommentLike(reply.id, true, comment.id)}
                              className="text-xs theme-text-secondary hover:theme-text flex items-center gap-1 mt-1 ml-1"
                            >
                              <Heart className={`w-3 h-3 ${
                                reply.likes?.some(like => like.userId === currentUser?.uid)
                                  ? 'fill-red-500 text-red-500'
                                  : ''
                              }`} />
                              <span>{reply.likes?.length || 0}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Input commento - Fissato in basso */}
                <div className="p-4 theme-border-base border-t flex gap-2 flex-shrink-0">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Aggiungi un commento..."
                    className="flex-1 p-2 rounded theme-bg-secondary theme-text theme-border-base border"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newComment.trim()) {
                        handleAddComment(newComment.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => handleAddComment(newComment.trim())}
                    disabled={!newComment.trim()}
                    className="p-2 theme-text-accent hover:theme-bg-secondary rounded-full transition-colors disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-6">
        <button
          onClick={() => onLikeToggle?.(content.id)}
          className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-200"
        >
          {isLiked ? (
            <Heart className="w-6 h-6 fill-red-500 text-red-500" />
          ) : (
            <Heart className="w-6 h-6" />
          )}
          <span>{likesCount}</span>
        </button>
        <button
          onClick={() => setShowComments(true)}
          className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-200"
        >
          <MessageCircle className="w-6 h-6" />
          <span>{localComments.length}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-200"
        >
          <Share2 className="w-6 h-6" />
          <span>{shareCount}</span>
        </button>
        <div className="flex items-center space-x-2">
          <Eye className="w-4 h-4 theme-text-secondary" />
          <span className="text-sm theme-text-secondary">{viewCount}</span>
        </div>
      </div>
    </Dialog>
  );
}