import React from 'react';
import { Star, Flag, Trash2, Volume2, VolumeX, Clock } from 'lucide-react';
import BaseSidebar, { BaseSidebarProps } from './BaseSidebar';

interface ServiceChatSidebarProps extends BaseSidebarProps {
  chatData: any;
  onRate: (rating: number) => Promise<void>;
  onReport: () => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onToggleMute: () => Promise<void>;
  onSchedule: () => Promise<void>;
}

export default function ServiceChatSidebar({
  chatData,
  onRate,
  onReport,
  onDeleteChat,
  onToggleMute,
  onSchedule,
  ...baseProps
}: ServiceChatSidebarProps) {
  const isMuted = chatData?.isMuted;
  const currentRating = chatData?.userRating || 0;

  return (
    <BaseSidebar {...baseProps}>
      {/* Sezione Valutazione */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold theme-text">Valutazione</h3>
        <div className="p-3 theme-bg-secondary rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <p className="font-medium theme-text">Valuta il servizio</p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => onRate(rating)}
                className={`p-2 rounded-full transition-colors ${
                  rating <= currentRating ? 'text-yellow-500' : 'theme-text opacity-50'
                }`}
              >
                <Star className="w-6 h-6" fill={rating <= currentRating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sezione Appuntamenti */}
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-semibold theme-text">Appuntamenti</h3>
        <button
          onClick={onSchedule}
          className="w-full flex items-center justify-between p-3 theme-bg-secondary rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 theme-text" />
            <div>
              <p className="font-medium theme-text">Prenota appuntamento</p>
              <p className="text-sm theme-text opacity-70">Pianifica una sessione</p>
            </div>
          </div>
        </button>
      </div>

      {/* Sezione Notifiche */}
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-semibold theme-text">Notifiche</h3>
        <button
          onClick={onToggleMute}
          className="w-full flex items-center justify-between p-3 theme-bg-secondary rounded-lg"
        >
          <div className="flex items-center gap-3">
            {isMuted ? (
              <VolumeX className="w-5 h-5 theme-text" />
            ) : (
              <Volume2 className="w-5 h-5 theme-text" />
            )}
            <div>
              <p className="font-medium theme-text">
                {isMuted ? 'Riattiva notifiche' : 'Silenzia notifiche'}
              </p>
              <p className="text-sm theme-text opacity-70">
                {isMuted ? 'Ricevi di nuovo le notifiche' : 'Non ricevere notifiche'}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Sezione Azioni */}
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-semibold theme-text">Azioni</h3>
        <button
          onClick={onReport}
          className="w-full flex items-center justify-between p-3 theme-bg-secondary rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Flag className="w-5 h-5 theme-text" />
            <div>
              <p className="font-medium theme-text">Segnala servizio</p>
              <p className="text-sm theme-text opacity-70">Segnala problemi con il servizio</p>
            </div>
          </div>
        </button>

        <button
          onClick={onDeleteChat}
          className="w-full flex items-center justify-between p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5" />
            <div>
              <p className="font-medium">Elimina chat</p>
              <p className="text-sm opacity-70">Elimina tutti i messaggi</p>
            </div>
          </div>
        </button>
      </div>
    </BaseSidebar>
  );
}
