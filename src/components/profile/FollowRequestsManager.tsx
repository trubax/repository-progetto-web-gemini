import React from 'react';
import { useFollowerManagement } from '@/hooks/useFollowerManagement';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface FollowRequestsManagerProps {
  userId: string;
  onRequestHandled?: () => void;
}

export const FollowRequestsManager: React.FC<FollowRequestsManagerProps> = ({
  userId,
  onRequestHandled
}) => {
  const { pendingRequests, loading, error, acceptFollowRequest, rejectFollowRequest } = useFollowerManagement(userId);

  const handleAccept = async (requesterId: string) => {
    const success = await acceptFollowRequest(requesterId);
    if (success && onRequestHandled) {
      onRequestHandled();
    }
  };

  const handleReject = async (requesterId: string) => {
    const success = await rejectFollowRequest(requesterId);
    if (success && onRequestHandled) {
      onRequestHandled();
    }
  };

  if (error) {
    return (
      <div className="p-4 text-center theme-text">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 theme-border mx-auto"></div>
      </div>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="p-4 text-center theme-text">
        <p>Nessuna richiesta di follow in sospeso</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold mb-4 theme-text">Richieste di follow</h3>
      <div className="space-y-3">
        {pendingRequests.map((request) => (
          <div 
            key={request.id} 
            className="flex items-center justify-between p-3 rounded-lg theme-bg-secondary"
          >
            <div className="flex items-center gap-3">
              <img
                src={request.photoURL || '/default-avatar.png'}
                alt={request.displayName}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-medium theme-text">{request.displayName}</p>
                <p className="text-sm opacity-70 theme-text">@{request.username}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleAccept(request.id)}
                className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
              >
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </Button>
              <Button
                onClick={() => handleReject(request.id)}
                className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
              >
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
