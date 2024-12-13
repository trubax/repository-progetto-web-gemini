import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { storage, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface GroupSettingsProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  groupPhoto?: string;
  isAdmin: boolean;
}

export function GroupSettings({ 
  chatId, 
  isOpen, 
  onClose, 
  groupName: initialGroupName,
  groupPhoto: initialGroupPhoto,
  isAdmin 
}: GroupSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState(initialGroupName);
  const [groupPhoto, setGroupPhoto] = useState(initialGroupPhoto);
  const { currentUser } = useAuth();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Errore",
        description: "Per favore seleziona un'immagine valida",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Upload foto
      const storageRef = ref(storage, `groups/${chatId}/photo`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Aggiorna il documento della chat
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        groupPhoto: photoURL
      });

      setGroupPhoto(photoURL);
      toast({
        title: "Successo",
        description: "Foto del gruppo aggiornata con successo"
      });
    } catch (error) {
      console.error('Error updating group photo:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento della foto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = async () => {
    if (!groupName.trim() || groupName === initialGroupName) return;

    setLoading(true);
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        groupName: groupName.trim()
      });

      toast({
        title: "Successo",
        description: "Nome del gruppo aggiornato con successo"
      });
    } catch (error) {
      console.error('Error updating group name:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento del nome",
        variant: "destructive"
      });
      setGroupName(initialGroupName);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Impostazioni Gruppo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={groupPhoto} />
                <AvatarFallback>
                  {groupName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 p-1 rounded-full bg-blue-500 hover:bg-blue-600 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white" />
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={loading}
                />
              </label>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="group-name">Nome del gruppo</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button onClick={handleNameChange} disabled={loading}>
              Salva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
