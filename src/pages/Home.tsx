import React, { useEffect, useState, useRef } from 'react';
import { 
  getVideos, getUsers, saveUsers, saveVideos, incrementVideoView, updateVideo,
  ensureVideoInDB, getMessages, saveMessages, getNotifications, 
  saveNotifications, subscribeToVideo, deleteVideoFromDB, getAppSettings, subscribeToAppSettings,
  updateUser, createWatchParty, joinWatchParty, subscribeToWatchParty, updateWatchPartyState,
  doc, getDoc, db
} from '../lib/db';
import { Video, User, WatchParty } from '../types';
import { useAppStore } from '../store';
import { 
  Heart, MessageCircle, Share2, Music, Bookmark, Eye, Loader2, Flag, 
  User as UserIcon, Sparkles, Trash2, Image as ImageIcon, Users, Lock, AlertCircle, Maximize2, Tv
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Comments } from '../components/Comments';
import { AIChatPanel } from '../components/AIChatPanel';
import { StoriesBar } from '../components/StoriesBar';
import { HolographicBadge, LikeParticles, AmbientGlow, ProfileHoverCard } from '../components/UIPolish';
import { isFriend } from '../lib/utils';
import YouTube, { YouTubeEvent, YouTubeProps } from 'react-youtube';
import { getReports, saveReports } from '../lib/db';
import { normalizeYoutubeShorts } from '../lib/feed';

