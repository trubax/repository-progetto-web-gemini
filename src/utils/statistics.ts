import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format, subDays, subHours, subMonths, subYears, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { getDemographicStats } from './demographics';

interface PostStats {
  id: string;
  imageUrl?: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  createdAt: Date;
}

interface VideoStats {
  id: string;
  thumbnailUrl?: string;
  title: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  watchTime: number;
  completionRate: number;
  createdAt: Date;
}

interface TimeRange {
  start: Date;
  end: Date;
  interval: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

function getTimeRange(period: string): TimeRange {
  const now = new Date();
  switch (period) {
    case '1h':
      return {
        start: subHours(now, 1),
        end: now,
        interval: 'hour'
      };
    case '1d':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
        interval: 'day'
      };
    case '7d':
      return {
        start: subDays(now, 7),
        end: now,
        interval: 'day'
      };
    case '30d':
      return {
        start: subDays(now, 30),
        end: now,
        interval: 'day'
      };
    case '1y':
      return {
        start: subYears(now, 1),
        end: now,
        interval: 'month'
      };
    default:
      return {
        start: new Date(0),
        end: now,
        interval: 'all'
      };
  }
}

function getDataPointsForRange(data: any[], timeRange: TimeRange, getValue: (item: any) => number): { date: string; value: number }[] {
  const { start, end, interval } = timeRange;
  const points: { [key: string]: number } = {};

  // Initialize time points based on interval
  let current = new Date(start);
  while (isBefore(current, end)) {
    const key = format(current, interval === 'hour' ? 'HH:mm' : interval === 'month' ? 'MMM yyyy' : 'MM/dd');
    points[key] = 0;
    
    switch (interval) {
      case 'hour':
        current = new Date(current.getTime() + 5 * 60000); // 5-minute intervals
        break;
      case 'day':
        current = new Date(current.getTime() + 24 * 60 * 60000);
        break;
      case 'month':
        current = new Date(current.setMonth(current.getMonth() + 1));
        break;
      default:
        current = new Date(current.setDate(current.getDate() + 1));
    }
  }

  // Aggregate data
  data.forEach(item => {
    if (isAfter(item.createdAt, start) && isBefore(item.createdAt, end)) {
      const key = format(
        item.createdAt,
        interval === 'hour' ? 'HH:mm' : interval === 'month' ? 'MMM yyyy' : 'MM/dd'
      );
      points[key] = (points[key] || 0) + getValue(item);
    }
  });

  return Object.entries(points).map(([date, value]) => ({ date, value }));
}

export async function getUserStatistics(userId: string) {
  // Fetch posts
  const postsRef = collection(db, 'posts');
  const postsQuery = query(
    postsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const postsSnapshot = await getDocs(postsQuery);
  const posts = postsSnapshot.docs.map(doc => {
    const data = doc.data();
    const stats = data.stats || {};
    return {
      id: doc.id,
      ...data,
      likes: (data.likes || []).length,
      comments: (data.comments || []).length,
      shares: stats.shares || 0,
      views: stats.views || 0,
      createdAt: data.createdAt?.toDate() || new Date()
    };
  }) as PostStats[];

  // Fetch videos
  const videosRef = collection(db, 'videos');
  const videosQuery = query(
    videosRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const videosSnapshot = await getDocs(videosQuery);
  const videos = videosSnapshot.docs.map(doc => {
    const data = doc.data();
    const stats = data.stats || {};
    return {
      id: doc.id,
      ...data,
      likes: (data.likes || []).length,
      comments: (data.comments || []).length,
      shares: stats.shares || 0,
      views: stats.views || 0,
      watchTime: stats.totalWatchTime || 0,
      completionRate: stats.completionRate || 0,
      createdAt: data.createdAt?.toDate() || new Date()
    };
  }) as VideoStats[];

  // Calculate video views over time (last 30 days)
  const viewsOverTime = Array.from({ length: 30 }, (_, i) => {
    const date = format(subDays(new Date(), i), 'MM/dd');
    const views = videos.reduce((total, video) => {
      const videoDate = format(video.createdAt, 'MM/dd');
      return total + (videoDate === date ? video.views : 0);
    }, 0);
    return { date, views };
  }).reverse();

  // Calculate total stats
  const totalPostViews = posts.reduce((sum, post) => sum + post.views, 0);
  const totalVideoViews = videos.reduce((sum, video) => sum + video.views, 0);
  const totalPostLikes = posts.reduce((sum, post) => sum + post.likes, 0);
  const totalVideoLikes = videos.reduce((sum, video) => sum + video.likes, 0);
  const totalPostComments = posts.reduce((sum, post) => sum + post.comments, 0);
  const totalVideoComments = videos.reduce((sum, video) => sum + video.comments, 0);
  const totalPostShares = posts.reduce((sum, post) => sum + post.shares, 0);
  const totalVideoShares = videos.reduce((sum, video) => sum + video.shares, 0);

  // Calculate video-specific metrics
  const totalWatchTime = videos.reduce((sum, video) => sum + video.watchTime, 0);
  const averageWatchTime = videos.length > 0 ? totalWatchTime / videos.length : 0;
  const averageCompletionRate = videos.length > 0
    ? videos.reduce((sum, video) => sum + video.completionRate, 0) / videos.length
    : 0;

  // Sort posts and videos by engagement
  const topPosts = [...posts].sort((a, b) => 
    (b.views + b.likes * 2 + b.comments * 3) - (a.views + a.likes * 2 + a.comments * 3)
  ).slice(0, 10);

  const topVideos = [...videos].sort((a, b) =>
    (b.views + b.likes * 2 + b.comments * 3 + b.watchTime / 60) - 
    (a.views + a.likes * 2 + a.comments * 3 + a.watchTime / 60)
  ).slice(0, 10);

  // Get demographic stats
  const demographics = await getDemographicStats();

  return {
    posts: {
      total: posts.length,
      views: totalPostViews,
      likes: totalPostLikes,
      comments: totalPostComments,
      shares: totalPostShares,
      topPosts
    },
    videos: {
      total: videos.length,
      views: totalVideoViews,
      likes: totalVideoLikes,
      comments: totalVideoComments,
      shares: totalVideoShares,
      averageWatchTime,
      completionRate: averageCompletionRate,
      viewsOverTime,
      topVideos
    },
    demographics
  };
}

export async function getItemStats(itemId: string, itemType: 'post' | 'video', period: string) {
  const timeRange = getTimeRange(period);
  const collectionName = itemType === 'post' ? 'posts' : 'videos';
  const docRef = doc(db, collectionName, itemId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  const stats = data.stats || {};
  
  // Get historical data (assuming you store it in a subcollection)
  const historyRef = collection(docRef, 'history');
  const historySnap = await getDocs(historyRef);
  const historyData = historySnap.docs.map(doc => ({
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  }));

  return {
    views: getDataPointsForRange(historyData, timeRange, item => item.views || 0),
    likes: getDataPointsForRange(historyData, timeRange, item => (item.likes || []).length),
    comments: getDataPointsForRange(historyData, timeRange, item => (item.comments || []).length),
    shares: getDataPointsForRange(historyData, timeRange, item => item.shares || 0),
    ...(itemType === 'video' && {
      watchTime: getDataPointsForRange(historyData, timeRange, item => item.watchTime || 0),
      completionRate: getDataPointsForRange(historyData, timeRange, item => item.completionRate || 0)
    })
  };
}
