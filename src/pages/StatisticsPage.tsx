import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getUserStatistics, getItemStats } from '../utils/statistics';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/Accordion';
import { Card } from '../components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Award, Play, Clock, Calendar, Users, Activity, Filter, Trophy, Medal, PlayCircle, PieChart } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ShareService } from '../services/ShareService';

interface Statistics {
  posts: {
    total: number;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    topPosts: Array<{
      id: string;
      imageUrl?: string;
      caption: string;
      likes: number;
      views: number;
      createdAt: Date;
    }>;
  };
  videos: {
    total: number;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    averageWatchTime: number;
    completionRate: number;
    viewsOverTime: Array<{
      date: string;
      views: number;
    }>;
    topVideos: Array<{
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
    }>;
  };
  demographics: {
    ageGroups: Array<{ name: string; value: number }>;
    platforms: Array<{ name: string; value: number }>;
    locations: Array<{ name: string; value: number }>;
  };
}

interface VideoStats {
  views: number;
  likes: number;
  comments: number;
  averageWatchTime: number;
  completionRate: number;
}

interface SharedItem {
  id: string;
  type: 'post' | 'video';
  title: string;
  thumbnail: string;
  createdAt: Date;
  originalAuthor: string;
}

interface ShareStats {
  totalShares: number;
  total24HShares: number;
  recentShares: SharedItem[];
  topSharedItems: SharedItem[];
}

const StatisticsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Statistics>({
    posts: {
      total: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      topPosts: []
    },
    videos: {
      total: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      averageWatchTime: 0,
      completionRate: 0,
      viewsOverTime: [],
      topVideos: []
    },
    demographics: {
      ageGroups: [],
      platforms: [],
      locations: []
    }
  });
  const [videoStats, setVideoStats] = useState<{ [key: string]: VideoStats }>({});
  const [postStats, setPostStats] = useState<{ [key: string]: any }>({});
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('views');
  const [timeRange, setTimeRange] = useState('30d');
  const [itemStats, setItemStats] = useState<any>(null);
  const [totalStats, setTotalStats] = useState({
    totalVideoViews: 0,
    totalPostViews: 0,
    totalPosts: 0,
    totalComments: 0,
    averageCompletionRate: 0
  });
  const [shareStats, setShareStats] = useState<ShareStats>({
    totalShares: 0,
    total24HShares: 0,
    recentShares: [],
    topSharedItems: []
  });

  // Stato per le statistiche demografiche
  const [demographicStats, setDemographicStats] = useState({
    ageGroups: [] as { name: string; value: number }[],
    platforms: [] as { name: string; value: number }[],
    locations: [] as { name: string; value: number }[]
  });

  // Funzione per filtrare i dati in base al periodo
  const filterDataByTimeRange = (data: any[], dateField: string = 'createdAt') => {
    const startDate = getStartDate(timeRange);
    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= startDate;
    });
  };

  // Funzione per ottenere la data di inizio del periodo
  const getStartDate = (range: string) => {
    const now = new Date();
    const millisecondsInHour = 60 * 60 * 1000;
    const millisecondsInDay = 24 * millisecondsInHour;

    switch (range) {
      case '1h':
        return new Date(now.getTime() - millisecondsInHour);
      case '1d':
        return new Date(now.getTime() - millisecondsInDay);
      case '7d':
        return new Date(now.getTime() - (7 * millisecondsInDay));
      case '30d':
        return new Date(now.getTime() - (30 * millisecondsInDay));
      case '1y':
        return new Date(now.getTime() - (365 * millisecondsInDay));
      default:
        return new Date(0);
    }
  };

  // Fetch initial statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }

      try {
        // Get posts with pagination
        const postsRef = collection(db, 'posts');
        const postsQuery = query(
          postsRef, 
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const postsSnapshot = await getDocs(postsQuery);
        
        // Get videos with pagination
        const videosRef = collection(db, 'videos');
        const videosQuery = query(
          videosRef, 
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const videosSnapshot = await getDocs(videosQuery);
        
        // Calculate total comments
        let totalPostComments = 0;
        let totalPostViews = 0;
        postsSnapshot.forEach(doc => {
          const post = doc.data();
          totalPostComments += post.comments?.length || 0;
          totalPostViews += post.views || 0;
        });
        
        let totalVideoComments = 0;
        let totalVideoViews = 0;
        let totalWatchTime = 0;
        let totalCompletions = 0;
        videosSnapshot.forEach(doc => {
          const video = doc.data();
          totalVideoComments += video.comments?.length || 0;
          totalVideoViews += video.views || 0;
          totalWatchTime += video.totalWatchTime || 0;
          totalCompletions += video.completions || 0;
        });
        
        const totalComments = totalPostComments + totalVideoComments;
        console.log('Comments calculation:', { totalPostComments, totalVideoComments, totalComments });

        const totalViews = { totalVideoViews, totalPostViews };
        console.log('Views calculation:', totalViews);

        const averageWatchTime = videosSnapshot.size > 0 ? totalWatchTime / videosSnapshot.size : 0;
        const completionRate = totalVideoViews > 0 ? (totalCompletions / totalVideoViews) * 100 : 0;

        setStats(prevStats => ({
          ...prevStats,
          posts: {
            ...prevStats.posts,
            total: postsSnapshot.size,
            comments: totalPostComments,
            views: totalPostViews
          },
          videos: {
            ...prevStats.videos,
            total: videosSnapshot.size,
            comments: totalVideoComments,
            views: totalVideoViews,
            averageWatchTime,
            completionRate
          }
        }));

        setTotalStats({
          totalVideoViews,
          totalPostViews,
          totalPosts: postsSnapshot.size,
          totalComments,
          averageCompletionRate: completionRate
        });

        const userStats = await getUserStatistics(currentUser.uid);
        if (userStats) {
          setStats(userStats);
          
          // Initialize video and post stats
          const initialVideoStats: { [key: string]: VideoStats } = {};
          const initialPostStats: { [key: string]: any } = {};
          
          userStats.videos.topVideos.forEach(video => {
            initialVideoStats[video.id] = {
              views: 0,
              likes: 0,
              comments: 0,
              averageWatchTime: 0,
              completionRate: 0
            };
          });
          
          userStats.posts.topPosts.forEach(post => {
            initialPostStats[post.id] = {
              views: 0,
              likes: 0,
              comments: 0
            };
          });
          
          setVideoStats(initialVideoStats);
          setPostStats(initialPostStats);
          
          // Start fetching detailed stats
          calculateTotalViews(currentUser.uid);
          
          // Calculate total posts using stats
          const totalPosts = postsSnapshot.size;
          
          setTotalStats(prev => ({
            ...prev,
            totalPosts,
            totalComments
          }));
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentUser?.uid]);

  // Carica le statistiche demografiche reali
  useEffect(() => {
    if (!currentUser) return;

    const fetchDemographicStats = async () => {
      try {
        // Riferimento alla collezione delle statistiche demografiche
        const statsRef = collection(db, 'statistics');
        
        // Query per ottenere i dati demografici più recenti
        const demographicsQuery = query(
          collection(db, 'userDemographics'),
          where('timestamp', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Ultimi 30 giorni
        );

        const unsubscribe = onSnapshot(demographicsQuery, (snapshot) => {
          const ageGroups: { [key: string]: number } = {};
          const platforms: { [key: string]: number } = {};
          const locations: { [key: string]: number } = {};

          snapshot.forEach((doc) => {
            const data = doc.data();
            
            // Aggiorna statistiche età
            if (data.age) {
              const ageGroup = getAgeGroup(data.age);
              ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1;
            }

            // Aggiorna statistiche piattaforme
            if (data.platform) {
              platforms[data.platform] = (platforms[data.platform] || 0) + 1;
            }

            // Aggiorna statistiche località
            if (data.location?.country) {
              locations[data.location.country] = (locations[data.location.country] || 0) + 1;
            }
          });

          // Converti i dati nel formato richiesto dai grafici
          const formatData = (data: { [key: string]: number }) =>
            Object.entries(data)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value);

          setDemographicStats({
            ageGroups: formatData(ageGroups),
            platforms: formatData(platforms),
            locations: formatData(locations)
          });
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Errore nel caricamento delle statistiche demografiche:', error);
      }
    };

    fetchDemographicStats();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    // Listener per i post
    const unsubscribePosts = onSnapshot(
      query(collection(db, 'posts'), where('userId', '==', currentUser.uid)),
      (snapshot) => {
        const postViews = snapshot.docs.map(doc => ({
          id: doc.id,
          views: doc.data().views || 0,
          likes: doc.data().likes?.length || 0,
          comments: doc.data().comments?.length || 0
        }));
        
        const totalViews = postViews.reduce((acc, post) => acc + post.views, 0);
        console.log('Total post views calculated:', totalViews);
        console.log('Individual post views:', postViews);
        
        setPostStats(postViews.reduce((acc, post) => ({
          ...acc,
          [post.id]: {
            views: post.views,
            likes: post.likes,
            comments: post.comments
          }
        }), {}));
        
        setTotalStats(prev => ({
          ...prev,
          totalPostViews: totalViews,
          totalPosts: postViews.length,
          totalComments: postViews.reduce((acc, post) => acc + post.comments, 0)
        }));
      }
    );

    // Listener per i video
    const unsubscribeVideos = onSnapshot(
      query(collection(db, 'videos'), where('userId', '==', currentUser.uid)),
      (snapshot) => {
        const videoViews = snapshot.docs.map(doc => ({
          id: doc.id,
          views: doc.data().views || 0,
          likes: doc.data().likes?.length || 0,
          comments: doc.data().comments?.length || 0,
          watchTime: doc.data().totalWatchTime || 0,
          completions: doc.data().completions || 0
        }));
        
        const totalViews = videoViews.reduce((acc, video) => acc + video.views, 0);
        const totalWatchTime = videoViews.reduce((acc, video) => acc + video.watchTime, 0);
        const totalCompletions = videoViews.reduce((acc, video) => acc + video.completions, 0);
        
        setVideoStats(videoViews.reduce((acc, video) => ({
          ...acc,
          [video.id]: {
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            averageWatchTime: video.watchTime / (video.views || 1),
            completionRate: (video.completions / (video.views || 1)) * 100
          }
        }), {}));
        
        setTotalStats(prev => ({
          ...prev,
          totalVideoViews: totalViews,
          averageWatchTime: videoViews.size > 0 ? totalWatchTime / videoViews.size : 0,
          averageCompletionRate: videoViews.size > 0 ? (totalCompletions / totalViews) * 100 : 0
        }));
      }
    );

    return () => {
      unsubscribePosts();
      unsubscribeVideos();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchShareStats = async () => {
      if (!currentUser) return;
      
      try {
        // Recupera i video dell'utente
        const videosRef = collection(db, 'videos');
        const videosQuery = query(
          videosRef,
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const videosSnapshot = await getDocs(videosQuery);

        // Recupera i post dell'utente
        const postsRef = collection(db, 'posts');
        const postsQuery = query(
          postsRef,
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const postsSnapshot = await getDocs(postsQuery);

        let totalShares = 0;
        let total24HShares = 0;
        const allSharedItems = [];
        const recentShares = [];
        const now = new Date();

        // Processa le condivisioni dei video
        for (const videoDoc of videosSnapshot.docs) {
          const videoData = videoDoc.data();
          
          // Conta le condivisioni totali dall'array shares nel documento principale
          const mainShares = videoData.shares?.length || 0;
          totalShares += mainShares;

          // Aggiungi il video alla lista dei contenuti condivisi
          allSharedItems.push({
            id: videoDoc.id,
            type: 'video',
            title: videoData.title || 'Video senza titolo',
            thumbnail: videoData.thumbnailUrl,
            userId: videoData.userId,
            shareCount: mainShares,
            createdAt: videoData.createdAt?.toDate() || new Date()
          });

          // Recupera le condivisioni dettagliate dalle stats
          const sharesRef = doc(db, 'videos', videoDoc.id, 'stats', 'shares');
          const sharesDoc = await getDoc(sharesRef);
          const sharesData = sharesDoc.data();

          if (sharesData?.shares) {
            // Filtra le condivisioni delle ultime 24 ore
            const recentVideoShares = Object.entries(sharesData.shares)
              .filter(([_, share]: [string, any]) => {
                const shareTime = share.timestamp?.toDate();
                return shareTime && (now.getTime() - shareTime.getTime() < 24 * 60 * 60 * 1000);
              })
              .map(([userId, share]: [string, any]) => ({
                id: videoDoc.id,
                type: 'video',
                title: videoData.title || 'Video senza titolo',
                thumbnail: videoData.thumbnailUrl,
                userId: videoData.userId,
                sharedAt: share.timestamp.toDate(),
                sharedBy: userId
              }));

            total24HShares += recentVideoShares.length;
            recentShares.push(...recentVideoShares);
          }
        }

        // Processa le condivisioni dei post
        for (const postDoc of postsSnapshot.docs) {
          const postData = postDoc.data();
          
          // Conta le condivisioni totali dall'array shares nel documento principale
          const mainShares = postData.shares?.length || 0;
          totalShares += mainShares;

          // Aggiungi il post alla lista dei contenuti condivisi
          allSharedItems.push({
            id: postDoc.id,
            type: 'post',
            title: postData.caption || 'Post senza titolo',
            thumbnail: postData.imageUrl, // Modificato da mediaUrl a imageUrl
            userId: postData.userId,
            shareCount: mainShares,
            createdAt: postData.createdAt?.toDate() || new Date()
          });

          // Recupera le condivisioni dettagliate dalle stats
          const sharesRef = doc(db, 'posts', postDoc.id, 'stats', 'shares');
          const sharesDoc = await getDoc(sharesRef);
          const sharesData = sharesDoc.data();

          if (sharesData?.shares) {
            // Filtra le condivisioni delle ultime 24 ore
            const recentPostShares = Object.entries(sharesData.shares)
              .filter(([_, share]: [string, any]) => {
                const shareTime = share.timestamp?.toDate();
                return shareTime && (now.getTime() - shareTime.getTime() < 24 * 60 * 60 * 1000);
              })
              .map(([userId, share]: [string, any]) => ({
                id: postDoc.id,
                type: 'post',
                title: postData.caption || 'Post senza titolo',
                thumbnail: postData.imageUrl, // Modificato da mediaUrl a imageUrl
                userId: postData.userId,
                sharedAt: share.timestamp.toDate(),
                sharedBy: userId
              }));

            total24HShares += recentPostShares.length;
            recentShares.push(...recentPostShares);
          }
        }

        // Ordina i contenuti per numero di condivisioni
        const topSharedItems = allSharedItems
          .sort((a, b) => b.shareCount - a.shareCount)
          .slice(0, 5);

        // Ordina le condivisioni recenti per data
        const sortedRecentShares = recentShares.sort((a, b) => 
          b.sharedAt.getTime() - a.sharedAt.getTime()
        );

        setShareStats({
          totalShares,
          total24HShares,
          recentShares: sortedRecentShares.slice(0, 5),
          topSharedItems
        });

        // Aggiorna anche le statistiche generali
        setStats(prevStats => ({
          ...prevStats,
          posts: {
            ...prevStats.posts,
            shares: totalShares
          },
          videos: {
            ...prevStats.videos,
            shares: totalShares
          }
        }));

      } catch (error) {
        console.error('Errore nel recupero delle statistiche di condivisione:', error);
      }
    };

    fetchShareStats();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const fetchTimeRangeStats = async () => {
      try {
        const startDate = getStartDate(timeRange);
        
        // Query per i video nel periodo selezionato
        const videosRef = collection(db, 'videos');
        const videosQuery = query(
          videosRef,
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const videosSnapshot = await getDocs(videosQuery);
        let periodVideoViews = 0;
        let totalWatchTime = 0;
        let completedViews = 0;
        let periodPostViews = 0;

        // Processa ogni video
        for (const doc of videosSnapshot.docs) {
          const data = doc.data();
          const videoCreatedAt = data.createdAt?.toDate();
          
          // Se il video è nel periodo selezionato
          if (videoCreatedAt && videoCreatedAt >= startDate) {
            try {
              // Ottieni le statistiche delle visualizzazioni
              const viewsRef = collection(db, 'videos', doc.id, 'stats');
              const viewsDoc = await getDocs(viewsRef);
              
              viewsDoc.forEach(statDoc => {
                const viewData = statDoc.data();
                if (viewData && viewData.timestamp) {
                  const viewDate = viewData.timestamp.toDate();
                  if (viewDate >= startDate) {
                    periodVideoViews++;
                    totalWatchTime += viewData.watchTime || 0;
                    if (viewData.completed) {
                      completedViews++;
                    }
                  }
                }
              });
            } catch (error) {
              console.error(`Error fetching stats for video ${doc.id}:`, error);
            }
          }
        }

        // Query per tutti i post dell'utente
        const postsRef = collection(db, 'posts');
        const postsQuery = query(
          postsRef,
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        
        const postsSnapshot = await getDocs(postsQuery);
        
        // Processa ogni post
        for (const doc of postsSnapshot.docs) {
          const data = doc.data();
          const postCreatedAt = data.createdAt?.toDate();
          
          // Se il post è nel periodo selezionato
          if (postCreatedAt && postCreatedAt >= startDate) {
            try {
              // Ottieni le statistiche delle visualizzazioni
              const viewsRef = doc(db, 'posts', doc.id, 'stats', 'views');
              const viewsDoc = await getDoc(viewsRef);
              const viewsData = viewsDoc.data();
              
              viewsDoc.forEach(statDoc => {
                const viewData = statDoc.data();
                if (viewData && viewData.timestamp) {
                  const viewDate = viewData.timestamp.toDate();
                  if (viewDate >= startDate) {
                    periodPostViews++;
                  }
                }
              });
            } catch (error) {
              console.error(`Error fetching stats for post ${doc.id}:`, error);
            }
          }
        }

        // Calcola le medie
        const avgWatchTime = periodVideoViews > 0 ? totalWatchTime / periodVideoViews : 0;
        const completionRate = periodVideoViews > 0 ? (completedViews / periodVideoViews) * 100 : 0;

        console.log('Statistiche periodo:', {
          timeRange,
          startDate,
          periodVideoViews,
          periodPostViews,
          avgWatchTime,
          completionRate
        });

        // Aggiorna le statistiche solo se abbiamo dati validi
        if (periodVideoViews > 0 || periodPostViews > 0) {
          setTotalStats(prev => ({
            ...prev,
            totalVideoViews: periodVideoViews || prev.totalVideoViews,
            totalPostViews: periodPostViews || prev.totalPostViews,
            totalViews: (periodVideoViews + periodPostViews) || prev.totalViews,
            averageWatchTime: avgWatchTime || prev.averageWatchTime,
            averageCompletionRate: completionRate || prev.averageCompletionRate
          }));
        }

      } catch (error) {
        console.error('Error fetching time range stats:', error);
      }
    };

    fetchTimeRangeStats();
  }, [currentUser?.uid, timeRange]);

  const calculateTotalStats = (videoStats: { [key: string]: VideoStats }) => {
    const totalVideoViews = Object.values(videoStats).reduce((sum, stat) => sum + stat.views, 0);
    const totalWatchTime = Object.values(videoStats).reduce((sum, stat) => sum + stat.averageWatchTime, 0);
    const totalCompletionRate = Object.values(videoStats).reduce((sum, stat) => sum + stat.completionRate, 0);
    const videoCount = Object.keys(videoStats).length;

    setTotalStats(prev => ({
      ...prev,
      totalVideoViews,
      averageWatchTime: videoCount > 0 ? totalWatchTime / videoCount : 0,
      averageCompletionRate: videoCount > 0 ? totalCompletionRate / videoCount : 0
    }));
  };

  const getVideoStats = async (videoId: string) => {
    try {
      const viewsRef = doc(db, 'videos', videoId, 'stats', 'views');
      const viewsDoc = await getDoc(viewsRef);
      const viewsData = viewsDoc.data()?.views || {};
      
      // Prendi il video doc per ottenere la durata totale
      const videoDoc = await getDoc(doc(db, 'videos', videoId));
      const videoDuration = videoDoc.data()?.duration || 0;
      
      const now = new Date();
      const recentViews = Object.values(viewsData).filter((view: any) => {
        return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
      });

      // Calcola il tempo medio di visualizzazione
      const totalWatchTime = recentViews.reduce((sum: number, view: any) => {
        return sum + (view.watchTime || 0);
      }, 0);
      const averageWatchTime = recentViews.length > 0 ? totalWatchTime / recentViews.length : 0;

      // Calcola il tasso di completamento (percentuale)
      const completionRate = videoDuration > 0 ? (averageWatchTime / videoDuration) * 100 : 0;

      return {
        views: recentViews.length,
        watchTime: averageWatchTime,
        completionRate: Math.min(completionRate, 100)
      };
    } catch (error) {
      console.error('Error getting video stats:', error);
      return { views: 0, watchTime: 0, completionRate: 0 };
    }
  };

  const calculateTotalViews = async (userId: string) => {
    try {
      const videosRef = collection(db, 'videos');
      const videosQuery = query(videosRef, where('userId', '==', userId));
      const videosSnapshot = await getDocs(videosQuery);
      
      let totalVideoViews = 0;
      let totalWatchTime = 0;
      let totalCompletionRate = 0;
      const videoCount = videosSnapshot.docs.length;

      // Calcola le statistiche per ogni video
      const updatedVideoStats: { [key: string]: VideoStats } = {};
      
      for (const videoDoc of videosSnapshot.docs) {
        const videoData = videoDoc.data();
        const stats = await getVideoStats(videoDoc.id);
        
        totalVideoViews += stats.views;
        totalWatchTime += stats.watchTime;
        totalCompletionRate += stats.completionRate;

        updatedVideoStats[videoDoc.id] = {
          views: stats.views,
          likes: videoData.likes?.length || 0,
          comments: videoData.comments?.length || 0,
          averageWatchTime: stats.watchTime,
          completionRate: stats.completionRate
        };
      }

      // Calcola le medie generali
      const averageCompletionRate = videoCount > 0 ? totalCompletionRate / videoCount : 0;
      const averageWatchTime = videoCount > 0 ? totalWatchTime / videoCount : 0;

      setTotalStats(prev => ({
        ...prev,
        totalVideoViews,
        averageWatchTime,
        averageCompletionRate
      }));

      setVideoStats(updatedVideoStats);

      // Calcola le statistiche dei post (invariato)
      const postsRef = collection(db, 'posts');
      const postsQuery = query(postsRef, where('userId', '==', userId));
      const postsSnapshot = await getDocs(postsQuery);
      
      const postViewsPromises = postsSnapshot.docs.map(async (postDoc) => {
        try {
          const viewsRef = doc(db, 'posts', postDoc.id, 'stats', 'views');
          const viewsDoc = await getDoc(viewsRef);
          const viewsData = viewsDoc.data();
          
          if (viewsData?.total) {
            return viewsData.total;
          } else if (viewsData?.views) {
            const now = new Date();
            const uniqueViews = Object.values(viewsData.views).filter((view: any) => {
              return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
            }).length;
            return uniqueViews;
          }
          
          return 0;
        } catch (error) {
          console.error(`Error getting views for post ${postDoc.id}:`, error);
          return 0;
        }
      });
      
      const postViews = await Promise.all(postViewsPromises);
      const totalPostViews = postViews.reduce((sum, views) => sum + views, 0);

      console.log('Views calculation:', { totalVideoViews, totalPostViews });

      setTotalStats(prev => ({
        ...prev,
        totalPostViews
      }));

      // Update individual post stats
      const updatedPostStats: { [key: string]: any } = {};
      for (let i = 0; i < postsSnapshot.docs.length; i++) {
        const postDoc = postsSnapshot.docs[i];
        const postData = postDoc.data();
        updatedPostStats[postDoc.id] = {
          views: postViews[i],
          likes: postData.likes?.length || 0,
          comments: postData.comments?.length || 0
        };
      }
      setPostStats(updatedPostStats);

    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const getVideoViews = async (videoId: string) => {
    try {
      const viewsRef = doc(db, 'videos', videoId, 'stats', 'views');
      const viewsDoc = await getDoc(viewsRef);
      const viewsData = viewsDoc.data()?.views || {};
      
      // Count unique views in last 24 hours
      const now = new Date();
      const recentViews = Object.values(viewsData).filter((view: any) => {
        return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
      });
      
      return recentViews.length;
    } catch (error) {
      console.error('Error getting video views:', error);
      return 0;
    }
  };

  const getPostViews = async (postId: string) => {
    try {
      const viewsRef = doc(db, 'posts', postId, 'stats', 'views');
      const viewsDoc = await getDoc(viewsRef);
      const viewsData = viewsDoc.data()?.views || {};
      
      // Count unique views in last 24 hours
      const now = new Date();
      const recentViews = Object.values(viewsData).filter((view: any) => {
        return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
      });
      
      return recentViews.length;
    } catch (error) {
      console.error('Error getting post views:', error);
      return 0;
    }
  };

  const calculateTotalComments = () => {
    let totalComments = 0;

    // Add post comments
    if (stats?.posts?.topPosts) {
      totalComments += stats.posts.topPosts.reduce((sum, post) => {
        return sum + (post.comments?.length || 0);
      }, 0);
    }

    // Add video comments
    if (stats?.videos?.topVideos) {
      totalComments += stats.videos.topVideos.reduce((sum, video) => {
        return sum + (video.comments?.length || 0);
      }, 0);
    }

    return totalComments;
  };

  const getItemStats = async (itemType: 'videos' | 'posts', itemId: string) => {
    try {
      const itemRef = doc(db, itemType, itemId);
      const itemDoc = await getDoc(itemRef);
      const itemData = itemDoc.data();
      
      if (!itemData) return null;

      // Get views
      let views = 0;
      if (itemType === 'videos') {
        const viewsRef = doc(db, itemType, itemId, 'stats', 'views');
        const viewsDoc = await getDoc(viewsRef);
        const viewsData = viewsDoc.data();
        
        if (viewsData?.views) {
          const now = new Date();
          views = Object.values(viewsData.views).filter((view: any) => {
            return view.timestamp && (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
          }).length;
        }
      } else {
        // For posts, use getPostViews to ensure consistency
        views = await getPostViews(itemId);
      }

      // Get other stats
      const likes = itemData.likes?.length || 0;
      const comments = itemData.comments?.length || 0;

      // Generate time series data based on actual data
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const timeSeriesData = [];

      // Get historical data if available
      const historyRef = doc(db, itemType, itemId, 'stats', 'history');
      const historyDoc = await getDoc(historyRef);
      const historyData = historyDoc.data()?.daily || {};

      for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayData = historyData[dateStr] || {
          views: Math.ceil(views / 30), // Fallback to even distribution
          likes: Math.ceil(likes / 30),
          comments: Math.ceil(comments / 30)
        };
        
        timeSeriesData.push({
          date: dateStr,
          views: dayData.views,
          likes: dayData.likes,
          comments: dayData.comments
        });
      }

      return {
        views,
        likes,
        comments,
        imageUrl: itemData.imageUrl, // Add image URL
        caption: itemData.caption,
        viewsOverTime: timeSeriesData,
        likesOverTime: timeSeriesData,
        commentsOverTime: timeSeriesData
      };
    } catch (error) {
      console.error('Error getting item stats:', error);
      return null;
    }
  };

  // Load item stats when selection changes
  useEffect(() => {
    const loadItemStats = async () => {
      try {
        if (selectedVideo) {
          const stats = await getItemStats('videos', selectedVideo);
          if (stats) {
            setVideoStats(prev => ({
              ...prev,
              [selectedVideo]: stats
            }));
          }
        } else if (selectedPost) {
          const stats = await getItemStats('posts', selectedPost);
          if (stats) {
            setPostStats(prev => ({
              ...prev,
              [selectedPost]: stats
            }));
          }
        }
      } catch (error) {
        console.error('Error loading item stats:', error);
      }
    };

    loadItemStats();
  }, [selectedVideo, selectedPost]);

  // Remove any duplicate effects that might cause resets
  useEffect(() => {
    const updateAllVideoStats = async () => {
      if (!stats?.videos.topVideos) return;

      const updatedStats: { [key: string]: VideoStats } = {};
      
      for (const video of stats.videos.topVideos) {
        const views = await getVideoViews(video.id);
        const videoRef = doc(db, 'videos', video.id);
        const videoDoc = await getDoc(videoRef);
        const videoData = videoDoc.data();
        
        updatedStats[video.id] = {
          views,
          likes: videoData?.likes?.length || 0,
          comments: videoData?.comments?.length || 0,
          averageWatchTime: 0,
          completionRate: 0
        };
      }
      
      setVideoStats(updatedStats);
    };

    updateAllVideoStats();
  }, [stats?.videos.topVideos]);

  useEffect(() => {
    const fetchItemStats = async () => {
      if (selectedVideo) {
        const stats = await getItemStats(selectedVideo, 'video', timeRange);
        setItemStats(stats);
      }
    };
    fetchItemStats();
  }, [selectedVideo, timeRange]);

  useEffect(() => {
    const fetchItemStats = async () => {
      if (selectedPost) {
        const stats = await getItemStats(selectedPost, 'post', timeRange);
        setItemStats(stats);
      }
    };
    fetchItemStats();
  }, [selectedPost, timeRange]);

  useEffect(() => {
    // Update total comments whenever video or post stats change
    setTotalStats(prev => ({
      ...prev,
      totalComments: calculateTotalComments()
    }));
  }, [videoStats, postStats]);

  const handleVideoSelect = (videoId: string) => {
    setSelectedVideo(videoId);
    setSelectedPost(null); // Deseleziona il post quando si seleziona un video
  };

  const handlePostSelect = (postId: string) => {
    setSelectedPost(postId);
    setSelectedVideo(null); // Deseleziona il video quando si seleziona un post
  };

  const getTotalVideoViews = async () => {
    try {
      let totalViews = 0;
      
      if (!stats?.videos.topVideos) return 0;
      
      // Get all video views in parallel
      const viewsPromises = stats.videos.topVideos.map(async (video) => {
        try {
          const viewsRef = doc(db, 'videos', video.id, 'stats', 'views');
          const viewsDoc = await getDoc(viewsRef);
          const viewsData = viewsDoc.data();
          
          if (viewsData?.views) {
            // Count unique views in the last 24 hours
            const now = new Date();
            const uniqueViews = Object.values(viewsData.views).filter((view: any) => {
              return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
            }).length;
            
            return uniqueViews;
          }
          return 0;
        } catch (error) {
          console.error(`Error getting views for video ${video.id}:`, error);
          return 0;
        }
      });
      
      const allViews = await Promise.all(viewsPromises);
      totalViews = allViews.reduce((sum, views) => sum + views, 0);
      
      return totalViews;
    } catch (error) {
      console.error('Error calculating total video views:', error);
      return 0;
    }
  };

  const getTotalPostViews = async () => {
    try {
      let totalViews = 0;
      
      if (!stats?.posts.topPosts) return 0;
      
      // Get all post views in parallel
      const viewsPromises = stats.posts.topPosts.map(async (post) => {
        try {
          const postRef = doc(db, 'posts', post.id);
          const postDoc = await getDoc(postRef);
          const postData = postDoc.data();
          
          // First check stats field
          if (postData?.stats?.views) {
            return postData.stats.views;
          }
          
          // Then check stats subcollection
          const statsRef = doc(db, 'posts', post.id, 'stats', 'views');
          const statsDoc = await getDoc(statsRef);
          const viewsData = statsDoc.data();
          
          if (viewsData?.total) {
            return viewsData.total;
          }
          
          // Count unique views in the last 24 hours
          if (viewsData?.views) {
            const now = new Date();
            const uniqueViews = Object.values(viewsData.views).filter((view: any) => {
              return (now.getTime() - view.timestamp.toDate().getTime()) < 24 * 60 * 60 * 1000;
            }).length;
            return uniqueViews;
          }
          
          return 0;
        } catch (error) {
          console.error(`Error getting views for post ${post.id}:`, error);
          return 0;
        }
      });
      
      const allViews = await Promise.all(viewsPromises);
      totalViews = allViews.reduce((sum, views) => sum + views, 0);
      
      return totalViews;
    } catch (error) {
      console.error('Error calculating total post views:', error);
      return 0;
    }
  };

  useEffect(() => {
    const updateStats = async () => {
      if (!currentUser || !stats) return;
      
      try {
        // Get total views
        const [totalVideoViews, totalPostViews] = await Promise.all([
          getTotalVideoViews(),
          getTotalPostViews()
        ]);
        
        // Update total stats
        setTotalStats(prev => ({
          ...prev,
          totalVideoViews,
          totalPostViews
        }));
        
        console.log('Stats updated:', { totalVideoViews, totalPostViews });
      } catch (error) {
        console.error('Error updating stats:', error);
      }
    };
    
    updateStats();
  }, [currentUser, stats]);

  const calculateTotalPostViews = async () => {
    try {
      let totalViews = 0;
      
      if (!stats?.posts.topPosts) return 0;
      
      // Get all post views in parallel
      const viewsPromises = stats.posts.topPosts.map(async (post) => {
        try {
          // Get views from post document
          const postRef = doc(db, 'posts', post.id);
          const postDoc = await getDoc(postRef);
          const postData = postDoc.data();
          
          if (postData?.views && typeof postData.views === 'number') {
            return postData.views;
          }
          
          // Try getting views from stats subcollection
          const statsRef = doc(db, 'posts', post.id, 'stats', 'views');
          const statsDoc = await getDoc(statsRef);
          const viewsData = statsDoc.data();
          
          if (viewsData?.total && typeof viewsData.total === 'number') {
            return viewsData.total;
          } else if (viewsData?.views && typeof viewsData.views === 'object') {
            return Object.keys(viewsData.views).length;
          }
          
          return 0;
        } catch (error) {
          console.error(`Error getting views for post ${post.id}:`, error);
          return 0;
        }
      });
      
      const allViews = await Promise.all(viewsPromises);
      totalViews = allViews.reduce((sum, views) => sum + views, 0);
      
      console.log('Total post views calculated:', totalViews);
      console.log('Individual post views:', allViews);
      
      return totalViews;
    } catch (error) {
      console.error('Error calculating total post views:', error);
      return 0;
    }
  };

  useEffect(() => {
    const updateTotalViews = async () => {
      if (!stats?.posts.topPosts) return;
      
      const totalPostViews = await calculateTotalPostViews();
      setTotalStats(prev => ({
        ...prev,
        totalPostViews
      }));
    };
    
    updateTotalViews();
  }, [stats?.posts.topPosts]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg theme-text">Effettua l'accesso per vedere le statistiche</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg theme-text">Nessuna statistica disponibile</p>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, subtitle = '' }: any) => (
    <Card className="p-4 rounded-xl bg-zinc-800/50 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );

  const ContentList = ({ items, type }: { items: any[]; type: 'post' | 'video' }) => (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={item.id} className="p-4 rounded-xl hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            {(item.imageUrl || item.thumbnailUrl) && (
              <img
                src={item.imageUrl || item.thumbnailUrl}
                alt={item.caption || item.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <Award className={`w-4 h-4 ${index < 3 ? 'text-yellow-500' : 'text-gray-400'}`} />
                <span className="font-medium text-sm">#{index + 1}</span>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-2">{item.caption || item.title}</p>
              <p className="text-xs text-zinc-400 opacity-70 mt-0.5">
                {format(new Date(item.createdAt), 'd MMM yyyy', { locale: it })}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-zinc-400 opacity-70 flex items-center">
                  <Eye className="w-3 h-3 mr-1" />
                  {item.views?.toLocaleString()}
                </span>
                <span className="text-xs text-zinc-400 opacity-70 flex items-center">
                  <Heart className="w-3 h-3 mr-1" />
                  {item.likes?.toLocaleString()}
                </span>
                {type === 'video' && (
                  <>
                    <span className="text-xs text-zinc-400 opacity-70 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {Math.round(item.watchTime / 60)} min
                    </span>
                    <span className="text-xs text-zinc-400 opacity-70 flex items-center">
                      <Play className="w-3 h-3 mr-1" />
                      {item.completionRate}%
                    </span>
                  </>
                )}
                <span className="text-xs text-zinc-400 opacity-70 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(item.createdAt), 'd MMM', { locale: it })}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const TimeRangeSelector = () => (
    <Select value={timeRange} onValueChange={setTimeRange}>
      <SelectTrigger className="w-[140px] h-8 rounded-full theme-bg-secondary border-none shadow-sm text-xs theme-text hover:theme-bg-hover transition-colors">
        <SelectValue placeholder="Seleziona periodo" />
      </SelectTrigger>
      <SelectContent className="rounded-xl theme-bg-secondary border-none shadow-md">
        <SelectItem value="1h" className="text-xs hover:theme-bg-hover theme-text">Ultima ora</SelectItem>
        <SelectItem value="1d" className="text-xs hover:theme-bg-hover theme-text">Ultimo giorno</SelectItem>
        <SelectItem value="7d" className="text-xs hover:theme-bg-hover theme-text">Ultima settimana</SelectItem>
        <SelectItem value="30d" className="text-xs hover:theme-bg-hover theme-text">Ultimo mese</SelectItem>
        <SelectItem value="1y" className="text-xs hover:theme-bg-hover theme-text">Ultimo anno</SelectItem>
        <SelectItem value="all" className="text-xs hover:theme-bg-hover theme-text">Tutto</SelectItem>
      </SelectContent>
    </Select>
  );

  const MetricSelector = () => (
    <Select value={selectedMetric} onValueChange={setSelectedMetric}>
      <SelectTrigger className="w-[140px] h-9 rounded-xl bg-zinc-800/50 border-none shadow-sm text-xs">
        <SelectValue placeholder="Seleziona metrica" />
      </SelectTrigger>
      <SelectContent className="rounded-xl bg-zinc-800 border-none shadow-md">
        <SelectItem value="views" className="text-xs hover:bg-zinc-700 text-white">
          <div className="flex items-center">
            <Eye className="w-3 h-3 mr-2" />
            Visualizzazioni
          </div>
        </SelectItem>
        <SelectItem value="likes" className="text-xs hover:bg-zinc-700 text-white">
          <div className="flex items-center">
            <Heart className="w-3 h-3 mr-2" />
            Mi piace
          </div>
        </SelectItem>
        <SelectItem value="comments" className="text-xs hover:bg-zinc-700 text-white">
          <div className="flex items-center">
            <MessageCircle className="w-3 h-3 mr-2" />
            Commenti
          </div>
        </SelectItem>
        {selectedVideo && (
          <>
            <SelectItem value="watchTime" className="text-xs hover:bg-zinc-700 text-white">
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-2" />
                Tempo
              </div>
            </SelectItem>
            <SelectItem value="completionRate" className="text-xs hover:bg-zinc-700 text-white">
              <div className="flex items-center">
                <Activity className="w-3 h-3 mr-2" />
                Completamento
              </div>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );

  const MetricsChart = () => {
    const itemStats = selectedVideo ? videoStats[selectedVideo] : selectedPost ? postStats[selectedPost] : null;

    if (!itemStats) {
      return (
        <div className="flex items-center justify-center h-[300px] text-sm theme-text opacity-70">
          Seleziona un elemento per visualizzare i dati
        </div>
      );
    }

    const prepareChartData = () => {
      const now = new Date();
      const getStartDate = () => {
        switch (timeRange) {
          case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
      };

      const startDate = getStartDate();
      const metrics = ['views', 'likes', 'comments'];
      const colors = {
        views: '#2196f3',
        likes: '#f44336',
        comments: '#4caf50'
      };

      if (selectedMetric === 'all') {
        return metrics.map((metric, index) => {
          const metricKey = `${metric}OverTime`;
          const data = itemStats[metricKey] || [];

          return {
            id: metric,
            color: colors[metric],
            data: data
              .filter(point => new Date(point.date) >= startDate)
              .map(point => ({
                date: format(new Date(point.date), 'dd/MM'),
                [metric]: point.value || 0
              }))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          };
        });
      } else {
        const metricKey = `${selectedMetric}OverTime`;
        const data = itemStats[metricKey] || [];

        return [{
          id: selectedMetric,
          color: colors[selectedMetric],
          data: data
            .filter(point => new Date(point.date) >= startDate)
            .map(point => ({
              date: format(new Date(point.date), 'dd/MM'),
              value: point.value || 0
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        }];
      }
    };

    const chartData = prepareChartData();
    const firstSeries = chartData[0];

    if (!firstSeries || !firstSeries.data || firstSeries.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px] text-sm theme-text opacity-70">
          Nessun dato disponibile per il periodo selezionato
        </div>
      );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-700">
            <p className="text-xs text-white mb-1">{label}</p>
            {payload.map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: {entry.value}
              </p>
            ))}
          </div>
        );
      }
      return null;
    };

    return (
      <div className="bg-zinc-800/50 p-4 rounded-xl">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={firstSeries.data}>
            <XAxis 
              dataKey="date" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#ffffff' }}
              stroke="#ffffff"
            />
            <YAxis 
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#ffffff' }}
              stroke="#ffffff"
            />
            <Tooltip 
              content={<CustomTooltip />}
              contentStyle={{ 
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px'
              }}
            />
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            {selectedMetric === 'all' ? (
              chartData.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.id}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  name={series.id}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={firstSeries.color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                name={selectedMetric}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderSharesSection = () => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold theme-text">
          Condivisioni
        </h3>
        <div className="text-sm theme-text-secondary">
          <span>{shareStats.total24HShares} nelle ultime 24 ore</span>
          <span className="mx-2">•</span>
          <span>{shareStats.totalShares} totali</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Contenuti più condivisi */}
        <div>
          <h4 className="text-sm font-medium theme-text mb-3">
            Contenuti più condivisi
          </h4>
          <div className="space-y-3">
            {shareStats.topSharedItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 p-3 rounded-lg theme-bg-secondary"
              >
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm theme-text truncate">
                    {item.title}
                  </h4>
                  <p className="text-xs theme-text-secondary mt-1">
                    {item.shareCount} condivisioni totali
                  </p>
                </div>
                <Share2 className="w-4 h-4 theme-text-secondary" />
              </div>
            ))}
          </div>
        </div>

        {/* Condivisioni recenti */}
        <div>
          <h4 className="text-sm font-medium theme-text mb-3">
            Condivisioni recenti
          </h4>
          <div className="space-y-3">
            {shareStats.recentShares.map((item) => (
              <div
                key={`${item.type}-${item.id}-${item.sharedAt}`}
                className="flex items-center gap-3 p-3 rounded-lg theme-bg-secondary"
              >
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm theme-text truncate">
                    {item.title}
                  </h4>
                  <p className="text-xs theme-text-secondary mt-1">
                    Condiviso {format(item.sharedAt, 'd MMM yyyy HH:mm', { locale: it })}
                  </p>
                </div>
                <Share2 className="w-4 h-4 theme-text-secondary" />
              </div>
            ))}
            
            {shareStats.recentShares.length === 0 && (
              <div className="text-center p-4 theme-text-secondary">
                Nessuna condivisione nelle ultime 24 ore
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 theme-bg-primary shadow-md">
        <div className="p-4 flex items-center">
          <div className="w-[140px] flex items-center space-x-3">
            <h1 className="text-xl font-bold theme-text">
              Statistiche
            </h1>
          </div>
          <div className="flex-1 flex justify-center">
            <TimeRangeSelector />
          </div>
          <div className="w-[140px] flex justify-end">
            {currentUser && (
              <img
                src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || 'User')}`}
                alt={currentUser?.displayName}
                className="w-8 h-8 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/profile')}
              />
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-[72px] pb-24 md:pb-6">
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          {/* Total Views Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-700/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-zinc-200">
                    Visualizzazioni Video {timeRange !== 'all' ? `(ultim${
                      timeRange === '1h' ? 'a ora' :
                      timeRange === '1d' ? 'o giorno' :
                      timeRange === '7d' ? 'a settimana' :
                      timeRange === '30d' ? 'o mese' : 'o anno'
                    })` : '(totali)'}
                  </span>
                </div>
                <span className="text-2xl font-bold text-white">{totalStats.totalVideoViews}</span>
              </div>
            </div>

            <div className="stat-card p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-700/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-zinc-200">
                    Visualizzazioni Post {timeRange !== 'all' ? `(ultim${
                      timeRange === '1h' ? 'a ora' :
                      timeRange === '1d' ? 'o giorno' :
                      timeRange === '7d' ? 'a settimana' :
                      timeRange === '30d' ? 'o mese' : 'o anno'
                    })` : '(totali)'}
                  </span>
                </div>
                <span className="text-2xl font-bold text-white">{totalStats.totalPostViews}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Mi Piace Totali"
              value={stats.posts.likes + stats.videos.likes}
              icon={Heart}
              color="bg-red-500"
            />
            <StatCard
              title="Commenti Totali"
              value={((stats?.posts.comments || 0) + (stats?.videos.comments || 0))}
              icon={MessageCircle}
              color="bg-green-500"
            />
            <StatCard
              title="Post Totali"
              value={stats.posts.total}
              icon={Activity}
              color="bg-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Tempo medio di visualizzazione"
              value={Math.round(totalStats.averageWatchTime / 60)} // Converti da secondi a minuti
              subtitle="minuti per video"
              icon={Clock}
              color="bg-indigo-500"
            />
            <StatCard
              title="Tasso di completamento"
              value={Math.round(totalStats.averageCompletionRate)}
              subtitle="percentuale media"
              icon={Play}
              color="bg-emerald-500"
            />
            <StatCard
              title="Video Totali"
              value={stats.videos.total}
              subtitle="contenuti caricati"
              icon={Play}
              color="bg-amber-500"
            />
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="video-analytics" className="bg-zinc-800/50 rounded-xl border-none">
              <AccordionTrigger className="px-4 py-2 hover:bg-zinc-700/50 transition-colors rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="bg-primary/20 p-2 rounded-xl group-hover:bg-primary/30 transition-colors">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">Analisi Video</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-zinc-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <MetricSelector />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-[140px] h-8 rounded-full bg-zinc-700/50 border-none shadow-sm text-xs text-zinc-200 hover:bg-zinc-600/50 transition-colors">
                        <SelectValue placeholder="Seleziona periodo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-zinc-800 border-none shadow-md">
                        <SelectItem value="1h" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultima ora</SelectItem>
                        <SelectItem value="1d" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultimo giorno</SelectItem>
                        <SelectItem value="7d" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultima settimana</SelectItem>
                        <SelectItem value="30d" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultimo mese</SelectItem>
                        <SelectItem value="1y" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultimo anno</SelectItem>
                        <SelectItem value="all" className="text-xs hover:bg-zinc-700 text-zinc-200">Tutto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-3 px-1 text-zinc-200">Seleziona Video</h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent pr-2">
                        {stats.videos.topVideos.map((video) => (
                          <div
                            key={video.id}
                            className={`stat-card p-2 cursor-pointer ${
                              selectedVideo === video.id ? 'ring-2 ring-accent' : ''
                            }`}
                            onClick={() => handleVideoSelect(video.id)}
                          >
                            <div className="flex items-center space-x-3">
                              {video.thumbnailUrl && (
                                <img
                                  src={video.thumbnailUrl}
                                  alt={video.title}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm line-clamp-1 text-zinc-200">{video.title}</p>
                                <p className="text-xs text-zinc-200 opacity-70 mt-0.5">
                                  {format(new Date(video.createdAt), 'd MMM yyyy', { locale: it })}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                                    <Eye className="w-3 h-3 mr-1" />
                                    {videoStats[video.id]?.views || 0}
                                  </span>
                                  <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                                    <Heart className="w-3 h-3 mr-1" />
                                    {videoStats[video.id]?.likes || 0}
                                  </span>
                                  <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                                    <MessageCircle className="w-3 h-3 mr-1" />
                                    {videoStats[video.id]?.comments || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium px-1 text-zinc-200">Andamento</h3>
                      <div className="chart-container">
                        <MetricsChart />
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="post-analytics" className="bg-zinc-800/50 rounded-xl border-none">
              <AccordionTrigger className="px-4 py-2 hover:bg-zinc-700/50 transition-colors rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="bg-primary/20 p-2 rounded-xl group-hover:bg-primary/30 transition-colors">
                    <Filter className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">Analisi Post</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-zinc-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <MetricSelector />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-[140px] h-8 rounded-full bg-zinc-700/50 border-none shadow-sm text-xs text-zinc-200 hover:bg-zinc-600/50 transition-colors">
                        <SelectValue placeholder="Seleziona periodo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-zinc-800 border-none shadow-md">
                        <SelectItem value="1h" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultima ora</SelectItem>
                        <SelectItem value="1d" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultimo giorno</SelectItem>
                        <SelectItem value="7d" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultima settimana</SelectItem>
                        <SelectItem value="30d" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultimo mese</SelectItem>
                        <SelectItem value="1y" className="text-xs hover:bg-zinc-700 text-zinc-200">Ultimo anno</SelectItem>
                        <SelectItem value="all" className="text-xs hover:bg-zinc-700 text-zinc-200">Tutto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium mb-3 px-1 text-zinc-200">Seleziona Post</h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent pr-2">
                        {stats.posts.topPosts.map((post) => (
                          <div
                            key={post.id}
                            className={`stat-card p-2 cursor-pointer ${
                              selectedPost === post.id ? 'ring-2 ring-accent' : ''
                            }`}
                            onClick={() => handlePostSelect(post.id)}
                          >
                            <div className="flex items-center space-x-3">
                              {post.imageUrl && (
                                <img
                                  src={post.imageUrl}
                                  alt={post.caption}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm line-clamp-1 text-zinc-200">{post.caption}</p>
                                <p className="text-xs text-zinc-200 opacity-70 mt-0.5">
                                  {format(new Date(post.createdAt), 'd MMM yyyy', { locale: it })}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                                    <Eye className="w-3 h-3 mr-1" />
                                    {postStats[post.id]?.views || 0}
                                  </span>
                                  <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                                    <Heart className="w-3 h-3 mr-1" />
                                    {postStats[post.id]?.likes || 0}
                                  </span>
                                  <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                                    <MessageCircle className="w-3 h-3 mr-1" />
                                    {postStats[post.id]?.comments || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium px-1 text-zinc-200">Andamento</h3>
                      <div className="chart-container">
                        <MetricsChart />
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="top-content" className="bg-zinc-800/50 rounded-xl border-none">
              <AccordionTrigger className="px-4 py-2 hover:bg-zinc-700/50 transition-colors rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="bg-primary/20 p-2 rounded-xl group-hover:bg-primary/30 transition-colors">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">Post più popolari</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-zinc-200">
                <ContentList items={stats.posts.topPosts} type="post" />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="popular-videos" className="bg-zinc-800/50 rounded-xl border-none">
              <AccordionTrigger className="px-4 py-2 hover:bg-zinc-700/50 transition-colors rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="bg-primary/20 p-2 rounded-xl group-hover:bg-primary/30 transition-colors">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">Video più popolari</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-zinc-200">
                <div className="space-y-4">
                  {stats.videos.topVideos.map((video, index) => (
                    <div
                      key={video.id}
                      className={`stat-card p-2 cursor-pointer ${
                        selectedVideo === video.id ? 'ring-2 ring-accent' : ''
                      }`}
                      onClick={() => handleVideoSelect(video.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                          {index === 0 ? (
                            <Trophy className="w-4 h-4" />
                          ) : index === 1 ? (
                            <Medal className="w-4 h-4" />
                          ) : index === 2 ? (
                            <Award className="w-4 h-4" />
                          ) : (
                            <span className="text-sm font-medium">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-shrink-0 w-24 h-16 relative">
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt={`Video ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                              <PlayCircle className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/75 text-white text-xs px-1 rounded">
                            {Math.round(video.watchTime / 60)}m
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1 text-zinc-200">{video.title}</p>
                          <p className="text-xs text-zinc-200 opacity-70 mt-0.5">
                            {format(new Date(video.createdAt), 'd MMM yyyy', { locale: it })}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                              <Eye className="w-3 h-3 mr-1" />
                              {video.views}
                            </span>
                            <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                              <Heart className="w-3 h-3 mr-1" />
                              {video.likes}
                            </span>
                            <span className="text-xs text-zinc-200 opacity-70 flex items-center">
                              <PieChart className="w-3 h-3 mr-1" />
                              {Math.round(video.completionRate)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="demographics" className="bg-zinc-800/50 rounded-xl border-none">
              <AccordionTrigger className="px-4 py-2 hover:bg-zinc-700/50 transition-colors rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="bg-primary/20 p-2 rounded-xl group-hover:bg-primary/30 transition-colors">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">Demografia</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-zinc-200">
                <div className="space-y-8">
                  <div>
                    <h4 className="font-semibold mb-4 text-white flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Fasce d'età
                    </h4>
                    <div className="bg-zinc-800/50 p-4 rounded-xl">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={demographicStats.ageGroups}>
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                          />
                          <YAxis 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#18181b',
                              border: '1px solid #27272a',
                              borderRadius: '8px',
                              color: '#ffffff'
                            }}
                            labelStyle={{ color: '#ffffff' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#8884d8" 
                            radius={[4, 4, 0, 0]}
                            name="Utenti"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4 text-white flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      Piattaforme
                    </h4>
                    <div className="bg-zinc-800/50 p-4 rounded-xl">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={demographicStats.platforms}>
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                          />
                          <YAxis 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#18181b',
                              border: '1px solid #27272a',
                              borderRadius: '8px',
                              color: '#ffffff'
                            }}
                            labelStyle={{ color: '#ffffff' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#82ca9d" 
                            radius={[4, 4, 0, 0]}
                            name="Utenti"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4 text-white flex items-center gap-2">
                      <PieChart className="w-5 h-5" />
                      Localizzazione
                    </h4>
                    <div className="bg-zinc-800/50 p-4 rounded-xl">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={demographicStats.locations}>
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                          />
                          <YAxis 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#18181b',
                              border: '1px solid #27272a',
                              borderRadius: '8px',
                              color: '#ffffff'
                            }}
                            labelStyle={{ color: '#ffffff' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#ffc658" 
                            radius={[4, 4, 0, 0]}
                            name="Utenti"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sharing" className="bg-zinc-800/50 rounded-xl border-none">
              <AccordionTrigger className="px-4 py-2 hover:bg-zinc-700/50 transition-colors rounded-xl">
                <div className="flex items-center space-x-2">
                  <div className="bg-primary/20 p-2 rounded-xl group-hover:bg-primary/30 transition-colors">
                    <Share2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm text-zinc-200">Condivisioni</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 text-zinc-200">
                {renderSharesSection()}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

export default StatisticsPage;
