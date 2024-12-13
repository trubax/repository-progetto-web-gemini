import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import ProfileSidebar from './ProfileSidebar';

interface ProfileHeaderProps {
  isOwnProfile?: boolean;
  onOpenSettings?: () => void;
}

export default function ProfileHeader({ isOwnProfile, onOpenSettings }: ProfileHeaderProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 theme-bg-primary shadow-md">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-full hover:theme-bg-secondary transition-colors theme-text"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold theme-text">
              {isOwnProfile ? 'Il tuo profilo' : 'Profilo'}
            </h1>
          </div>

          <div className="flex items-center">
            {currentUser && (
              <img
                src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'User')}`}
                alt={currentUser.displayName || 'Profilo'}
                className="w-8 h-8 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/profile')}
              />
            )}
          </div>
        </div>
      </header>

      <ProfileSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
    </>
  );
} 