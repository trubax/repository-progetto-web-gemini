import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Upload } from 'lucide-react';

interface VideoUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, caption: string) => Promise<void>;
}

export function VideoUploadDialog({ open, onClose, onUpload }: VideoUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setIsUploading(true);
      await onUpload(selectedFile, caption);
      setSelectedFile(null);
      setCaption('');
      onClose();
    } catch (error) {
      console.error('Errore nel caricamento:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carica un nuovo video</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed theme-border rounded-lg p-6">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
            />
            <label 
              htmlFor="video-upload" 
              className="flex flex-col items-center cursor-pointer"
            >
              <Upload className="w-8 h-8 theme-text mb-2" />
              <span className="text-sm theme-text">
                {selectedFile ? selectedFile.name : 'Seleziona un video'}
              </span>
            </label>
          </div>

          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Aggiungi una descrizione..."
            className="min-h-[100px]"
          />

          <Button 
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? 'Caricamento in corso...' : 'Pubblica'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 