import { Plus, Heart, MessageCircle, X, Trash2, Share2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ContentCreationDialog } from '../ui/ContentCreationDialog';
import { ContentDetailDialog } from '../ui/ContentDetailDialog';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, deleteDoc, doc, getDocs, query, where, orderBy, serverTimestamp, getDoc, updateDoc, arrayUnion, Timestamp, arrayRemove, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { Comment } from '../../types';

interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: any;
  userName: string;
  userPhotoURL?: string | null;
}

interface Like {
  userId: string;
  createdAt: any;
}

interface PostStats {
  views: number;
  lastViewedAt?: { [key: string]: Timestamp };
}

interface Post {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  likes: Like[] | number;
  comments: Comment[];
  createdAt: any;
  stats?: PostStats;
}

interface PostGridProps {
  isOwnProfile: boolean;
  userId: string;
  onError?: (error: any) => void;
}

export function PostGrid({ isOwnProfile, userId, onError }: PostGridProps) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPost, setNewPost] = useState<{ image: File | null; caption: string; }>({
    image: null,
    caption: ''
  });
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');
  const [quickCommentPost, setQuickCommentPost] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      console.log('🔍 Inizio fetchPosts con parametri:', {
        isOwnProfile,
        userId,
        currentUserId: currentUser?.uid
      });

      if (!userId) {
        console.error('❌ userId mancante nel PostGrid');
        setError('ID utente non valido');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          console.error('❌ Utente non trovato:', userId);
          setError('Utente non trovato');
          setLoading(false);
          return;
        }

        console.log('✅ Utente trovato:', userId);

        const postsRef = collection(db, 'posts');
        const q = query(
          postsRef,
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        
        const fetchedPosts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date()
          };
        });

        console.log('✅ Post caricati con successo:', fetchedPosts.length);
        setPosts(fetchedPosts);
      } catch (err) {
        console.error('❌ Errore nel caricamento dei post:', err);
        setError('Errore nel caricamento dei post');
        onError?.(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [userId, isOwnProfile, currentUser?.uid, onError]);

  // Log dello stato del componente
  useEffect(() => {
    console.log('🔄 Stato PostGrid aggiornato:', {
      loading,
      error,
      postsCount: posts.length,
      userId,
      isOwnProfile
    });
  }, [loading, error, posts, userId, isOwnProfile]);

  const handleCreatePost = async () => {
    if (!newPost.image || !currentUser) return;

    try {
      console.log('📤 Inizio caricamento nuovo post');
      const timestamp = Date.now();
      const fileId = crypto.randomUUID();
      const storageRef = ref(storage, `users/${currentUser.uid}/posts/${fileId}_${timestamp}`);
      
      await uploadBytes(storageRef, newPost.image);
      const imageUrl = await getDownloadURL(storageRef);
      
      const postData = {
        userId: currentUser.uid,
        imageUrl,
        caption: newPost.caption,
        likes: [],
        comments: [],
        createdAt: serverTimestamp()
      };

      const postRef = collection(db, 'posts');
      const newPostDoc = await addDoc(postRef, postData);
      
      const post: Post = {
        id: newPostDoc.id,
        ...postData,
        createdAt: new Date()
      };

      console.log('✅ Post creato:', post);
      setPosts(prevPosts => [post, ...prevPosts]);
      setIsCreating(false);
      setNewPost({ image: null, caption: '' });
    } catch (err) {
      console.error('❌ Errore creazione post:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo post?')) return;
    
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts(posts.filter(post => post.id !== postId));
      setSelectedPost(null);
    } catch (error) {
      console.error('Errore durante l\'eliminazione del post:', error);
    }
  };

  const handleUpdatePost = async (postId: string, data: { caption?: string }) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, ...data }
        : post
    ));
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedPost) return;
    
    const currentIndex = posts.findIndex(post => post.id === selectedPost.id);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : posts.length - 1;
    } else {
      newIndex = currentIndex < posts.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedPost(posts[newIndex]);
  };

  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim() || !currentUser) return;

    try {
      const newComment = {
        id: crypto.randomUUID(),
        userId: currentUser.uid,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        userName: currentUser.displayName || 'Utente',
        userPhotoURL: currentUser.photoURL
      };

      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });

      // Aggiorna stato locale
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...(post.comments || []), newComment]
          };
        }
        return post;
      }));

    } catch (error) {
      console.error('❌ Errore nell\'aggiunta del commento:', error);
      onError?.(error);
    }
  };

  const isPostLiked = (post: Post) => {
    if (!currentUser || !post.likes) return false;
    if (Array.isArray(post.likes)) {
      return post.likes.some(like => like.userId === currentUser.uid);
    }
    return false;
  };

  const getLikesCount = (post: Post) => {
    if (!post.likes) return 0;
    if (Array.isArray(post.likes)) {
      return post.likes.length;
    }
    return post.likes;
  };

  const handleLikeToggle = async (postId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const likeData = {
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const currentLikes = Array.isArray(post.likes) ? post.likes : [];
      const hasLiked = currentLikes.some(like => like.userId === currentUser.uid);

      if (hasLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(...currentLikes.filter(like => like.userId === currentUser.uid))
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(likeData)
        });
      }

      // Aggiorna stato locale sia per la griglia che per il dialog
      setPosts(posts.map(p => {
        if (p.id === postId) {
          const updatedLikes = hasLiked
            ? currentLikes.filter(like => like.userId !== currentUser.uid)
            : [...currentLikes, likeData];
          return { ...p, likes: updatedLikes };
        }
        return p;
      }));

      // Aggiorna anche il post selezionato se è quello corrente
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => {
          if (!prev) return null;
          const updatedLikes = hasLiked
            ? currentLikes.filter(like => like.userId !== currentUser.uid)
            : [...currentLikes, likeData];
          return { ...prev, likes: updatedLikes };
        });
      }

    } catch (error) {
      console.error('❌ Errore nel toggle del like:', error);
      onError?.(error);
    }
  };

  const handleQuickComment = async (postId: string) => {
    if (!quickComment.trim() || !currentUser) return;

    await handleAddComment(postId, quickComment);
    setQuickComment('');
    setQuickCommentPost(null);
  };

  const handleViewCount = async (postId: string) => {
    if (!currentUser) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      const postData = postDoc.data();
      const now = new Date();
      const lastViewed = postData?.stats?.lastViewedAt?.[currentUser.uid];
      
      if (!lastViewed || now.getTime() - lastViewed.toDate().getTime() > 24 * 60 * 60 * 1000) {
        await updateDoc(postRef, {
          'stats.views': increment(1),
          [`stats.lastViewedAt.${currentUser.uid}`]: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento delle visualizzazioni:', error);
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await navigator.share({
        title: `Post di ${currentUser?.displayName}`,
        text: post.caption,
        url: window.location.href
      });
    } catch (error) {
      console.error('Errore nella condivisione:', error);
    }
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    handleViewCount(post.id);
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {isOwnProfile && (
          <button
            onClick={() => setIsCreating(true)}
            className="aspect-square theme-bg-secondary hover:opacity-80 transition-opacity flex items-center justify-center"
          >
            <Plus className="w-8 h-8 theme-text" />
          </button>
        )}

        {loading ? (
          <div className="col-span-3 flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 theme-border"></div>
          </div>
        ) : error ? (
          <div className="col-span-3 text-center p-4 theme-text-error">{error}</div>
        ) : posts.length === 0 ? (
          <div className="col-span-3 text-center p-4 theme-text-secondary">
            {isOwnProfile 
              ? 'Non hai ancora pubblicato nessun post' 
              : 'Questo utente non ha ancora pubblicato nessun post'}
          </div>
        ) : (
          posts.map((post) => (
            <div 
              key={post.id} 
              className="aspect-square group relative cursor-pointer"
              onClick={() => handlePostClick(post)}
            >
              <img
                src={post.imageUrl}
                alt={post.caption}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.jpg';
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200">
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-6 text-white">
                    <button 
                      onClick={(e) => handleLikeToggle(post.id, e)}
                      className="flex items-center gap-2 hover:scale-110 transition-transform"
                    >
                      <Heart 
                        className={`w-5 h-5 ${
                          isPostLiked(post)
                            ? 'fill-red-500 text-red-500'
                            : ''
                        }`}
                      />
                      <span>{getLikesCount(post)}</span>
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickCommentPost(post.id);
                      }}
                      className="flex items-center gap-2 hover:scale-110 transition-transform"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{post.comments?.length || 0}</span>
                    </button>
                  </div>
                </div>
              </div>

              {isOwnProfile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Sei sicuro di voler eliminare questo post?')) {
                      handleDeletePost(post.id);
                    }
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Elimina post"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Dialog di creazione */}
      <ContentCreationDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        title="Crea nuovo post"
        onSubmit={handleCreatePost}
        submitLabel="Pubblica"
        isSubmitDisabled={!newPost.image}
      >
        <div className="flex flex-col gap-4 h-full">
          <div className="image-upload-container">
            {newPost.image ? (
              <img
                src={URL.createObjectURL(newPost.image)}
                alt="Preview"
                className="w-full h-full object-contain bg-black/5"
              />
            ) : (
              <label className="upload-placeholder cursor-pointer w-full h-full">
                <Plus className="w-8 h-8 mb-2 theme-text" />
                <span className="theme-text text-center px-4">
                  Carica un'immagine<br/>
                  <span className="text-sm opacity-70">
                    (Formato consigliato: quadrato)
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewPost(prev => ({ ...prev, image: file }));
                    }
                  }}
                />
              </label>
            )}
          </div>
          <textarea
            placeholder="Scrivi una didascalia..."
            value={newPost.caption}
            onChange={(e) => setNewPost(prev => ({ ...prev, caption: e.target.value }))}
            className="caption-input flex-shrink-0"
            rows={3}
          />
        </div>
      </ContentCreationDialog>

      {/* Dialog del post selezionato */}
      {selectedPost && (
        <ContentDetailDialog
          open={!!selectedPost}
          onOpenChange={(open) => !open && setSelectedPost(null)}
          type="post"
          content={{
            id: selectedPost.id,
            userId: selectedPost.userId,
            mediaUrl: selectedPost.imageUrl,
            caption: selectedPost.caption,
            comments: selectedPost.comments.map(comment => ({
              id: comment.id,
              text: comment.text,
              userId: comment.userId,
              createdAt: comment.createdAt,
              user: {
                displayName: comment.userName,
                photoURL: comment.userPhotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName)}`
              }
            })) || [],
            createdAt: selectedPost.createdAt instanceof Date 
              ? selectedPost.createdAt 
              : new Date(selectedPost.createdAt),
            likes: selectedPost.likes
          }}
          currentUser={currentUser}
          onDelete={isOwnProfile ? () => handleDeletePost(selectedPost.id) : undefined}
          onUpdate={isOwnProfile ? (data) => handleUpdatePost(selectedPost.id, data) : undefined}
          onNavigate={handleNavigate}
          onAddComment={(text) => handleAddComment(selectedPost.id, text)}
          onLikeToggle={(postId) => handleLikeToggle(postId)}
          isLiked={isPostLiked(selectedPost)}
          likesCount={getLikesCount(selectedPost)}
        />
      )}

      {/* Dialog per commento rapido */}
      {quickCommentPost && (
        <div 
          className="creation-dialog"
          onClick={() => setQuickCommentPost(null)}
        >
          <div 
            className="creation-dialog-content max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="creation-dialog-header">
              <h3 className="text-lg font-semibold theme-text">Aggiungi un commento</h3>
              <button
                onClick={() => setQuickCommentPost(null)}
                className="p-2 hover:theme-bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5 theme-text" />
              </button>
            </div>

            <div className="creation-dialog-body p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={quickComment}
                  onChange={(e) => setQuickComment(e.target.value)}
                  placeholder="Scrivi un commento..."
                  className="flex-1 p-3 rounded-lg theme-bg-secondary theme-text"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && quickComment.trim()) {
                      handleQuickComment(quickCommentPost);
                    }
                  }}
                />
              </div>
            </div>

            <div className="creation-dialog-footer">
              <button
                onClick={() => setQuickCommentPost(null)}
                className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-80 transition-opacity"
              >
                Annulla
              </button>
              <button
                onClick={() => handleQuickComment(quickCommentPost)}
                disabled={!quickComment.trim()}
                className="px-4 py-2 rounded-lg theme-bg-accent theme-text-accent disabled:opacity-50 transition-opacity"
              >
                Commenta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 