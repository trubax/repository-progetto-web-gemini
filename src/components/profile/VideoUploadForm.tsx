import { useState } from 'react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useAuth } from '../../hooks/useAuth';
import { storage, db } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';

export function VideoUploadForm({ onClose }: { onClose: () => void }) {
  const { currentUser } = useAuth();
  const [caption, setCaption] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !currentUser) return;

    try {
      setLoading(true);
      
      // Upload video
      const storageRef = ref(storage, `videos/${currentUser.uid}/${Date.now()}_${video.name}`);
      const uploadTask = uploadBytesResumable(storageRef, video);
      
      const snapshot = await uploadTask;
      const videoUrl = await getDownloadURL(snapshot.ref);

      // Save video data to Firestore
      await addDoc(collection(db, 'videos'), {
        url: videoUrl,
        caption,
        userId: currentUser.uid,
        createdAt: new Date(),
        likes: [],
        comments: []
      });

      onClose();
    } catch (error) {
      console.error('Error uploading video:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          type="file"
          accept="video/*"
          onChange={(e) => setVideo(e.target.files?.[0] || null)}
          required
        />
      </div>
      
      <div>
        <Textarea
          placeholder="Aggiungi una didascalia..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Annulla
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Caricamento...' : 'Pubblica'}
        </Button>
      </div>
    </form>
  );
} 