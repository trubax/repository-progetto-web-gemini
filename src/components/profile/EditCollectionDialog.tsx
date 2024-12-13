import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { X, Loader2, Trash2, Save } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface EditCollectionDialogProps {
  collectionId: string;
  initialItems: string[];
  onClose: () => void;
}

export function EditCollectionDialog({ collectionId, initialItems, onClose }: EditCollectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCollection = async () => {
      try {
        const docRef = doc(db, 'collections', collectionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setDescription(data.description || '');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Errore nel caricamento della collezione:', error);
        toast.error('Errore nel caricamento della collezione');
        setLoading(false);
      }
    };

    loadCollection();
  }, [collectionId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Il nome della raccolta è obbligatorio');
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'collections', collectionId);
      await updateDoc(docRef, {
        name: name.trim(),
        description: description.trim(),
        updatedAt: new Date().toISOString()
      });

      toast.success('Raccolta aggiornata con successo');
      onClose();
    } catch (error) {
      console.error('Errore nel salvataggio della raccolta:', error);
      toast.error('Errore nel salvataggio della raccolta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare questa raccolta?')) {
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'collections', collectionId);
      await updateDoc(docRef, {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      toast.success('Raccolta eliminata con successo');
      onClose();
    } catch (error) {
      console.error('Errore nell\'eliminazione della raccolta:', error);
      toast.error('Errore nell\'eliminazione della raccolta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div className="theme-bg-primary rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b theme-border flex justify-between items-center shrink-0">
            <h2 className="text-lg font-semibold theme-text">
              Modifica raccolta
            </h2>
            <div className="flex items-center space-x-2">
              <button onClick={handleDelete} disabled={saving} className="p-2 rounded-full theme-bg-secondary hover:theme-bg-secondary-focus">
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
              <button onClick={handleSave} disabled={saving} className="p-2 rounded-full theme-bg-secondary hover:theme-bg-secondary-focus">
                <Save className="h-4 w-4 text-green-500" />
              </button>
            </div>
          </div>
          {/* Body */}
          <div className="p-4 flex-1 overflow-y-auto">
            {/* Form */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="name" className="w-24 text-right">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome della raccolta"
                  className="flex-1 theme-bg-secondary rounded-md p-2"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label htmlFor="description" className="w-24 text-right">
                  Descrizione
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrizione della raccolta"
                  className="flex-1 theme-bg-secondary rounded-md p-2"
                />
              </div>
            </div>
          </div>
          {/* Footer */}
          <div className="p-4 border-t theme-border flex justify-end items-center shrink-0">
            <button onClick={onClose} disabled={saving} className="p-2 rounded-full theme-bg-secondary hover:theme-bg-secondary-focus">
              <X className="h-4 w-4 text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 