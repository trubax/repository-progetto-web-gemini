import { useState, useEffect } from 'react';
import { Dialog } from '../ui/Dialog';
import { db, storage } from '../../firebase';
import { doc, getDoc, updateDoc, collection as firestoreCollection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { Loader2, X, Video, Image, Plus } from 'lucide-react';

interface CollectionEditDialogProps {
  collection: {
    id: string;
    name: string;
    description?: string;
    items: string[];
    userId: string;
  };
  onClose: () => void;
  onUpdate?: (updatedCollection: any) => void;
}

interface Media {
  id: string;
  type: 'post' | 'video';
  url: string;
  thumbnail?: string;
  title?: string;
  createdAt: any;
}

export function CollectionEditDialog({ collection, onClose, onUpdate }: CollectionEditDialogProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || '');
  const [selectedItems, setSelectedItems] = useState<string[]>(collection.items);
  const [availableMedia, setAvailableMedia] = useState<Media[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'videos'>('posts');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Carica i media disponibili
  useEffect(() => {
    const loadUserMedia = async () => {
      setLoading(true);
      try {
        // Carica i post
        const postsQuery = query(
          firestoreCollection(db, 'posts'),
          where('userId', '==', collection.userId),
          orderBy('createdAt', 'desc')
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
          firestoreCollection(db, 'videos'),
          where('userId', '==', collection.userId),
          orderBy('createdAt', 'desc')
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
      } finally {
        setLoading(false);
      }
    };

    loadUserMedia();
  }, [collection.userId]);

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || selectedItems.length === 0) return;

    setIsSaving(true);
    try {
      const collectionRef = doc(db, 'collections', collection.id);
      
      const updatedCollection = {
        ...collection,
        name: name.trim(),
        description: description.trim(),
        items: selectedItems,
        updatedAt: new Date()
      };

      await updateDoc(collectionRef, {
        name: name.trim(),
        description: description.trim(),
        items: selectedItems,
        updatedAt: new Date()
      });

      onUpdate?.(updatedCollection);

      onClose();
    } catch (error) {
      console.error('Errore durante il salvataggio delle modifiche:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[300]">
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div className="theme-bg-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b theme-border">
              <h2 className="text-xl font-semibold theme-text">Modifica Raccolta</h2>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <label className="block text-sm font-medium theme-text mb-1">
                  Nome della raccolta
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 theme-bg-secondary theme-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Nome della raccolta"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium theme-text mb-1">
                  Descrizione
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 theme-bg-secondary theme-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  placeholder="Descrizione (opzionale)"
                  rows={3}
                />
              </div>

              {/* Tabs */}
              <div className="border-b theme-border">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setActiveTab('posts')}
                    className={`py-2 px-4 border-b-2 transition-colors ${
                      activeTab === 'posts'
                        ? 'border-accent theme-text'
                        : 'border-transparent theme-text-secondary hover:theme-text'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Post
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('videos')}
                    className={`py-2 px-4 border-b-2 transition-colors ${
                      activeTab === 'videos'
                        ? 'border-accent theme-text'
                        : 'border-transparent theme-text-secondary hover:theme-text'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Video
                    </div>
                  </button>
                </div>
              </div>

              {/* Media Content */}
              <div className="space-y-4">
                {/* Selected Items */}
                {selectedItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium theme-text mb-2">Contenuto Selezionato</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {availableMedia
                        .filter(media => selectedItems.includes(media.id))
                        .map((media) => (
                          <div key={media.id} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden">
                              <img
                                src={media.type === 'video' ? media.thumbnail || '/placeholder-video.png' : media.url}
                                alt={media.title || ''}
                                className="w-full h-full object-cover"
                              />
                              {media.type === 'video' && (
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <Video className="w-6 h-6 text-white" />
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => toggleItemSelection(media.id)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Available Media */}
                <div>
                  <h3 className="text-sm font-medium theme-text mb-2">Media Disponibili</h3>
                  {loading ? (
                    <div className="flex justify-center items-center h-48">
                      <Loader2 className="w-6 h-6 animate-spin theme-text" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1">
                      {availableMedia
                        .filter(media => media.type === activeTab.slice(0, -1))
                        .map((media) => {
                          const isSelected = selectedItems.includes(media.id);
                          return (
                            <div
                              key={media.id}
                              onClick={() => toggleItemSelection(media.id)}
                              className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                                isSelected
                                  ? 'border-accent'
                                  : 'border-transparent hover:border-accent/50'
                              }`}
                            >
                              <img
                                src={media.type === 'video' ? (media.thumbnail || '/placeholder-video.png') : media.url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {media.type === 'video' && (
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <Video className="w-6 h-6 text-white" />
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                  <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t theme-border flex justify-end space-x-2 theme-bg-primary">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-80"
                disabled={isSaving}
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || selectedItems.length === 0 || isSaving}
                className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <span>Salva</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
