import { Dialog } from '../ui/Dialog';
import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (video: File, title: string, description: string) => Promise<void>;
}

export function VideoModal({ open, onOpenChange, onSubmit }: VideoModalProps) {
  const [video, setVideo] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideo(file);
      const videoUrl = URL.createObjectURL(file);
      setPreview(videoUrl);
    }
  };

  const handleSubmit = async () => {
    if (!video) return;
    
    try {
      setIsUploading(true);
      await onSubmit(video, title, description);
      // Reset form
      setVideo(null);
      setTitle('');
      setDescription('');
      setPreview(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Errore nel caricamento:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="theme-bg-primary rounded-xl shadow-lg max-w-md w-full">
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center border-b theme-border pb-4">
              <h2 className="text-xl font-semibold theme-text">
                Carica un nuovo video
              </h2>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-full hover:theme-bg-secondary transition-colors"
              >
                <X className="h-5 w-5 theme-text" />
              </button>
            </div>

            {!video ? (
              <div
                onClick={() => videoInputRef.current?.click()}
                className="border-2 border-dashed theme-border rounded-lg p-8 text-center cursor-pointer hover:theme-bg-secondary transition-colors"
              >
                <Upload className="mx-auto h-12 w-12 theme-text opacity-50" />
                <p className="mt-2 text-sm theme-text opacity-70">
                  Clicca per selezionare un video
                </p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <video
                    src={preview!}
                    className="w-full h-full object-contain"
                    controls
                  />
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titolo del video"
                    className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrizione del video..."
                    className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t theme-border">
              <button
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-90 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSubmit}
                disabled={!video || isUploading || !title.trim()}
                className="px-4 py-2 rounded-lg theme-bg-accent theme-text-accent disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Caricamento...
                  </div>
                ) : (
                  'Pubblica'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 