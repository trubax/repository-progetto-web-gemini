import { useFollow } from '@/hooks/useFollow';

export function ProfileActions({ userId, isPrivate }) {
  const { currentUser } = useAuth();
  const { isFollowing, isPending, handleFollow, handleUnfollow } = useFollow(userId, currentUser?.uid);

  const handleFollowClick = () => {
    if (isFollowing || isPending) {
      handleUnfollow();
    } else {
      handleFollow(isPrivate);
    }
  };

  return (
    <button
      onClick={handleFollowClick}
      className="px-4 py-2 rounded-lg bg-blue-500 text-white"
    >
      {isFollowing ? 'Segui già' : isPending ? 'Richiesta inviata' : 'Segui'}
    </button>
  );
} 