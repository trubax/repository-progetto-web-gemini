interface CommentLike {
  userId: string;
  createdAt: Date;
}

interface Reply {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  userName: string;
  userPhotoURL?: string | null;
  likes: CommentLike[];
}

interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  userName: string;
  userPhotoURL?: string | null;
  likes: CommentLike[];
  replies: Reply[];
}

export interface Video {
  id: string;
  url: string;
  thumbnail?: string;
  caption?: string;
  userId: string;
  createdAt: Date;
  likes?: string[];
  comments?: Comment[];
} 