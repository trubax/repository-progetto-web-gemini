import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import PeerIcon from '@mui/icons-material/GroupWork';
import ErrorIcon from '@mui/icons-material/Error';
import LocalMediaStore from '../../../services/LocalMediaStore';

interface MediaMessageProps {
  mediaId: string;
  type: 'audio' | 'image' | 'video';
  sender: string;
  timestamp: number;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  mediaId,
  type,
  sender,
  timestamp,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<'local' | 'uploading' | 'uploaded' | 'p2p'>('local');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadMedia = async () => {
      try {
        const media = await LocalMediaStore.getMedia(mediaId);
        if (!media) {
          setError('Media non trovato');
          return;
        }

        setMediaUrl(URL.createObjectURL(media.blob));
        setUploadStatus(media.metadata.uploadStatus);

        // Aggiorna lo stato quando cambia
        const statusCheck = setInterval(async () => {
          const updatedMedia = await LocalMediaStore.getMedia(mediaId);
          if (updatedMedia && updatedMedia.metadata.uploadStatus !== uploadStatus) {
            setUploadStatus(updatedMedia.metadata.uploadStatus);
          }
        }, 1000);

        return () => clearInterval(statusCheck);
      } catch (error) {
        console.error('Error loading media:', error);
        setError('Errore nel caricamento del media');
      }
    };

    loadMedia();
  }, [mediaId]);

  const renderStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <CircularProgress size={20} />;
      case 'uploaded':
        return <CloudDoneIcon color="success" />;
      case 'p2p':
        return <PeerIcon color="primary" />;
      case 'local':
        return <CloudUploadIcon color="action" />;
    }
  };

  const renderMedia = () => {
    if (error) {
      return (
        <Box display="flex" alignItems="center" gap={1}>
          <ErrorIcon color="error" />
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      );
    }

    if (!mediaUrl) {
      return <CircularProgress size={24} />;
    }

    switch (type) {
      case 'image':
        return (
          <Box
            component="img"
            src={mediaUrl}
            alt="Immagine"
            sx={{
              maxWidth: '100%',
              maxHeight: '300px',
              borderRadius: 1,
              objectFit: 'contain'
            }}
          />
        );
      
      case 'video':
        return (
          <Box
            component="video"
            src={mediaUrl}
            controls
            sx={{
              maxWidth: '100%',
              maxHeight: '300px',
              borderRadius: 1
            }}
          />
        );
      
      case 'audio':
        return (
          <Box
            component="audio"
            src={mediaUrl}
            controls
            sx={{
              width: '100%',
              maxWidth: '300px'
            }}
          />
        );
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        maxWidth: '100%'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        {renderMedia()}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          opacity: 0.7
        }}
      >
        <Typography variant="caption">
          {new Date(timestamp).toLocaleTimeString()}
        </Typography>
        <IconButton size="small">
          {renderStatusIcon()}
        </IconButton>
      </Box>
    </Box>
  );
};

export default MediaMessage;
