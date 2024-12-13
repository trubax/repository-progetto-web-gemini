import React, { useState } from 'react';
import { Camera, Image, Trash2, Users, Shield } from 'lucide-react';
import BaseSidebar, { BaseSidebarProps } from './BaseSidebar';
import { useAuth } from '../../../contexts/AuthContext';

interface GroupChatSidebarProps extends BaseSidebarProps {
  chatData: any;
  onUpdatePhoto: (file: File) => Promise<void>;
  onUpdateBackground: (file: File) => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onRemoveParticipant: (userId: string) => Promise<void>;
  onMakeAdmin: (userId: string) => Promise<void>;
}

export default function GroupChatSidebar({
  chatData,
  onUpdatePhoto,
  onUpdateBackground,
  onDeleteChat,
  onRemoveParticipant,
  onMakeAdmin,
  ...baseProps
}: GroupChatSidebarProps) {
  const { currentUser } = useAuth();
  const [showParticipants, setShowParticipants] = useState(false);
  const isAdmin = chatData?.admins?.includes(currentUser?.uid);
  const isCreator = chatData?.creator === currentUser?.uid;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpdatePhoto(file);
    }
  };

  const handleBackgroundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpdateBackground(file);
    }
  };

  return (
    <BaseSidebar {...baseProps}>
      {/* Sezione Media */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold theme-text">Media</h3>
        
        {/* Foto del gruppo */}
        {isAdmin && (
          <div className="flex items-center justify-between p-3 theme-bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 theme-text" />
              <div>
                <p className="font-medium theme-text">Foto del gruppo</p>
                <p className="text-sm theme-text opacity-70">Cambia la foto del gruppo</p>
              </div>
            </div>
            <label className="cursor-pointer p-2 hover:theme-bg-accent rounded-full transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Image className="w-5 h-5 theme-text" />
            </label>
          </div>
        )}

        {/* Sfondo chat */}
        {isAdmin && (
          <div className="flex items-center justify-between p-3 theme-bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 theme-text" />
              <div>
                <p className="font-medium theme-text">Sfondo chat</p>
                <p className="text-sm theme-text opacity-70">Personalizza lo sfondo della chat</p>
              </div>
            </div>
            <label className="cursor-pointer p-2 hover:theme-bg-accent rounded-full transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBackgroundChange}
              />
              <Image className="w-5 h-5 theme-text" />
            </label>
          </div>
        )}
      </div>

      {/* Sezione Partecipanti */}
      <div className="mt-6 space-y-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowParticipants(!showParticipants)}
        >
          <h3 className="text-lg font-semibold theme-text">Partecipanti</h3>
          <span className="text-sm theme-text opacity-70">
            {chatData?.participants?.length || 0} membri
          </span>
        </div>

        {showParticipants && (
          <div className="space-y-2">
            {chatData?.participants?.map((participant: any) => (
              <div key={participant.id} className="flex items-center justify-between p-3 theme-bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <img
                    src={participant.photoURL}
                    alt={participant.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium theme-text">{participant.name}</p>
                    <p className="text-sm theme-text opacity-70">
                      {participant.id === chatData.creator ? 'Creatore' : 
                       chatData.admins?.includes(participant.id) ? 'Admin' : 'Membro'}
                    </p>
                  </div>
                </div>
                {isAdmin && participant.id !== currentUser?.uid && (
                  <div className="flex items-center gap-2">
                    {!chatData.admins?.includes(participant.id) && (
                      <button
                        onClick={() => onMakeAdmin(participant.id)}
                        className="p-2 hover:theme-bg-accent rounded-full transition-colors"
                      >
                        <Shield className="w-5 h-5 theme-text" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveParticipant(participant.id)}
                      className="p-2 hover:bg-red-500 rounded-full transition-colors"
                    >
                      <Trash2 className="w-5 h-5 theme-text" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Azioni pericolose */}
      {isCreator && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold theme-text">Azioni pericolose</h3>
          <button
            onClick={onDeleteChat}
            className="w-full p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Elimina gruppo
          </button>
        </div>
      )}
    </BaseSidebar>
  );
}
