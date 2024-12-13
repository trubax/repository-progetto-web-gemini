export interface Video {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  videoUrl: string;
  caption: string;
  createdAt: any;
  likes: string[];
  comments: any[];
  views: number;
  fileName?: string;
} 

interface VideoGridProps {
  userId?: string;
  isOwnProfile?: boolean;
} 