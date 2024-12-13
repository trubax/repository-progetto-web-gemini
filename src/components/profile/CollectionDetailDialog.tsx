import { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { db, storage } from '../../firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { Loader2, X, Heart, Share2, Video, Play, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { getVideoThumbnail } from '../../utils/videoUtils';
import { CollectionEditDialog } from './CollectionEditDialog';

interface CollectionDetailDialogProps {
  collection: {
    id: string;
    name: string;
    description?: string;
    items: string[];
    userId: string;
    likes?: string[];
  };
  onClose: () => void;
  isOwnCollection: boolean;
}

interface MediaItem {
  id: string;
  type: 'post' | 'video';
  url: string;
  thumbnailUrl?: string;
  title?: string;
  downloadUrl?: string;
}

export function CollectionDetailDialog({ collection, onClose, isOwnCollection }: CollectionDetailDialogProps) {
  const [state, setState] = useState<{
    mediaItems: MediaItem[];
    currentIndex: number;
    loading: boolean;
    autoplay: boolean;
  }>({
    mediaItems: [],
    currentIndex: 0,
    loading: true,
    autoplay: false
  });

  const [showEditMode, setShowEditMode] = useState(false);

  const [collectionData, setCollectionData] = useState(collection);

  useEffect(() => {
    const loadMediaItems = async () => {
      setState(prev => ({ ...prev, loading: true }));
      try {
        const items = await Promise.all(
          collection.items.map(async (itemId) => {
            try {
              // Prima controlla se è un video
              let docRef = doc(db, 'videos', itemId);
              let docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const data = docSnap.data();
                let thumbnailUrl = '/placeholder-video.png';
                let downloadUrl = '';

                // Ottieni l'URL di download per il video
                if (data.url) {
                  try {
                    const videoRef = ref(storage, data.url);
                    downloadUrl = await getDownloadURL(videoRef);
                  } catch (error) {
                    console.error('Errore nel recupero URL video:', error);
                  }
                }

                // Prova a ottenere la thumbnail dal documento
                if (data.thumbnailUrl) {
                  thumbnailUrl = data.thumbnailUrl;
                } else if (data.url) {
                  try {
                    thumbnailUrl = await getVideoThumbnail(data.url, '/placeholder-video.png');
                  } catch (error) {
                    console.log('Fallback a placeholder per video:', itemId);
                  }
                }
                
                return {
                  id: itemId,
                  type: 'video',
                  url: data.url,
                  downloadUrl,
                  thumbnailUrl,
                  title: data.title || ''
                };
              }
              
              // Se non è un video, prova con i post
              docRef = doc(db, 'posts', itemId);
              docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                  id: itemId,
                  type: 'post',
                  url: data.imageUrl,
                  thumbnailUrl: data.imageUrl,
                  title: data.caption || ''
                };
              }
              
              console.log('Media non trovato:', itemId);
              return null;
            } catch (error) {
              console.error('Errore nel caricamento del media:', itemId, error);
              // Ritorna un oggetto con placeholder invece di null
              return {
                id: itemId,
                type: 'video',
                url: '',
                thumbnailUrl: '/placeholder-video.png',
                title: 'Video non disponibile'
              };
            }
          })
        );
        
        const validItems = items.filter(item => item !== null);
        setState(prev => ({
          ...prev,
          mediaItems: validItems,
          loading: false
        }));
      } catch (error) {
        console.error('Errore nel caricamento dei media:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    loadMediaItems();
  }, [collection.items]);

  const renderContent = () => {
    if (state.loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin theme-text" />
        </div>
      );
    }

    const currentItem = state.mediaItems[state.currentIndex];

    if (!currentItem || state.mediaItems.length === 0) {
      return (
        <p className="text-center py-8 theme-text-secondary">
          Nessun elemento in questa raccolta
        </p>
      );
    }

    return (
      <Dialog open onOpenChange={onClose}>
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="theme-bg-primary rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b theme-border flex justify-between items-center shrink-0">
              <h2 className="text-lg font-semibold theme-text">
                {collectionData.name || 'Raccolta'}
              </h2>
              <div className="flex items-center gap-2">
                {isOwnCollection && (
                  <>
                    <button
                      onClick={() => setShowEditMode(true)}
                      className="p-2 rounded-full hover:theme-bg-secondary"
                      title="Modifica collezione"
                    >
                      <Edit2 className="w-5 h-5 theme-text" />
                    </button>
                    <button
                      onClick={() => handleDeleteCollection()}
                      className="p-2 rounded-full hover:theme-bg-secondary"
                      title="Elimina collezione"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:theme-bg-secondary"
                  title="Chiudi"
                >
                  <X className="w-5 h-5 theme-text" />
                </button>
              </div>
            </div>

            {/* Area contenuto principale - non scrollabile */}
            <div className="p-4 space-y-4 shrink-0">
              {/* Media viewer con controlli di navigazione */}
              <div className="relative"> {/* Aggiunto container relativo */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  {currentItem.type === 'video' && (currentItem.downloadUrl || currentItem.url) ? (
                    <div className="relative w-full h-full">
                      <iframe
                        key={`${currentItem.id}-${state.autoplay}`}
                        src={currentItem.downloadUrl || currentItem.url}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      ></iframe>
                    </div>
                  ) : (
                    <img
                      src={currentItem.url || '/placeholder-image.png'}
                      alt={currentItem.title || ''}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        console.error('Errore caricamento immagine:', currentItem.url);
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                  )}
                </div>

                {/* Pulsanti di navigazione */}
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 pointer-events-none">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (state.currentIndex > 0) {
                        const prevItem = state.mediaItems[state.currentIndex - 1];
                        setState(prev => ({
                          ...prev,
                          currentIndex: prev.currentIndex - 1,
                          autoplay: prevItem.type === 'video'
                        }));
                      }
                    }}
                    disabled={state.currentIndex === 0}
                    className={`w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white transition-all duration-200 pointer-events-auto
                      ${state.currentIndex === 0 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-black/70 hover:scale-110'}`}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (state.currentIndex < state.mediaItems.length - 1) {
                        const nextItem = state.mediaItems[state.currentIndex + 1];
                        setState(prev => ({
                          ...prev,
                          currentIndex: prev.currentIndex + 1,
                          autoplay: nextItem.type === 'video'
                        }));
                      }
                    }}
                    disabled={state.currentIndex === state.mediaItems.length - 1}
                    className={`w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white transition-all duration-200 pointer-events-auto
                      ${state.currentIndex === state.mediaItems.length - 1 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-black/70 hover:scale-110'}`}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Indicatore di posizione */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
                  {state.currentIndex + 1} / {state.mediaItems.length}
                </div>
              </div>

              {/* Titolo del media corrente */}
              {currentItem.title && (
                <h3 className="text-lg font-medium theme-text">
                  {currentItem.title}
                </h3>
              )}
            </div>

            {/* Area delle anteprime - scrollabile */}
            <div className="flex-1 min-h-0 border-t theme-border"> {/* Aggiunto min-h-0 per gestire correttamente flex-1 */}
              <div className="p-4 overflow-y-auto max-h-[200px]"> {/* Altezza fissa per l'area scrollabile */}
                <div className="grid grid-cols-6 gap-2">
                  {state.mediaItems.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={(e) => {
                        setState(prev => ({ 
                          ...prev, 
                          currentIndex: index,
                          autoplay: item.type === 'video'
                        }));
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden group ${
                        index === state.currentIndex ? 'ring-2 ring-accent' : ''
                      }`}
                    >
                      {item.type === 'video' ? (
                        <div className="relative w-full h-full">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title || 'Video thumbnail'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.log('Fallback per video:', item.id);
                              e.currentTarget.src = '/placeholder-video.png';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Video className="w-6 h-6 text-white" />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="play-button w-8 h-8 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 text-black" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.title || 'Post image'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.log('Fallback per immagine:', item.id);
                            e.currentTarget.src = '/placeholder-image.png';
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    );
  };

  const handleDeleteCollection = async () => {
    if (!window.confirm('Sei sicuro di voler eliminare questa raccolta?')) return;
    
    try {
      await deleteDoc(doc(db, 'collections', collection.id));
      onClose();
    } catch (error) {
      console.error('Errore durante l\'eliminazione della raccolta:', error);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]">
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="theme-bg-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b theme-border flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold theme-text mb-1">{collectionData.name}</h2>
                  {collectionData.description && (
                    <p className="theme-text-secondary">{collectionData.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOwnCollection && (
                    <>
                      <button
                        onClick={() => setShowEditMode(true)}
                        className="p-2 rounded-full hover:theme-bg-secondary"
                      >
                        <Edit2 className="w-5 h-5 theme-text" />
                      </button>
                      <button
                        onClick={() => handleDeleteCollection()}
                        className="p-2 rounded-full hover:theme-bg-secondary text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={onClose} 
                    className="p-2 hover:theme-bg-secondary rounded-full"
                  >
                    <X className="w-5 h-5 theme-text" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {showEditMode && (
        <CollectionEditDialog
          collection={collection}
          onClose={() => setShowEditMode(false)}
          onUpdate={(updatedCollection) => {
            setShowEditMode(false);
            setCollectionData(updatedCollection);
            // Ricarica i media items
            const loadMediaItems = async () => {
              setState(prev => ({ ...prev, loading: true }));
              try {
                const items = await Promise.all(
                  updatedCollection.items.map(async (itemId) => {
                    try {
                      // Prima controlla se è un video
                      let docRef = doc(db, 'videos', itemId);
                      let docSnap = await getDoc(docRef);
                      
                      if (docSnap.exists()) {
                        const data = docSnap.data();
                        let thumbnailUrl = '/placeholder-video.png';
                        let downloadUrl = '';

                        // Ottieni l'URL di download per il video
                        if (data.url) {
                          try {
                            const videoRef = ref(storage, data.url);
                            downloadUrl = await getDownloadURL(videoRef);
                          } catch (error) {
                            console.error('Errore nel recupero URL video:', error);
                          }
                        }

                        // Prova a ottenere la thumbnail dal documento
                        if (data.thumbnailUrl) {
                          thumbnailUrl = data.thumbnailUrl;
                        } else if (data.url) {
                          try {
                            thumbnailUrl = await getVideoThumbnail(data.url, '/placeholder-video.png');
                          } catch (error) {
                            console.log('Fallback a placeholder per video:', itemId);
                          }
                        }
                        
                        return {
                          id: itemId,
                          type: 'video',
                          url: data.url,
                          downloadUrl,
                          thumbnailUrl,
                          title: data.title || ''
                        };
                      }
                      
                      // Se non è un video, prova con i post
                      docRef = doc(db, 'posts', itemId);
                      docSnap = await getDoc(docRef);
                      
                      if (docSnap.exists()) {
                        const data = docSnap.data();
                        return {
                          id: itemId,
                          type: 'post',
                          url: data.imageUrl,
                          thumbnailUrl: data.imageUrl,
                          title: data.caption || ''
                        };
                      }
                      
                      console.log('Media non trovato:', itemId);
                      return null;
                    } catch (error) {
                      console.error('Errore nel caricamento del media:', itemId, error);
                      // Ritorna un oggetto con placeholder invece di null
                      return {
                        id: itemId,
                        type: 'video',
                        url: '',
                        thumbnailUrl: '/placeholder-video.png',
                        title: 'Video non disponibile'
                      };
                    }
                  })
                );
                
                const validItems = items.filter(item => item !== null);
                setState(prev => ({
                  ...prev,
                  mediaItems: validItems,
                  loading: false
                }));
              } catch (error) {
                console.error('Errore nel caricamento dei media:', error);
                setState(prev => ({ ...prev, loading: false }));
              }
            };
            loadMediaItems();
          }}
        />
      )}
    </>
  );
} 