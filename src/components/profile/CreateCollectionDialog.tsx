import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Loader2, Video, Check } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { getVideoThumbnail } from '../../utils/videoUtils';

export function CreateCollectionDialog({ open, onOpenChange, onSubmit }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);

  // Carica i video dell'utente con le loro anteprime
  useEffect(() => {
    const loadUserVideos = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        const videosRef = collection(db, 'users', currentUser.uid, 'videos');
        const videosSnap = await getDocs(videosRef);
        
        const videos = await Promise.all(videosSnap.docs.map(async (doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'video',
            url: data.url,
            thumbnailUrl: data.thumbnailUrl || await getVideoThumbnail(data.url),
            title: data.title
          };
        }));

        setUserVideos(videos);
      } catch (error) {
        console.error('Errore nel caricamento dei video:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserVideos();
  }, [currentUser]);

  const handleSubmit = async () => {
    if (!currentUser) return;

    // Raccogli le informazioni delle anteprime per i video selezionati
    const selectedMedia = selectedItems.map(itemId => {
      const video = userVideos.find(v => v.id === itemId);
      if (video) {
        return {
          id: itemId,
          type: 'video',
          url: video.url,
          thumbnailUrl: video.thumbnailUrl,
          title: video.title
        };
      }
      return null;
    }).filter(item => item !== null);

    onSubmit({
      name,
      description,
      items: selectedItems,
      thumbnails: selectedMedia
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crea nuova raccolta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ... campi nome e descrizione ... */}

          <div>
            <label className="block mb-2 text-sm font-medium theme-text">
              Seleziona video
            </label>
            
            {loading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-2">
                {userVideos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      setSelectedItems(prev => 
                        prev.includes(video.id)
                          ? prev.filter(id => id !== video.id)
                          : [...prev, video.id]
                      );
                    }}
                    className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer ${
                      selectedItems.includes(video.id) 
                        ? 'ring-2 ring-accent' 
                        : ''
                    }`}
                  >
                    <img
                      src={video.thumbnailUrl || video.url}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    {video.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                    )}
                    {selectedItems.includes(video.id) && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                handleSubmit();
              }}
            >
              Crea raccolta
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
} 