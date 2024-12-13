import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProfileView } from './ProfileView';

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  // Imposta 'videos' come tab di default
  const [activeTab, setActiveTab] = useState<'posts' | 'videos' | 'collections'>('videos');

  return (
    <ProfileView 
      userId={userId!} 
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
} 