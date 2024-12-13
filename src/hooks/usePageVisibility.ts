export const usePageVisibility = () => {
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      // Gestisci lo stato della pagina in modo più controllato
      if (isVisible) {
        // Azioni quando la pagina diventa visibile
      } else {
        // Azioni quando la pagina viene nascosta
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}; 