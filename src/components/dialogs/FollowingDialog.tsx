import { Dialog } from '@/components/ui/Dialog';
import { Avatar } from '@/components/ui/Avatar';
import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '@/types/user';
import { UserMinus } from 'lucide-react';
import { unfollowUser } from '@/lib/follow';

interface FollowingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  isOwnProfile: boolean;
}

export function FollowingDialog({ isOpen, onClose, userId, isOwnProfile }: FollowingDialogProps) {
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        if (!userData?.following) {
          setFollowing([]);
          return;
        }

        const followingData = await Promise.all(
          userData.following.map(async (followingId: string) => {
            const followingDoc = await getDoc(doc(db, 'users', followingId));
            return {
              id: followingId,
              ...followingDoc.data()
            } as User;
          })
        );
        
        setFollowing(followingData);
      } catch (error) {
        console.error('Errore nel caricamento dei following:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [userId, isOpen]);

  const handleUnfollow = async (followingId: string) => {
    try {
      await unfollowUser(followingId);
      setFollowing(following.filter(user => user.id !== followingId));
    } catch (error) {
      console.error('Errore durante l\'unfollow:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 theme-bg-secondary/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="theme-bg-primary rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4 theme-text">Seguiti</h2>
            
            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 theme-border"></div>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {following.length === 0 ? (
                  <div className="text-center p-4 theme-text-secondary">
                    Non segui nessuno
                  </div>
                ) : (
                  <div className="space-y-4">
                    {following.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-2 hover:theme-bg-secondary rounded-lg transition-colors">
                        <Avatar src={user.photoURL} alt={user.displayName} />
                        <span className="theme-text font-medium">{user.displayName}</span>
                        {isOwnProfile && (
                          <button
                            onClick={() => handleUnfollow(user.id)}
                            className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
                          >
                            <UserMinus className="w-5 h-5 text-red-500" />
                          </button>
                        )}
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