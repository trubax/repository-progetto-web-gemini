interface LocalMedia {
  id: string;
  blob: Blob;
  type: 'audio' | 'image' | 'video';
  metadata: {
    name: string;
    size: number;
    type: string;
    timestamp: number;
    uploadStatus: 'local' | 'uploading' | 'uploaded' | 'p2p';
  };
}

class LocalMediaStore {
  private static instance: LocalMediaStore;
  private mediaMap: Map<string, LocalMedia>;

  private constructor() {
    this.mediaMap = new Map();
  }

  static getInstance(): LocalMediaStore {
    if (!LocalMediaStore.instance) {
      LocalMediaStore.instance = new LocalMediaStore();
    }
    return LocalMediaStore.instance;
  }

  async storeMedia(file: File | Blob, type: 'audio' | 'image' | 'video'): Promise<string> {
    const mediaId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const media: LocalMedia = {
      id: mediaId,
      blob: file instanceof Blob ? file : new Blob([file]),
      type,
      metadata: {
        name: file instanceof File ? file.name : `${type}_${mediaId}`,
        size: file.size,
        type: file.type,
        timestamp: Date.now(),
        uploadStatus: 'local'
      }
    };

    this.mediaMap.set(mediaId, media);
    return mediaId;
  }

  async getMedia(mediaId: string): Promise<LocalMedia | null> {
    return this.mediaMap.get(mediaId) || null;
  }

  async updateUploadStatus(mediaId: string, status: 'local' | 'uploading' | 'uploaded' | 'p2p'): Promise<void> {
    const media = this.mediaMap.get(mediaId);
    if (media) {
      media.metadata.uploadStatus = status;
      this.mediaMap.set(mediaId, media);
    }
  }

  async deleteMedia(mediaId: string): Promise<boolean> {
    return this.mediaMap.delete(mediaId);
  }

  async getAllMedia(): Promise<LocalMedia[]> {
    return Array.from(this.mediaMap.values());
  }

  async clearOldMedia(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    for (const [id, media] of this.mediaMap.entries()) {
      if (now - media.metadata.timestamp > maxAgeMs) {
        this.mediaMap.delete(id);
      }
    }
  }
}

export default LocalMediaStore.getInstance();
