import React from 'react';
import ProfileHeader from './ProfileHeader';

interface ProfileLayoutProps {
  children: React.ReactNode;
  isOwnProfile?: boolean;
  onOpenSettings?: () => void;
}

export default function ProfileLayout({ 
  children, 
  isOwnProfile = false,
  onOpenSettings 
}: ProfileLayoutProps) {
  return (
    <div className="page-layout">
      <div className="fixed-header">
        <ProfileHeader 
          isOwnProfile={isOwnProfile} 
          onOpenSettings={onOpenSettings}
        />
      </div>
      <div className="scroll-view">
        {children}
      </div>
    </div>
  );
} 