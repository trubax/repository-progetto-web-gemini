export interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  caption?: string;
  imageUrl: string;
  createdAt: string;
  likes: Like[];
  comments: Comment[];
}

export interface Like {
  userId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  createdAt: string;
} 