import React from 'react';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Dialog } from '../ui/Dialog';
import { useNotifications } from '../../context/NotificationContext';

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationDialog({ isOpen, onClose }: NotificationDialogProps) {
  const { notifications, markAllAsRead } = useNotifications();

  const handleClose = () => {
    markAllAsRead();
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      className="fixed inset-x-0 bottom-0 z-50 w-full sm:static sm:w-[500px] mx-auto"
    >
      <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b theme-border">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5 theme-text" />
            </button>
            <h2 className="text-lg font-semibold theme-text">Notifiche</h2>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(100vh-8rem)] sm:max-h-[600px]">
          {notifications.length > 0 ? (
            <div className="space-y-2 p-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {notification.senderPhotoURL && (
                      <img
                        src={notification.senderPhotoURL}
                        alt={notification.senderName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="theme-text">
                        <span className="font-medium">{notification.senderName}</span>{' '}
                        {notification.message}
                      </p>
                      <p className="text-sm theme-text-secondary mt-1">
                        {formatDistanceToNow(notification.timestamp?.toDate(), {
                          addSuffix: true,
                          locale: it
                        })}
                      </p>
                    </div>
                  </div>
                  {(notification.postImage || notification.videoThumbnail) && (
                    <div className="mt-3 ml-13">
                      <img
                        src={notification.postImage || notification.videoThumbnail}
                        alt="Content"
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center theme-text-secondary">
                <p className="text-lg">Nessuna notifica da leggere</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
