import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  videoId: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export function VideoPlayer({ 
  src, 
  videoId, 
  autoPlay = true, 
  controls = true, 
  className = '',
  onPlay,
  onPause,
  onEnded
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      setIsLoading(true);
      
      // Reset del video quando cambia la sorgente
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.src = src;
      
      // Carica e avvia il video
      videoRef.current.load();
      if (autoPlay) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsLoading(false))
            .catch(error => {
              console.error('Errore riproduzione video:', error);
              setIsLoading(false);
            });
        }
      }
    }

    // Cleanup
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [src, autoPlay]);

  const handlePlay = () => {
    onPlay?.();
  };

  const handlePause = () => {
    onPause?.();
  };

  const handleEnded = () => {
    onEnded?.();
  };

  const handleLoadedData = () => {
    setIsLoading(false);
    if (autoPlay && videoRef.current) {
      videoRef.current.play()
        .catch(error => console.error('Errore avvio video:', error));
    }
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className={`w-full rounded-lg ${className} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        autoPlay={autoPlay}
        controls={controls}
        playsInline
        onLoadedData={handleLoadedData}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
      >
        <source src={src} type="video/mp4" />
        Il tuo browser non supporta la riproduzione video.
      </video>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
          <div className="w-8 h-8 border-2 border-t-transparent border-accent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}