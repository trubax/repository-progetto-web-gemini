export interface CommentLike {
  userId: string;
  createdAt: any;
}

export interface Reply {
  id: string;
  userId: string;
  text: string;
  createdAt: any;
  userName: string;
  userPhotoURL?: string | null;
  likes: CommentLike[];
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: any;
  userName: string;
  userPhotoURL?: string | null;
  likes: CommentLike[];
  replies: Reply[];
} 