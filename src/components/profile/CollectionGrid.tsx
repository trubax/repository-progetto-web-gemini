import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Image, Video, X, Heart, Trash2, Loader2, ImageOff, Pencil } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, updateDoc, arrayRemove, arrayUnion, getDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { useParams, useLocation } from 'react-router-dom';
import { CollectionDetailDialog } from './CollectionDetailDialog';
import { getVideoThumbnail } from '../../utils/videoUtils';

interface Media {
  id: string;
  type: 'post' | 'video';
  url: string;
  thumbnail?: string;
  title?: string;
  createdAt: any;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  items: string[];
  createdAt: any;
  userId: string;
  likes?: string[];
}

export function CollectionGrid() {
  const { currentUser } = useAuth();
  const { userId } = useParams();
  const location = useLocation();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [availableMedia, setAvailableMedia] = useState<Media[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos'>('posts');
  const [collectionThumbnails, setCollectionThumbnails] = useState<Record<string, any[]>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Calcola i valori derivati una sola volta
  const profileInfo = useMemo(() => {
    const isCurrentProfile = !userId;
    const isOwnProfile = isCurrentProfile || userId === currentUser?.uid;
    const targetUserId = userId || currentUser?.uid;
    
    return { isCurrentProfile, isOwnProfile, targetUserId };
  }, [userId, currentUser?.uid]);

  // Ottimizza il caricamento delle raccolte
  useEffect(() => {
    const loadCollections = async () => {
      if (!profileInfo.targetUserId) {
        setLoading(false);
        return;
      }

      try {
        const collectionsQuery = query(
          collection(db, 'collections'),
          where('userId', '==', profileInfo.targetUserId),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(collectionsQuery);
        const collectionsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Collection[];

        setCollections(collectionsData);
      } catch (error) {
        console.error('Errore nel caricamento delle raccolte:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCollections();
  }, [profileInfo.targetUserId]);

  // Ottimizza la creazione della raccolta
  const handleCreateCollection = useCallback(async () => {
    if (!currentUser || !newCollectionName.trim() || selectedItems.length === 0) return;

    try {
      const collectionRef = doc(collection(db, 'collections'));
      
      const newCollection = {
        id: collectionRef.id,
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim(),
        items: selectedItems,
        createdAt: new Date(),
        userId: currentUser.uid,
        type: 'collection'
      };

      await setDoc(collectionRef, newCollection);

      setCollections(prev => [...prev, newCollection]);
      setShowCreateDialog(false);
      setNewCollectionName('');
      setNewCollectionDesc('');
      setSelectedItems([]);

      console.log('Raccolta creata con successo:', newCollection);
    } catch (error) {
      console.error('Errore nella creazione della raccolta:', error);
    }
  }, [currentUser, newCollectionName, newCollectionDesc, selectedItems]);

  // Rimuovi i console.log di debug in produzione
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Debug info:', {
        isCurrentProfile: profileInfo.isCurrentProfile,
        isOwnProfile: profileInfo.isOwnProfile,
        currentUserId: currentUser?.uid,
        urlUserId: userId,
        targetUserId: profileInfo.targetUserId,
        pathname: location.pathname
      });
    }
  }, [profileInfo, currentUser?.uid, userId, location.pathname]);

  // Aggiungi una funzione per verificare se un media è valido
  const isValidMedia = (media: Media) => {
    if (media.type === 'video') {
      return media.thumbnail || media.url;
    }
    return media.url;
  };

  // Modifica il caricamento dei media
  useEffect(() => {
    const loadUserMedia = async () => {
      if (!currentUser) return;

      try {
        // Carica i post
        const postsQuery = query(
          collection(db, 'posts'),
          where('userId', '==', currentUser.uid)
        );
        const postsSnap = await getDocs(postsQuery);
        const posts = postsSnap.docs.map(doc => ({
          id: doc.id,
          type: 'post' as const,
          url: doc.data().imageUrl,
          createdAt: doc.data().createdAt,
        }));

        // Carica i video
        const videosQuery = query(
          collection(db, 'videos'),
          where('userId', '==', currentUser.uid)
        );
        const videosSnap = await getDocs(videosQuery);
        const videos = videosSnap.docs.map(doc => ({
          id: doc.id,
          type: 'video' as const,
          url: doc.data().url,
          thumbnail: doc.data().thumbnailUrl,
          title: doc.data().title,
          createdAt: doc.data().createdAt,
        }));

        // Ordina i media per data di creazione
        const allMedia = [...posts, ...videos].sort((a, b) => 
          b.createdAt?.toDate?.().getTime() - a.createdAt?.toDate?.().getTime()
        );

        setAvailableMedia(allMedia);
      } catch (error) {
        console.error('Errore nel caricamento dei media:', error);
      }
    };

    loadUserMedia();
  }, [currentUser]);

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleDeleteCollection = async (collectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Sei sicuro di voler eliminare questa raccolta?')) return;

    try {
      await deleteDoc(doc(db, 'collections', collectionId));
      setCollections(prev => prev.filter(c => c.id !== collectionId));
    } catch (error) {
      console.error('Errore nella rimozione della raccolta:', error);
    }
  };

  const handleLikeCollection = async (collectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    try {
      const collectionRef = doc(db, 'collections', collectionId);
      const collectionDoc = await getDoc(collectionRef);
      
      if (!collectionDoc.exists()) return;

      const likes = collectionDoc.data().likes || [];
      const isLiked = likes.includes(currentUser.uid);

      await updateDoc(collectionRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
      });

      setCollections(prev => prev.map(c => {
        if (c.id === collectionId) {
          const currentLikes = c.likes || [];
          return {
            ...c,
            likes: isLiked 
              ? currentLikes.filter(id => id !== currentUser.uid)
              : [...currentLikes, currentUser.uid]
          };
        }
        return c;
      }));
    } catch (error) {
      console.error('Errore nel gestire il like:', error);
    }
  };

  const loadThumbnails = useCallback(async (collectionId: string, itemIds: string[]) => {
    if (!itemIds.length) return;
    
    setLoadingStates(prev => ({ ...prev, [collectionId]: true }));
    
    try {
      console.log('Inizio caricamento anteprime per collezione:', collectionId, itemIds);

      // Carica i media per questa collezione
      const mediaItems = await Promise.all(
        itemIds.map(async (itemId) => {
          try {
            // Verifica prima se è un video
            const videoRef = doc(db, 'videos', itemId);
            const videoSnap = await getDoc(videoRef);
            
            if (videoSnap.exists()) {
              const videoData = videoSnap.data();
              return {
                id: itemId,
                type: 'video',
                url: videoData.url,
                thumbnailUrl: videoData.thumbnailUrl || videoData.url
              };
            }
            
            // Se non è un video, prova con i post
            const postRef = doc(db, 'posts', itemId);
            const postSnap = await getDoc(postRef);
            
            if (postSnap.exists()) {
              const postData = postSnap.data();
              return {
                id: itemId,
                type: 'post',
                url: postData.imageUrl,
                thumbnailUrl: postData.imageUrl
              };
            }
            
            console.log('Media non trovato:', itemId);
            await removeFromCollection(collectionId, itemId);
            return null;
          } catch (error) {
            console.error('Errore nel caricamento del media:', itemId, error);
            return null;
          }
        })
      );

      console.log('Media items caricati:', mediaItems);

      // Filtra i media validi e crea le anteprime
      const validThumbnails = mediaItems
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map(item => ({
          id: item.id,
          type: item.type,
          url: item.thumbnailUrl
        }));

      console.log('Anteprime valide:', validThumbnails);

      // Aggiorna lo stato delle anteprime
      if (validThumbnails.length > 0) {
        setCollectionThumbnails(prev => {
          const newState = {
            ...prev,
            [collectionId]: validThumbnails
          };
          console.log('Nuovo stato anteprime:', newState);
          return newState;
        });
      }

    } catch (error) {
      console.error('Errore nel caricamento delle anteprime:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [collectionId]: false }));
    }
  }, []);

  const removeFromCollection = async (collectionId: string, itemId: string) => {
    try {
      const collectionRef = doc(db, 'collections', collectionId);
      await updateDoc(collectionRef, {
        items: arrayRemove(itemId)
      });
      console.log(`Elemento ${itemId} rimosso dalla collezione ${collectionId}`);
    } catch (error) {
      console.error('Errore nella rimozione dell\'elemento dalla collezione:', error);
    }
  };

  useEffect(() => {
    const checkMediaExistence = async () => {
      for (const collection of collections) {
        if (collection.items.length > 0) {
          await loadThumbnails(collection.id, collection.items);
        }
      }
    };

    checkMediaExistence();
  }, [collections, loadThumbnails]);

  // Aggiungi questo effect per ricaricare le anteprime quando una collezione viene aggiornata
  useEffect(() => {
    collections.forEach(collection => {
      // Verifica se abbiamo già le anteprime per questa collezione
      const existingThumbnails = collectionThumbnails[collection.id] || [];
      const needsUpdate = collection.items.some(itemId => 
        !existingThumbnails.find(thumb => thumb.id === itemId)
      );
      
      if (needsUpdate) {
        console.log('Ricaricamento anteprime necessario per collezione:', collection.id);
        loadThumbnails(collection.id, collection.items);
      }
    });
  }, [collections, loadThumbnails, collectionThumbnails]);

  // Nel renderCollectionThumbnails, assicurati di gestire correttamente le anteprime dei video
  const renderCollectionThumbnails = useCallback((collection: Collection) => {
    const thumbnails = collectionThumbnails[collection.id] || [];
    const isLoading = loadingStates[collection.id];
    const totalItems = collection.items.length;

    return (
      <div className="grid grid-cols-2 gap-0.5 w-full h-full relative group">
        {/* Mostra solo i primi 4 slot */}
        {[0, 1, 2, 3].map((index) => {
          const thumbnail = thumbnails[index];
          const hasMoreItems = index === 3 && totalItems > 4;

          return (
            <div 
              key={thumbnail?.id || `empty-${index}`} 
              className="relative aspect-square bg-black/90 dark:bg-black"
            >
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                </div>
              ) : thumbnail ? (
                <div className="relative w-full h-full">
                  <img
                    src={thumbnail.url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Errore caricamento immagine:', thumbnail.url);
                      e.currentTarget.src = thumbnail.type === 'video' ? 
                        '/placeholder-video.png' : '/placeholder-image.png';
                    }}
                  />
                  {thumbnail.type === 'video' && (
                    <div className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                      <Video className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {hasMoreItems && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white font-medium">+{totalItems - 3}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Overlay e pulsante modifica */}
        {profileInfo.isOwnProfile && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCollection(collection);
              }}
              className="absolute inset-0 m-auto w-12 h-12 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all duration-200 transform hover:scale-110 hover:rotate-90 z-10"
            >
              <Plus className="w-6 h-6" />
            </button>
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </>
        )}
      </div>
    );
  }, [collectionThumbnails, loadingStates, profileInfo.isOwnProfile]);

  // Carica le anteprime quando le collezioni cambiano
  useEffect(() => {
    console.log('Collections changed:', collections);
    collections.forEach(collection => {
      if (collection.items.length > 0) {
        loadThumbnails(collection.id, collection.items);
      }
    });
  }, [collections, loadThumbnails]);

  // Aggiungi questa funzione per sincronizzare le eliminazioni
  const syncDeletedMedia = useCallback(async (collectionId: string, mediaId: string) => {
    try {
      // Verifica se il media esiste ancora
      const videoRef = doc(db, 'videos', mediaId);
      const postRef = doc(db, 'posts', mediaId);
      
      const [videoSnap, postSnap] = await Promise.all([
        getDoc(videoRef),
        getDoc(postRef)
      ]);

      // Se il media non esiste più, rimuovilo dalla collezione
      if (!videoSnap.exists() && !postSnap.exists()) {
        console.log('Media non trovato, rimozione dalla collezione:', mediaId);
        
        const collectionRef = doc(db, 'collections', collectionId);
        await updateDoc(collectionRef, {
          items: arrayRemove(mediaId)
        });

        // Aggiorna lo stato locale
        setCollections(prevCollections => 
          prevCollections.map(collection => 
            collection.id === collectionId
              ? {
                  ...collection,
                  items: collection.items.filter(id => id !== mediaId)
                }
              : collection
          )
        );

        // Aggiorna le anteprime
        setCollectionThumbnails(prev => {
          const updatedThumbnails = { ...prev };
          if (updatedThumbnails[collectionId]) {
            updatedThumbnails[collectionId] = updatedThumbnails[collectionId]
              .filter(thumb => thumb.id !== mediaId);
          }
          return updatedThumbnails;
        });
      }
    } catch (error) {
      console.error('Errore nella sincronizzazione del media eliminato:', error);
    }
  }, []);

  // Aggiungi questo effect per controllare periodicamente i media eliminati
  useEffect(() => {
    collections.forEach(collection => {
      collection.items.forEach(mediaId => {
        syncDeletedMedia(collection.id, mediaId);
      });
    });
  }, [collections, syncDeletedMedia]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Pulsante crea raccolta - visibile nel profilo corrente o proprio */}
      {profileInfo.isOwnProfile && (
        <div className="mb-6">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 theme-bg-accent theme-text-accent rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Crea nuova raccolta</span>
          </button>
        </div>
      )}

      {/* Messaggio se non ci sono raccolte */}
      {!loading && collections.length === 0 && (
        <div className="text-center py-8 theme-text-secondary">
          {profileInfo.isOwnProfile ? (
            <p>Non hai ancora creato nessuna raccolta</p>
          ) : (
            <p>Questo utente non ha ancora creato raccolte</p>
          )}
        </div>
      )}

      {/* Dialog creazione raccolta */}
      {profileInfo.isOwnProfile && showCreateDialog && (
        <Dialog open onOpenChange={setShowCreateDialog}>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="theme-bg-primary rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col relative">
              {/* Header */}
              <div className="p-4 border-b theme-border flex justify-between items-center shrink-0">
                <h2 className="text-lg font-semibold theme-text">
                  Crea nuova raccolta
                </h2>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="p-1 rounded-full hover:theme-bg-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="p-4 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium theme-text mb-1">
                    Nome raccolta
                  </label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text"
                    placeholder="Nome della raccolta"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium theme-text mb-1">
                    Descrizione
                  </label>
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text"
                    placeholder="Descrizione della raccolta"
                    rows={3}
                  />
                </div>

                {/* Tab switcher */}
                <div className="flex border-b theme-border sticky top-0 bg-inherit pt-2">
                  <button
                    onClick={() => setActiveTab('posts')}
                    className={`flex-1 py-2 text-center ${
                      activeTab === 'posts' ? 'theme-text border-b-2 border-accent' : 'theme-text-secondary'
                    }`}
                  >
                    <Image className="w-5 h-5 mx-auto mb-1" />
                    Post
                  </button>
                  <button
                    onClick={() => setActiveTab('videos')}
                    className={`flex-1 py-2 text-center ${
                      activeTab === 'videos' ? 'theme-text border-b-2 border-accent' : 'theme-text-secondary'
                    }`}
                  >
                    <Video className="w-5 h-5 mx-auto mb-1" />
                    Video
                  </button>
                </div>

                {/* Griglia media */}
                <div className="grid grid-cols-3 gap-4 overflow-y-auto max-h-[400px] p-2">
                  {availableMedia
                    .filter(media => {
                      const isCorrectType = activeTab === 'posts' ? media.type === 'post' : media.type === 'video';
                      return isCorrectType && isValidMedia(media);
                    })
                    .map(media => (
                      <div
                        key={media.id}
                        onClick={() => toggleItemSelection(media.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ${
                          selectedItems.includes(media.id) ? 'ring-2 ring-accent' : ''
                        }`}
                      >
                        <div className="absolute inset-0 bg-black/10" />
                        {media.type === 'video' ? (
                          <>
                            <img
                              src={media.thumbnail || '/placeholder-video.png'} // Aggiungi un'immagine placeholder
                              alt={media.title || 'Video thumbnail'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-video.png'; // Fallback se l'immagine non carica
                              }}
                            />
                            <Video className="absolute top-2 right-2 w-6 h-6 text-white" />
                          </>
                        ) : (
                          <img
                            src={media.url}
                            alt="Post"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder-image.png'; // Fallback per le immagini
                            }}
                          />
                        )}
                        {selectedItems.includes(media.id) && (
                          <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center">
                              ✓
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t theme-border flex justify-between items-center shrink-0 sticky bottom-0 bg-inherit z-10 shadow-lg">
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="px-6 py-2.5 rounded-lg theme-bg-secondary hover:opacity-90 font-medium min-w-[120px]"
                >
                  Annulla
                </button>
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim() || selectedItems.length === 0}
                  className="px-6 py-2.5 rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50 font-medium min-w-[120px] disabled:cursor-not-allowed"
                >
                  Crea raccolta
                </button>
              </div>

              {/* Aggiunto padding di sicurezza per il contenuto sotto il footer */}
              <div className="h-2 shrink-0" />
            </div>
          </div>
        </Dialog>
      )}

      {/* Grid delle raccolte esistenti */}
      <div className="grid grid-cols-3 gap-4">
        {collections.map(collection => (
          <div
            key={collection.id}
            onClick={() => setSelectedCollection(collection)}
            className="aspect-square relative rounded-lg overflow-hidden cursor-pointer group"
          >
            {renderCollectionThumbnails(collection)}

            {/* Overlay con informazioni */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-white truncate pr-2">
                  {collection.name}
                </h3>
                {profileInfo.isOwnProfile && (
                  <button
                    onClick={(e) => handleDeleteCollection(collection.id, e)}
                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-white/80">
                  {collection.items.length} elementi
                </span>
                <button
                  onClick={(e) => handleLikeCollection(collection.id, e)}
                  className={`p-1.5 rounded-full hover:bg-white/20 transition-colors flex items-center gap-1 ${
                    collection.likes?.includes(currentUser?.uid || '') 
                      ? 'text-red-500' 
                      : 'text-white'
                  }`}
                >
                  <Heart 
                    className={`w-4 h-4 ${
                      collection.likes?.includes(currentUser?.uid || '') 
                        ? 'fill-current' 
                        : ''
                    }`} 
                  />
                  <span className="text-xs text-white">
                    {collection.likes?.length || 0}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Collection Detail Dialog */}
      {selectedCollection && (
        <CollectionDetailDialog
          collection={selectedCollection}
          onClose={() => setSelectedCollection(null)}
          isOwnCollection={profileInfo.isOwnProfile}
        />
      )}
    </div>
  );
} 