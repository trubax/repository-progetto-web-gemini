import { Dialog } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '@/types/user';

interface FollowersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function FollowersDialog({ isOpen, onClose, userId }: FollowersDialogProps) {
  const [followers, setFollowers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowers = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        if (!userData?.followers) {
          setFollowers([]);
          return;
        }

        const followersData = await Promise.all(
          userData.followers.map(async (followerId: string) => {
            const followerDoc = await getDoc(doc(db, 'users', followerId));
            return {
              id: followerId,
              ...followerDoc.data()
            } as User;
          })
        );
        
        setFollowers(followersData);
      } catch (error) {
        console.error('Errore nel caricamento dei followers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [userId, isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 theme-bg-secondary/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="theme-bg-primary rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 theme-text">Followers</h2>
            
            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 theme-border"></div>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {followers.length === 0 ? (
                  <div className="text-center p-4 theme-text-secondary">
                    Nessun follower
                  </div>
                ) : (
                  <div className="space-y-4">
                    {followers.map((follower) => (
                      <div key={follower.id} className="flex items-center gap-3 p-2 hover:theme-bg-secondary rounded-lg transition-colors">
                        <Avatar src={follower.photoURL} alt={follower.displayName} />
                        <span className="theme-text font-medium">{follower.displayName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t theme-border flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg theme-bg-secondary theme-text hover:opacity-80 transition-opacity"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 