const SONGS = [
  { id: '1', name: 'Summer Vibes', artist: 'Lofi Girl', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', name: 'Drift Phonk', artist: 'KORDHELL', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', name: 'Chill Beats', artist: 'NCS', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '4', name: 'Glitch Mode', artist: 'Hacker Core', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

export function Home() {
  const { currentUser, introPhase, setIntroPhase, isLoading, setShowAuthModal } = useAppStore();
  const { videoId } = useParams<{ videoId?: string }>();
  const [videos, setVideos] = useState<(Video & { user: User; feedId: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Watch Party State
  const [activePartyId, setActivePartyId] = useState<string | null>(new URLSearchParams(window.location.search).get('partyId'));
  const [partyData, setPartyData] = useState<WatchParty | null>(null);
  const [isPartyHost, setIsPartyHost] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const [loadingBatch, setLoadingBatch] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [youtubeOverloaded, setYoutubeOverloaded] = useState(false);
  const [serverCrashed, setServerCrashed] = useState(false);
  const [ytPageToken, setYtPageToken] = useState('');
  const seenFeedIds = useRef<Set<string>>(new Set());
  const advanceRequested = useRef(false);
  const lastScrollTop = useRef(0);
  const guestSwipeCount = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      setServerCrashed(settings.serverCrashed);
    });
    return () => unsub();
  }, []);

  const fetchBatch = async (isRefresh = false) => {
    if (loadingBatch) return;
    
    // Check for guest swipe limit
    if (!currentUser && guestSwipeCount.current >= 10) {
      setShowAuthModal(true);
      return;
    }

    if (!isRefresh && !advanceRequested.current) return;
    setLoadingBatch(true);
    advanceRequested.current = false;
    
    try {
      const currentCount = videos.length;
      let targetType: 'ugv' | 'youtube' = 'youtube';

      // Interleaved Logic: YT (0) -> VIDEO (1) -> YT (2) -> VIDEO (3) -> YT (4) -> VIDEO (5) -> Random (6+)
      if (currentCount % 2 === 0) {
        targetType = 'youtube';
      } else {
        targetType = 'ugv';
      }

      const allDbVideos = await getVideos();
      const allUsers = await getUsers();
      const localViewed = (() => {
        try {
          const shared = JSON.parse(localStorage.getItem('viewedVideos') || '[]') as string[];
          const userViewed = currentUser ? JSON.parse(localStorage.getItem(`viewedVideos_${currentUser.id}`) || '[]') as string[] : [];
          return Array.from(new Set([...shared, ...userViewed]));
        }
        catch { return []; }
      })();
      const unseenUgvs = allDbVideos.filter(video => {
        if (video.isYouTube || video.isRemoved || seenFeedIds.current.has(video.id) || (localViewed || []).includes(video.id)) return false;

        // Post Visibility & Friendship check
        const isAuthor = currentUser?.id === video.userId;
        const isStaff = currentUser?.role === 'owner' || currentUser?.role === 'staff';
        if (video.visibility === 'only_you' && !isAuthor && !isStaff) return false;
        if (video.visibility === 'friends' && !isAuthor && !isStaff) {
          const videoAuthor = allUsers.find(u => u.id === video.userId);
          if (!isFriend(currentUser, videoAuthor)) return false;
        }

        return !currentUser || !(video.viewedBy || []).includes(currentUser.id);
      }).map(v => ({
        ...v,
        videoUrl: v.videoData ? URL.createObjectURL(v.videoData) : v.videoUrl,
        user: allUsers.find(u => u.id === v.userId) || ({} as User)
      }));

      // If we target UGV but have none, fallback to YouTube
      if (targetType === 'ugv' && unseenUgvs.length === 0) {
        targetType = 'youtube';
      }

      let nextVideo: Video & { user: User } | undefined = targetType === 'ugv' 
        ? unseenUgvs[Math.floor(Math.random() * unseenUgvs.length)]
        : undefined;

      let nextYtPageToken = ytPageToken;

      if (!nextVideo) {
        try {
          const settings = await getAppSettings();
          let feedItems: Array<{videoId?: string; title?: string; channelTitle?: string; channelId?: string}> = [];
          
          let staticResponseOk = false;
          if (settings.useCache) {
            const staticResponse = await fetch('./youtube-feed.json', {cache: 'no-store'});
            if (staticResponse.ok) {
              const data = await staticResponse.json();
              if (Array.isArray(data.videos) && data.videos.length > 0) {
                feedItems = data.videos;
                setYoutubeOverloaded(Boolean(data.overloaded));
                staticResponseOk = true;
              }
            }
          }

          if (!staticResponseOk) {
            let fetchUrl = '/api/youtube-shorts';
            if (currentUser?.interests && currentUser.interests.length > 0) {
              const randomInterest = currentUser.interests[Math.floor(Math.random() * currentUser.interests.length)];
              let enhancedQuery = randomInterest + ' viral shorts 2026';
              if (/funny|comedy|humor|laughs/i.test(randomInterest)) {
                enhancedQuery = 'top tier clever comedy memes 2026';
              }
              fetchUrl += `?q=${encodeURIComponent(enhancedQuery)}`;
            }
            
            const localResponse = await fetch(fetchUrl);
            if (localResponse.ok) {
              const data = await localResponse.json();
              feedItems = normalizeYoutubeShorts(data.items || [], seenFeedIds.current).map((item: any) => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                channelId: item.snippet.channelId
              }));
              setYoutubeOverloaded(false);
            } else {
              feedItems = [
                { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up (Viral Short)', channelTitle: 'Rick Astley' },
                { videoId: 'jNQXAC9IVRw', title: 'Me at the zoo (First YouTube Video)', channelTitle: 'jawed' },
                { videoId: '9bZkp7q19f0', title: 'Gangnam Style Viral Clip', channelTitle: 'officialpsy' },
                { videoId: 'L_LUpnjgPso', title: 'Satisfying Moments Compilation', channelTitle: 'Satisfying Daily' },
                { videoId: 'kJQP7kiw5Fk', title: 'Despacito Epic Cover', channelTitle: 'Music Vibe' }
              ];
              setYoutubeOverloaded(false);
            }
          }
          let validItems = feedItems.filter((item: {videoId?: string}) => item.videoId && !seenFeedIds.current.has(`yt_${item.videoId}`));
          if (validItems.length === 0 && feedItems.length > 0) {
            seenFeedIds.current.clear();
            validItems = feedItems.filter((item: {videoId?: string}) => item.videoId);
          }
          const valid = validItems.length > 0 ? validItems[Math.floor(Math.random() * validItems.length)] : undefined;
          if (valid) {
            nextYtPageToken = '';
            const cleanedTitle = (valid.title || '')
              .replace(/#shorts?\b/gi, '')
              .replace(/#youtubeshorts?\b/gi, '')
              .replace(/#youtube\b/gi, '')
              .trim();

            nextVideo = {
              id: `yt_${valid.videoId}`,
              userId: 'centraltok_creator', 
              videoUrl: '', 
              description: cleanedTitle || 'Trending video on CentralTok',
              tags: ['#viral', '#trending', '#centraltok'], 
              likes: [], 
              comments: [], 
              timestamp: Date.now(),
              views: 0, 
              filter: '', 
              isYouTube: true, 
              youtubeId: valid.videoId,
              user: {
                id: 'centraltok_creator', 
                email: `${valid.channelId}@centraltok.local`, 
                username: valid.channelTitle,
                handle: valid.channelTitle.replace(/\s+/g, '').toLowerCase().slice(0, 18),
                avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${valid.channelId}`,
                bio: 'CentralTok Creator', 
                following: [], 
                followers: [], 
                isPrivate: false
              }
            };
          }
        } catch (error) {
          console.warn('YouTube Shorts request failed', error);
        }
      }

      setYtPageToken(nextYtPageToken);
      const mixedWithFeedIds = nextVideo ? [{ ...nextVideo, feedId: Math.random().toString(36).substring(2, 9) }] : [];
      mixedWithFeedIds.forEach(video => seenFeedIds.current.add(video.id));

      if (isRefresh) {
        setVideos(mixedWithFeedIds);
        setHasMore(Boolean(nextVideo) || Boolean(nextYtPageToken));
      } else {
        setVideos(prev => {
          const newVideos = mixedWithFeedIds.filter(newVid => !prev.some(p => p.id === newVid.id));
          return [...prev, ...newVideos];
        });
        setHasMore(Boolean(nextVideo) || Boolean(nextYtPageToken));
      }
    } catch (err) {
      console.error("fetchBatch error:", err);
      setHasMore(false);
    } finally {
      setLoadingBatch(false);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Watch Party Effects
  useEffect(() => {
    if (!activePartyId) return;

    const unsub = subscribeToWatchParty(activePartyId, (party) => {
      if (!party) {
        setActivePartyId(null);
        setPartyData(null);
        setIsPartyHost(false);
        return;
      }
      setPartyData(party);
      setIsPartyHost(party.hostId === currentUser?.id);

      // If not host and video changed, scroll to it
      if (party.hostId !== currentUser?.id) {
        const videoIndex = videos.findIndex(v => v.id === party.currentVideoId);
        if (videoIndex !== -1 && videoIndex !== currentVideoIndex) {
          const container = containerRef.current;
          if (container) {
            container.scrollTo({ 
              top: videoIndex * container.clientHeight, 
              behavior: 'smooth' 
            });
            setCurrentVideoIndex(videoIndex);
          }
        }
      }
    });

    return () => unsub();
  }, [activePartyId, videos, currentUser?.id]);

  // Sync state if host
  useEffect(() => {
    if (activePartyId && isPartyHost && videos[currentVideoIndex]) {
      updateWatchPartyState(activePartyId, {
        currentVideoId: videos[currentVideoIndex].id
      });
    }
  }, [currentVideoIndex, isPartyHost, activePartyId, videos]);

  const handleStartWatchParty = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const currentVideo = videos[currentVideoIndex];
    if (!currentVideo) return;
    
    const partyId = await createWatchParty(currentUser.id, currentVideo.id);
    if (partyId) {
      setActivePartyId(partyId);
      setIsPartyHost(true);
      // Update URL without refreshing
      const url = new URL(window.location.href);
      url.searchParams.set('partyId', partyId);
      window.history.pushState({}, '', url);
    }
  };

  const handleJoinParty = async (partyId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    await joinWatchParty(partyId, currentUser.id);
    setActivePartyId(partyId);
  };

  useEffect(() => {
    if (isLoading) return;
    seenFeedIds.current.clear();
    const loadFeed = async () => {
      if (videoId) {
        try {
          const docRef = doc(db, 'videos', videoId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const v = snap.data() as Video;
            const allUsers = await getUsers();
            const user = allUsers.find(u => u.id === v.userId) || ({} as User);
            const enriched = {
              ...v,
              videoUrl: v.videoData ? URL.createObjectURL(v.videoData) : v.videoUrl,
              user,
              feedId: `db_${v.id}`
            };
            seenFeedIds.current.add(`db_${v.id}`);
            setVideos([enriched]);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error("Error loading specific video:", err);
        }
      }
      setVideos([]);
      setYtPageToken('');
      setHasMore(true);
      fetchBatch(true);
    };
    loadFeed();
  }, [currentUser?.id, isLoading, videoId]);

  // Pull to refresh logic
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    if (startY - y > 12) advanceRequested.current = true;
    if (!pulling) return;
    if (y - startY > 120) {
      setRefreshing(true);
      fetchBatch(true);
      setPulling(false);
    }
  };

  const handleTouchEnd = () => setPulling(false);

  const handleFeedScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const movedDown = container.scrollTop > lastScrollTop.current + 8;
    lastScrollTop.current = container.scrollTop;
    
    if (movedDown && !currentUser) {
      guestSwipeCount.current += 1;
    }
    
    if (!movedDown || !hasMore || !advanceRequested.current) return;
    
    if (!currentUser && guestSwipeCount.current >= 10) {
      setShowAuthModal(true);
      return;
    }
    
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 160) {
      fetchBatch();
    }

    // Update current index for watch party sync
    const newIndex = Math.round(container.scrollTop / container.clientHeight);
    if (newIndex !== currentVideoIndex) {
      setCurrentVideoIndex(newIndex);
    }
  };

  const handleFeedWheel = (event: React.WheelEvent) => {
    if (event.deltaY > 0) advanceRequested.current = true;
  };

  // Intro Animation progression
  useEffect(() => {
    if (!loading && introPhase === 'loading') {
      setIntroPhase('merging');
      setTimeout(() => {
        setIntroPhase('expanding');
        setTimeout(() => {
          setIntroPhase('done');
        }, 1000); // 1s for blackhole expansion
      }, 1000); // 1s for merging
    }
  }, [loading, introPhase]);

  const scrollUp = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ top: -containerRef.current.clientHeight, behavior: 'smooth' });
    }
  };

  const scrollDown = () => {
    if (containerRef.current) {
      advanceRequested.current = true;
      containerRef.current.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' });
      fetchBatch();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollUp();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        advanceRequested.current = true;
        scrollDown();
        fetchBatch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (serverCrashed) {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <AlertCircle size={40} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Servers has crashed</h1>
        <p className="text-zinc-500 max-w-xs leading-relaxed">
          We are currently experiencing a critical server failure. Please wait shortly for a fix.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-3 bg-zinc-800 text-white rounded-xl font-bold hover:bg-zinc-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (introPhase !== 'done') {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Ambient background glow */}
        <div className="absolute w-96 h-96 bg-gradient-to-tr from-pink-600/25 to-blue-600/25 rounded-full blur-3xl animate-pulse pointer-events-none" />

        {/* Black Hole expansion */}
        {introPhase === 'expanding' && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 120, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 w-16 h-16 bg-black rounded-full"
            style={{ 
              boxShadow: '0 0 150px 80px rgba(0,0,0,1)' 
            }}
          />
        )}

        <div className={`relative z-10 flex flex-col items-center justify-center transition-opacity duration-500 ${introPhase === 'expanding' ? 'opacity-0' : 'opacity-100'}`}>
           {/* Logo Animation */}
           <div className="relative flex items-center justify-center w-36 h-36 mb-8">
             <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500 to-blue-600 opacity-20 blur-xl animate-spin" style={{ animationDuration: '6s' }} />
             
             {/* Central C & T */}
             <div className="flex items-center justify-center gap-1">
               <motion.div 
                 animate={introPhase === 'merging' ? { x: 12, scale: 0.8, opacity: 0 } : { scale: [1, 1.05, 1] }}
                 transition={introPhase === 'merging' ? { duration: 0.6 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
                 className="text-6xl font-black tracking-tighter bg-gradient-to-br from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent drop-shadow-lg"
               >
                 C
               </motion.div>
               <motion.div 
                 animate={introPhase === 'merging' ? { x: -12, scale: 0.8, opacity: 0 } : { scale: [1, 1.05, 1] }}
                 transition={introPhase === 'merging' ? { duration: 0.6 } : { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                 className="text-6xl font-black tracking-tighter bg-gradient-to-br from-pink-400 via-pink-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(236,72,153,0.5)]"
               >
                 T
               </motion.div>
             </div>

             {/* Orbiting Ring */}
             <motion.div
               animate={introPhase === 'loading' ? { rotate: 360 } : { rotate: 0 }}
               transition={introPhase === 'loading' ? { duration: 2, repeat: Infinity, ease: "linear" } : { duration: 0 }}
               className="absolute inset-0 rounded-full border-2 border-transparent border-t-pink-500 border-r-blue-500"
             />
           </div>

           {/* Brand Title & Status */}
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="text-center space-y-2"
           >
             <h2 className="text-xl font-black tracking-widest uppercase bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
               CentralTok
             </h2>
             <div className="flex items-center justify-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
               <p className="text-xs font-medium text-zinc-400 tracking-wider uppercase">
                 {introPhase === 'merging' ? 'Synchronizing Experience...' : 'Preparing Feed...'}
               </p>
             </div>
           </motion.div>
        </div>
      </div>
    );
  }

  const handlePostDeleted = (deletedId: string) => {
    setVideos(prev => prev.filter(v => v.id !== deletedId));
  };

  return (
    <div className="relative h-full w-full flex flex-col items-center bg-black md:bg-zinc-950 overflow-hidden">
      {/* 24-Hour Stories Tray */}
      <div className="w-full max-w-[500px] shrink-0">
        <StoriesBar />
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={handleFeedScroll}
        onWheel={handleFeedWheel}
        className="h-full w-full max-w-[500px] snap-y snap-mandatory overflow-y-scroll hide-scrollbar pb-16 md:pb-0 relative bg-black flex-1"
      >
        {refreshing && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-50">
            <div className="bg-white dark:bg-zinc-800 p-2 rounded-full shadow-lg text-pink-600 animate-spin">
              <Loader2 size={24} />
            </div>
          </div>
        )}
        {videos.map((video) => (
          <VideoItem 
            key={video.feedId} 
            video={video} 
            onDelete={() => handlePostDeleted(video.id)}
          />
        ))}

        {hasMore ? (
          <div ref={endRef} className="h-20 snap-start flex items-center justify-center bg-black shrink-0">
            <Loader2 size={32} className="animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="h-20 snap-start flex items-center justify-center bg-black shrink-0 text-zinc-500 text-sm pb-8 text-center px-4">
            {youtubeOverloaded ? 'The Servers are Overloaded, This will be fixed shortly' : "You've caught up for now!"}
          </div>
        )}
      </motion.div>
      
      {/* Desktop Navigation Arrows */}
      <div className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col gap-4 z-40">
        <button 
          onClick={scrollUp}
          className="p-4 bg-white/10 dark:bg-zinc-800/80 hover:bg-pink-600 text-white rounded-full transition-all drop-shadow-2xl backdrop-blur-md border border-white/20 hover:scale-110 active:scale-95 group"
          title="Scroll Up"
        >
          <svg className="w-8 h-8 transition-transform group-hover:-translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button 
          onClick={scrollDown}
          className="p-4 bg-white/10 dark:bg-zinc-800/80 hover:bg-pink-600 text-white rounded-full transition-all drop-shadow-2xl backdrop-blur-md border border-white/20 hover:scale-110 active:scale-95 group"
          title="Scroll Down"
        >
          <svg className="w-8 h-8 transition-transform group-hover:translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export const VideoItem: React.FC<{ 
  video: Video & { user: User; feedId?: string };
  onDelete?: (id: string) => void;
  onMinimize?: () => void;
}> = ({ video, onDelete, onMinimize }) => {
  const { 
    currentUser, 
    setCurrentUser, 
    isGameActive,
    setMiniPlayerActive,
    setMiniPlayerUrl,
    setMiniPlayerTitle
  } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isLiked, setIsLiked] = useState((video.likes || []).includes(currentUser?.id || '') || false);
  const [likesCount, setLikesCount] = useState((video.likes || []).length);
  const [isFavorited, setIsFavorited] = useState((currentUser?.favorites || []).includes(video.id) || false);
  const [views, setViews] = useState(video.views || 0);
  const [hasViewed, setHasViewed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [youtubeError, setYoutubeError] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareUsers, setShareUsers] = useState<User[]>([]);
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  const [likePos, setLikePos] = useState<{ x: number, y: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const shouldPlayYoutube = useRef(false);

  const areFriends = isFriend(currentUser, video.user);
  const canDelete = !video.isYouTube && (currentUser?.id === video.userId || currentUser?.role === 'owner' || currentUser?.role === 'staff');
  const isImageMedia = video.mediaType === 'image';

  // Find track if any
  const track = video.musicId ? SONGS.find(s => s.id === video.musicId) : null;

  useEffect(() => {
    if (track && isActive && isPlaying) {
      if (!audioRef.current) {
        audioRef.current = new Audio(track.url);
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [isActive, isPlaying, track]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;
    await deleteVideoFromDB(video.id);
    if (onDelete) onDelete(video.id);
  };

  useEffect(() => {
    // Only subscribe to real-time updates for non-YouTube shorts (or YouTube shorts that are already in the DB, though their ID works too once added).
    const unsub = subscribeToVideo(video.id, (updatedVideo) => {
      setViews(updatedVideo.views || 0);
      setLikesCount(updatedVideo.likes?.length || 0);
    });
    return () => unsub();
  }, [video.id]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isGameActive) {
          shouldPlayYoutube.current = true;
          if (video.isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
            try {
              ytPlayerRef.current.playVideo();
            } catch (err) {}
          } else if (videoRef.current && typeof videoRef.current.play === 'function') {
            videoRef.current.play().catch(() => {});
          }
          if (!video.isYouTube) setIsPlaying(true);
          setIsActive(true);
          
          if (!hasViewed) {
            setHasViewed(true);
            let localViewed: string[] = [];
            try { localViewed = JSON.parse(localStorage.getItem('viewedVideos') || '[]'); } catch (e) {}
            
            if (currentUser) {
              const userViewedKey = `viewedVideos_${currentUser.id}`;
              let userViewed: string[] = [];
              try { userViewed = JSON.parse(localStorage.getItem(userViewedKey) || '[]') as string[]; } catch {}
              if (!userViewed.includes(video.id)) localStorage.setItem(userViewedKey, JSON.stringify([...userViewed, video.id]));
              if (!video.viewedBy?.includes(currentUser.id)) {
                ensureVideoInDB(video).then(() => {
                  incrementVideoView(video.id, currentUser.id);
                  setViews(v => v + 1);
                });
              }
            } else {
              if (!localViewed.includes(video.id)) {
                ensureVideoInDB(video).then(() => {
                  incrementVideoView(video.id, null);
                  setViews(v => v + 1);
                  localStorage.setItem('viewedVideos', JSON.stringify([...localViewed, video.id]));
                });
              }
            }
          }
        } else {
          shouldPlayYoutube.current = false;
          if (video.isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
            ytPlayerRef.current.pauseVideo();
          } else if (videoRef.current && typeof videoRef.current.pause === 'function') {
            videoRef.current.pause();
          }
          setIsPlaying(false);
          setIsActive(false);
        }
      });
    }, { threshold: 0.6 });
    
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasViewed, video.id, currentUser, video.isYouTube, isGameActive]);

  // Effect to pause/play when game state changes
  useEffect(() => {
    if (isGameActive) {
      shouldPlayYoutube.current = false;
      if (video.isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        ytPlayerRef.current.pauseVideo();
      } else if (videoRef.current && typeof videoRef.current.pause === 'function') {
        videoRef.current.pause();
      }
      setIsPlaying(false);
    } else if (isActive) {
      shouldPlayYoutube.current = true;
      if (video.isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        try { ytPlayerRef.current.playVideo(); } catch (err) {}
      } else if (videoRef.current && typeof videoRef.current.play === 'function') {
        videoRef.current.play().catch(() => {});
      }
      if (!video.isYouTube) setIsPlaying(true);
    }
  }, [isGameActive]);

  const handleYtReady = (e: YouTubeEvent) => {
    ytPlayerRef.current = e.target;
    if (shouldPlayYoutube.current && typeof e.target.playVideo === 'function') {
      try { e.target.playVideo(); } catch (err) {}
    }
  };

  const handleYtStateChange = (e: YouTubeEvent) => {
    setIsPlaying(e.data === 1);
    if (e.data === 0 && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.seekTo === 'function') {
        try { ytPlayerRef.current.seekTo(0); } catch (err) {}
      }
      if (typeof ytPlayerRef.current.playVideo === 'function') {
        try { ytPlayerRef.current.playVideo(); } catch (err) {}
      }
    }
  };

  const togglePlay = () => {
    if (video.isYouTube && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.unMute === 'function') ytPlayerRef.current.unMute();
      if (typeof ytPlayerRef.current.setVolume === 'function') ytPlayerRef.current.setVolume(100);
      if (isPlaying && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try { ytPlayerRef.current.pauseVideo(); } catch (err) {}
      } else if (!isPlaying && typeof ytPlayerRef.current.playVideo === 'function') {
        try { ytPlayerRef.current.playVideo(); } catch (err) {}
      }
    } else if (videoRef.current) {
      if (isPlaying && typeof videoRef.current.pause === 'function') videoRef.current.pause();
      else if (!isPlaying && typeof videoRef.current.play === 'function') videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isActive && e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isPlaying, togglePlay]);

  const handleLike = async (e?: React.MouseEvent) => {
    if (!currentUser) return;
    
    // Particle effect trigger
    if (e) {
      setLikePos({ x: e.clientX, y: e.clientY });
    }

    const newStatus = !isLiked;
    setIsLiked(newStatus);
    setLikesCount(prev => newStatus ? prev + 1 : prev - 1);
    
    await ensureVideoInDB(video);
    await updateVideo(video.id, (v) => {
      const currentLikes = v.likes || [];
      let updatedLikes = [...currentLikes];
      if (newStatus) {
        if (!updatedLikes.includes(currentUser.id)) {
          updatedLikes.push(currentUser.id);
        }
      } else {
        updatedLikes = updatedLikes.filter(id => id !== currentUser.id);
      }
      return { ...v, likes: updatedLikes };
    });
  };

  const handleDoubleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!isLiked) handleLike(e);
      else setLikePos({ x: e.clientX, y: e.clientY });
    }
    lastTapRef.current = now;
  };

  const handleFavorite = async () => {
    if (!currentUser) return;
    const newStatus = !isFavorited;
    setIsFavorited(newStatus);
    
    let newFavorites = currentUser.favorites || [];
    if (newStatus) {
      newFavorites = [...newFavorites, video.id];
    } else {
      newFavorites = newFavorites.filter(id => id !== video.id);
    }
    
    const updatedUser = { ...currentUser, favorites: newFavorites };
    setCurrentUser(updatedUser);
    
    try {
      await updateUser(currentUser.id, { favorites: newFavorites });
    } catch (err) {
      console.error("Error updating favorites:", err);
    }
    
    await ensureVideoInDB(video);
  };

  const handleShare = async () => {
    if (!currentUser) return;
    const users = await getUsers();
    setShareUsers(users.filter(user => user.id !== currentUser.id));
    setShowShare(true);
  };

  const sendVideo = async (recipient: User) => {
    if (!currentUser) return;
    const messages = await getMessages();
    await saveMessages([...messages, {
      id: `msg_${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId: recipient.id,
      content: `Shared a video with you: ${video.description}`,
      sharedVideoId: video.id,
      timestamp: Date.now()
    }]);
    const notifications = await getNotifications();
    await saveNotifications([...notifications, {
      id: `notif_${Date.now()}`,
      userId: recipient.id,
      type: 'message',
      fromUserId: currentUser.id,
      read: false,
      timestamp: Date.now()
    }]);
    setSharedTo(recipient.id);
    setTimeout(() => { setShowShare(false); setSharedTo(null); }, 1200);
  };

  const submitReport = async () => {
    if (!currentUser || !reportReason) return;
    
    const { addReport: dbAddReport } = await import('../lib/db');
    await dbAddReport({
      videoId: video.id,
      reporterId: currentUser.id,
      reason: reportReason,
      status: 'pending',
      timestamp: Date.now(),
      category: 'video'
    });
    
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReport(false);
      setReportSubmitted(false);
      setReportReason('');
    }, 2000);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !video.isYouTube) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current && !video.isYouTube) {
      videoRef.current.currentTime = (val / 100) * videoRef.current.duration;
      setProgress(val);
    }
  };

  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      enablejsapi: 1,
      origin: window.location.origin,
      mute: 0,
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      fs: 0,
      disablekb: 1,
      playsinline: 1,
      iv_load_policy: 3
    },
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full snap-start relative bg-black flex items-center justify-center group overflow-hidden"
    >
      {(() => {
        const getThemeFrameClass = (style?: string) => {
          switch (style) {
            case 'gold':
              return 'border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] rounded-[2.5rem] overflow-hidden';
            case 'emerald':
              return 'border-4 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)] rounded-[2.5rem] overflow-hidden';
            case 'purple':
              return 'border-4 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.6)] rounded-[2.5rem] overflow-hidden';
            case 'sunset':
              return 'border-4 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.6)] rounded-[2.5rem] overflow-hidden';
            case 'cyber':
            default:
              return 'border-4 border-cyan-400 shadow-[0_0_30px_rgba(0,242,254,0.6)] rounded-[2.5rem] overflow-hidden';
          }
        };
        return (
          <AmbientGlow 
            src={video.isYouTube ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : (video.videoUrl || video.thumbnailUrl)} 
            type={isImageMedia ? 'image' : 'video'}
          >
            <div className={`relative w-full h-full max-w-[450px] aspect-[9/16] bg-black shadow-2xl flex items-center justify-center m-2 ${getThemeFrameClass(video.user?.themeStyle)}`}>
          {/* Main Media Content */}
          <div 
            className="relative w-full h-full cursor-pointer group/vid" 
            onClick={togglePlay}
            onMouseDown={handleDoubleTap}
          >
            {video.isYouTube ? (
              youtubeError ? (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center text-white select-none">
                  <img 
                    src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`} 
                    alt="Video preview" 
                    className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm" 
                  />
                  <div className="relative z-10 max-w-xs flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-800/90 flex items-center justify-center mb-2 shadow-lg">
                      <Music size={22} className="text-pink-500" />
                    </div>
                    <p className="font-semibold text-sm">Media stream unavailable</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setYoutubeError(null); }} 
                      className="mt-3 inline-block rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition-transform"
                    >
                      Retry Stream
                    </button>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center select-none bg-black">
                  <div className="w-[124%] h-[124%] scale-105 relative flex items-center justify-center pointer-events-none">
                    <YouTube 
                      videoId={video.youtubeId} 
                      opts={opts} 
                      onReady={handleYtReady}
                      onStateChange={handleYtStateChange}
                      onError={(event) => setYoutubeError(event.data)}
                      className="w-full h-full" 
                      iframeClassName="w-full h-full object-cover pointer-events-none" 
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-44 h-24 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-[5]" />
                  <div className="absolute top-0 right-0 w-44 h-24 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none z-[5]" />
                  <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-[5]" />
                </div>
              )
            ) : isImageMedia ? (
              <div className="w-full h-full bg-black flex items-center justify-center relative select-none">
                <img 
                  src={video.videoUrl} 
                  alt={video.description} 
                  className={`max-w-full max-h-full object-contain ${video.filter || ''}`} 
                />
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 z-20">
                  <ImageIcon size={14} /> Photo
                </div>
              </div>
            ) : video.videoUrl ? (
              <video 
                ref={videoRef}
                src={video.videoUrl}
                className={`w-full h-full object-contain bg-black ${video.filter || ''}`}
                loop
                playsInline
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <Loader2 size={32} className="text-pink-600 animate-spin" />
              </div>
            )}

            {/* Text Overlays */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {video.textOverlays?.map((overlay) => (
                <motion.div
                  key={overlay.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    y: overlay.animation === 'float' ? [0, -10, 0] : 0,
                    x: overlay.animation === 'glitch' ? [0, -2, 2, -2, 2, 0] : 0
                  }}
                  transition={{ 
                    duration: overlay.animation === 'float' ? 2 : 0.3,
                    repeat: overlay.animation === 'float' || overlay.animation === 'glitch' ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                  className="absolute"
                  style={{ 
                    left: `${overlay.x}%`, 
                    top: `${overlay.y}%`, 
                    color: overlay.color,
                    fontSize: `${overlay.fontSize}px`,
                    fontWeight: '900',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {overlay.text}
                </motion.div>
              ))}
            </div>
            
            {/* Play Overlay */}
            {!isPlaying && !isImageMedia && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-black/50 p-4 rounded-full text-white backdrop-blur-md">
                  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
            )}
          </div>

          {/* Particle System */}
          {likePos && (
            <LikeParticles 
              x={likePos.x} 
              y={likePos.y} 
              onComplete={() => setLikePos(null)} 
            />
          )}

          {/* Right Action Bar (Glassmorphic) */}
          <div className="absolute right-3 bottom-24 md:bottom-20 flex flex-col items-center gap-5 z-20 transition-opacity">
            <div className="relative mb-2 group/user">
              <ProfileHoverCard user={video.user} />
              <Link to={`/profile/${video.user?.handle || ''}`}>
                {video.user?.avatarUrl ? (
                  <img src={video.user.avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800 object-cover shadow-[0_0_15px_rgba(255,255,255,0.3)] transform transition-transform group-hover/user:scale-110" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-white bg-zinc-800 flex items-center justify-center">
                    <UserIcon size={24} className="text-zinc-500" />
                  </div>
                )}
              </Link>
              <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-lg font-bold pb-0.5 shadow-lg transform transition-transform hover:scale-125">
                +
              </button>
            </div>
            
            <button className="flex flex-col items-center gap-1 group" onClick={(e) => handleLike(e)}>
              <div className={`p-3 rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 ${isLiked ? 'bg-pink-600/20 text-pink-600 border-pink-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <Heart size={28} className={isLiked ? 'fill-current drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : ''} />
              </div>
              <span className="text-xs font-bold text-white drop-shadow-md">{likesCount}</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 group" onClick={() => setShowComments(true)}>
              <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all">
                <MessageCircle size={28} className="fill-current" />
              </div>
              <span className="text-xs font-bold text-white drop-shadow-md">{video.comments?.length || 0}</span>
            </button>
            
            <button 
              className="flex flex-col items-center gap-1 group" 
              onClick={() => setShowAIChat(true)}
            >
              <div className="px-3 py-2 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] flex items-center gap-1 transition-all group-hover:scale-105 active:scale-95 group-hover:border-pink-400/60">
                <Sparkles size={16} className="text-pink-300 animate-pulse fill-pink-300" />
                <span className="text-[10px] font-black tracking-widest text-white">AI</span>
              </div>
              <span className="text-[10px] font-bold text-pink-100 drop-shadow">Ask AI</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 group" onClick={handleFavorite}>
              <div className={`p-3 rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 ${isFavorited ? 'bg-amber-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <Bookmark size={28} className={isFavorited ? 'fill-current drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : ''} />
              </div>
              <span className="text-xs font-bold text-white drop-shadow-md">Save</span>
            </button>

            <button className="flex flex-col items-center gap-1 group" onClick={handleShare}>
              <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all">
                <Share2 size={28} className="fill-current" />
              </div>
              <span className="text-xs font-bold text-white drop-shadow-md">Share</span>
            </button>

            <button 
              className="flex flex-col items-center gap-1 group" 
              onClick={() => {
                const url = video.isYouTube ? `https://www.youtube.com/watch?v=${video.videoId}` : (video.videoUrl || '');
                setMiniPlayerUrl(url);
                setMiniPlayerTitle(video.description || video.title || 'Video');
                setMiniPlayerActive(true);
                if (onMinimize) onMinimize();
              }}
            >
              <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all">
                <Maximize2 size={28} className="fill-current" />
              </div>
              <span className="text-xs font-bold text-white drop-shadow-md">Minimize</span>
            </button>

            {canDelete && (
              <button 
                className="flex flex-col items-center gap-1 group" 
                onClick={handleDeletePost}
              >
                <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-zinc-300 hover:bg-red-600/20 hover:text-red-500 transition-all">
                  <Trash2 size={22} />
                </div>
                <span className="text-[10px] font-bold text-white drop-shadow-md">Delete</span>
              </button>
            )}

            {currentUser && (
              <button className="flex flex-col items-center gap-1 group" onClick={() => setShowReport(true)}>
                <div className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-red-400 transition-colors">
                  <Flag size={18} />
                </div>
                <span className="text-[9px] font-bold text-zinc-400">Report</span>
              </button>
            )}
          </div>

          {/* Bottom Info Section (Polished) */}
          <div className="absolute bottom-0 left-0 right-16 p-6 pt-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white pb-20 md:pb-8 pointer-events-none z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/profile/${video.user?.handle}`} className="font-black text-xl pointer-events-auto hover:underline flex items-center gap-2 group/author">
                @{video.user?.handle || 'unknown'}
                <div className="flex gap-1">
                  {video.user?.isVerified && <HolographicBadge type="verified" />}
                  {video.user?.role === 'staff' && <HolographicBadge type="staff" />}
                  {video.user?.role === 'owner' && <HolographicBadge type="owner" />}
                </div>
              </Link>
              {areFriends && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
                  <Users size={10} /> Friends
                </span>
              )}
              {video.visibility === 'friends' && (
                <span className="px-2 py-0.5 bg-zinc-800/90 text-zinc-300 rounded-full text-[10px] font-semibold flex items-center gap-1">
                  <Users size={10} /> Friends only
                </span>
              )}
            </div>
            <p className="text-sm mt-2 mb-3 line-clamp-2 leading-relaxed opacity-90 drop-shadow">
              {video.description?.replace(/#shorts?\b/gi, '').replace(/#youtubeshorts?\b/gi, '').replace(/#youtube\b/gi, '').trim()}
            </p>
            
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 group/music cursor-pointer pointer-events-auto max-w-[200px]">
                <Music size={14} className="animate-[spin_4s_linear_infinite] text-pink-400 shrink-0" />
                <span className="truncate">{track ? `${track.name} - ${track.artist}` : 'Original Audio'}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                <Eye size={16} className="text-zinc-400" />
                <span>{views.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Interactive Glowing Progress Bar */}
          <div className="absolute bottom-12 md:bottom-0 left-0 right-0 h-1.5 z-30 group/progress">
            <div className="w-full h-full bg-white/10 relative overflow-hidden group-hover/progress:h-2.5 transition-all cursor-pointer pointer-events-auto">
              <motion.div 
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 relative shadow-[0_0_12px_rgba(236,72,153,0.8)]"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              </motion.div>
              <input 
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress || 0}
                onChange={handleSeek}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      </AmbientGlow>);
      })()}
      
      {showComments && (
        <>
          <div className="absolute inset-0 bg-black/50 z-30 pointer-events-auto" onClick={() => setShowComments(false)} />
          <Comments video={video} onClose={() => setShowComments(false)} />
        </>
      )}

      {showAIChat && (
        <AIChatPanel 
          isOpen={showAIChat} 
          onClose={() => setShowAIChat(false)} 
          videoContext={{
            title: video.description || 'Short Video',
            creator: video.user?.username || video.user?.handle || 'creator',
            isVerified: video.user?.isVerified,
            tags: video.tags || [],
            url: video.videoUrl,
            isYouTube: video.isYouTube,
            youtubeId: video.youtubeId,
            mediaType: video.mediaType
          }}
        />
      )}

      {showReport && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 dark:text-white">Report Video</h3>
            {reportSubmitted ? (
              <div className="text-center py-8 text-green-600 font-medium">
                Thank you. Your report has been submitted for review.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Please select a reason for reporting this video.</p>
                <select 
                  className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent dark:text-white"
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                >
                  <option value="" disabled>Select a reason...</option>
                  <option value="Spam or misleading">Spam or misleading</option>
                  <option value="Inappropriate content">Inappropriate content</option>
                  <option value="Harassment or bullying">Harassment or bullying</option>
                  <option value="Harmful or dangerous acts">Harmful or dangerous acts</option>
                  <option value="Copyright violation">Copyright violation</option>
                </select>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setShowReport(false)} className="flex-1 py-3 rounded-xl font-semibold bg-zinc-100 dark:bg-zinc-800 dark:text-white">Cancel</button>
                  <button 
                    onClick={submitReport} 
                    disabled={!reportReason}
                    className="flex-1 py-3 rounded-xl font-semibold bg-pink-600 text-white disabled:opacity-50"
                  >
                    Submit Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showShare && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Send video</h3>
            {sharedTo ? <p className="text-green-500 text-center py-6">Video sent!</p> : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {shareUsers.map(user => (
                  <button key={user.id} onClick={() => sendVideo(user)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left">
                    <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                    <span className="font-semibold">{user.username}</span>
                  </button>
                ))}
                {shareUsers.length === 0 && <p className="text-zinc-500 text-center py-6">No other users yet.</p>}
              </div>
            )}
            <button onClick={() => setShowShare(false)} className="w-full mt-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
