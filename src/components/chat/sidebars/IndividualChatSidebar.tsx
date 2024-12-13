import React from 'react';
import { BanIcon, Flag, Trash2, Volume2, VolumeX } from 'lucide-react';
import BaseSidebar, { BaseSidebarProps } from './BaseSidebar';

interface IndividualChatSidebarProps extends BaseSidebarProps {
  chatData: any;
  options: any;
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
  onReport: () => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onToggleMute: () => Promise<void>;
  onSetTimer?: (timer: number) => Promise<void>;
  onToggleScreenshotPrevention?: () => Promise<void>;
}

export default function IndividualChatSidebar({
  chatData,
  options,
  onBlock,
  onUnblock,
  onReport,
  onDeleteChat,
  onToggleMute,
  onSetTimer,
  onToggleScreenshotPrevention,
  ...baseProps
}: IndividualChatSidebarProps) {
  const [showTimerOptions, setShowTimerOptions] = React.useState(false);
  const isMuted = options?.isMuted;
  const isBlocked = options?.isBlocked;
  const messageTimer = options?.messageTimer || 0;
  const screenshotPrevention = options?.screenshotPrevention;

  const timerOptions = [
    { label: 'Disattivato', value: 0 },
    { label: '5 secondi', value: 5 },
    { label: '10 secondi', value: 10 },
    { label: '30 secondi', value: 30 },
    { label: '1 minuto', value: 60 }
  ];

  return (
    <BaseSidebar {...baseProps}>
      {/* Sezione Notifiche */}
      <div className="space-y-4">
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

      {/* Sezione Privacy */}
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-semibold theme-text">Privacy</h3>
        <button
          onClick={isBlocked ? onUnblock : onBlock}
          className="w-full flex items-center justify-between p-3 theme-bg-secondary rounded-lg"
        >
          <div className="flex items-center gap-3">
            <BanIcon className="w-5 h-5 theme-text" />
            <div>
              <p className="font-medium theme-text">
                {isBlocked ? 'Sblocca utente' : 'Blocca utente'}
              </p>
              <p className="text-sm theme-text opacity-70">
                {isBlocked ? 'Permetti di nuovo i messaggi' : 'Non ricevere più messaggi'}
              </p>
            </div>
          </div>
        </button>

        {onSetTimer && (
          <div className="space-y-2">
            <button
              onClick={() => setShowTimerOptions(!showTimerOptions)}
              className="w-full flex items-center justify-between p-3 theme-bg-secondary rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 theme-text">⏱️</div>
                <div>
                  <p className="font-medium theme-text">Timer messaggi</p>
                  <p className="text-sm theme-text opacity-70">
                    {messageTimer === 0 ? 'Disattivato' : `${messageTimer} secondi`}
                  </p>
                </div>
              </div>
            </button>

            {showTimerOptions && (
              <div className="space-y-1 ml-8">
                {timerOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSetTimer(option.value);
                      setShowTimerOptions(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded theme-text ${
                      messageTimer === option.value
                        ? 'bg-blue-600'
                        : 'hover:theme-bg-secondary'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {onToggleScreenshotPrevention && (
          <button
            onClick={onToggleScreenshotPrevention}
            className="w-full flex items-center justify-between p-3 theme-bg-secondary rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 theme-text">📸</div>
              <div>
                <p className="font-medium theme-text">Previeni screenshot</p>
                <p className="text-sm theme-text opacity-70">
                  {screenshotPrevention ? 'Attivo' : 'Disattivo'}
                </p>
              </div>
            </div>
          </button>
        )}
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
              <p className="font-medium theme-text">Segnala utente</p>
              <p className="text-sm theme-text opacity-70">Segnala comportamento inappropriato</p>
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
