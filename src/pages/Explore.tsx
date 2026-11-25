import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import {
  Search, X, Play, Compass, Sparkles, Flame, Check,
  Radio, Video as VideoIcon, VideoOff, Mic, MicOff, Monitor,
  Users, Heart, MessageSquare, Send, Pin, Trash2, BarChart3,
  HelpCircle, Volume2, VolumeX, Maximize2, PictureInPicture2,
  Share2, Reply, ShieldAlert, ArrowLeft, Plus, Clock, Lock, Eye, Ban
} from 'lucide-react';
import {
  getVideos, getUsers, updateUser,
  subscribeToLiveStreams, subscribeToLiveStream, createLiveStream,
  updateLiveStream, endLiveStream, joinLiveStream, leaveLiveStream,
  sendLiveReaction, voteLivePoll, subscribeToLiveChat, sendLiveChatMessage,
  deleteMessage, subscribeToLiveRtcHost, subscribeToLiveRtcViewer,
  sendLiveRtcOffer, sendLiveRtcAnswer, addLiveRtcCandidate, cleanupLiveRtcForViewer,
  isFirebasePartDisabledNow, FIREBASE_OUTAGE_MESSAGE
} from '../lib/db';
import { Video, User, LiveStream, Message, LivePoll, LiveRtcSignal } from '../types';
import { useAppStore } from '../store';
import { HolographicBadge, CentralProBadge } from '../components/UIPolish';
import { VideoItem } from './Home';

const TRENDING_TAGS = ['#fyp', '#viral', '#gaming', '#dance', '#comedy', '#music', '#anime', '#tech', '#vibes'];

const SEED_CREATORS: User[] = [
  {
    id: 'user_eyeshd',
    email: 'eyeshd@centraltok.local',
    username: 'EyesHD',
    handle: 'eyeshd',
    avatarUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=150',
    bio: 'Creator & Administrator',
    isPrivate: false,
    role: 'owner',
    isVerified: true,
    followers: ['u1', 'u2', 'u3'],
    following: [],
    favorites: []
  },
  {
    id: 'user_anl1801',
    email: 'anl1801@centraltok.local',
    username: 'anl1801',
    handle: 'anl1801220',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: ['u1', 'u2'],
    following: [],
    favorites: []
  },
  {
    id: 'user_salvadorgarcia',
    email: 'salvadorgarcia@centraltok.local',
    username: 'salvadorgarcia102',
    handle: 'salvadorgarcia102826',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=salvador',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: ['u1', 'u2'],
    following: [],
    favorites: []
  },
  {
    id: 'user_kirito',
    email: 'kirito@centraltok.local',
    username: 'Kirito',
    handle: 'jascen',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kirito',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: ['u1'],
    following: [],
    favorites: []
  },
  {
    id: 'user_vrqiiaa',
    email: 'vrqiiaa@centraltok.local',
    username: 'vrqriiaa',
    handle: 'vrqiiaa1',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: ['u1'],
    following: [],
    favorites: []
  },
  {
    id: 'user_ownertestban',
    email: 'ownertestban@centraltok.local',
    username: 'ownertestban',
    handle: 'ownertestban951',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ownertestban',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: [],
    following: [],
    favorites: []
  },
  {
    id: 'user_ownertest',
    email: 'ownertest@centraltok.local',
    username: 'ownertest',
    handle: 'ownertest386',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ownertest',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: [],
    following: [],
    favorites: []
  },
  {
    id: 'user_maymay',
    email: 'maymay@centraltok.local',
    username: 'maymay',
    handle: 'maymays_lifee',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    bio: '',
    isPrivate: false,
    role: 'user',
    isVerified: false,
    followers: [],
    following: [],
    favorites: []
  }
];

export function Explore() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [results, setResults] = useState<{ type: 'user' | 'video', data: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestedAccounts, setSuggestedAccounts] = useState<User[]>(SEED_CREATORS);
  const [trendingVideos, setTrendingVideos] = useState<(Video & { user?: User })[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [exploreOutageError, setExploreOutageError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const loadInitialData = async () => {
    try {
      const [allUsers, allVideos] = await Promise.all([getUsers(), getVideos()]);
      
      // Merge users with SEED_CREATORS so the exact users from the reference are available
      const mergedUsers: User[] = [...allUsers];
      SEED_CREATORS.forEach(seed => {
        const existingIdx = mergedUsers.findIndex(u => u.handle.toLowerCase() === seed.handle.toLowerCase());
        if (existingIdx === -1) {
          mergedUsers.push(seed);
        } else if (seed.isVerified) {
          mergedUsers[existingIdx] = { ...mergedUsers[existingIdx], isVerified: true };
        }
      });

      // Sort with EyesHD first or verified first
      const sorted = [...mergedUsers].sort((a, b) => {
        if (a.handle === 'eyeshd') return -1;
        if (b.handle === 'eyeshd') return 1;
        if (a.isVerified && !b.isVerified) return -1;
        if (!a.isVerified && b.isVerified) return 1;
        return (b.followers?.length || 0) - (a.followers?.length || 0);
      });
      setSuggestedAccounts(sorted.slice(0, 8));

      // Trending videos
      const validVideos = allVideos
        .filter(v => !v.isRemoved)
        .map(v => ({
          ...v,
          user: mergedUsers.find(u => u.id === v.userId)
        }))
        .sort((a, b) => (b.views || 0) - (a.views || 0));

      setTrendingVideos(validVideos.slice(0, 12));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Listen to search queries in URL e.g. /explore?q=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qParam = params.get('q');
    if (qParam && qParam.trim()) {
      setQuery(qParam.trim());
      executeSearch(qParam.trim());
    }
  }, [location.search]);

  const executeSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    if (isFirebasePartDisabledNow('explore_search')) {
      setExploreOutageError(FIREBASE_OUTAGE_MESSAGE);
      setResults([]);
      return;
    }
    setExploreOutageError(null);
    setActiveQuery(searchTerm.trim());
    setLoading(true);
    setResults([]);

    try {
      const q = searchTerm.trim().toLowerCase();
      const allUsers = await getUsers();
      const allVideos = await getVideos();

      // Merge with seed creators
      const mergedUsers: User[] = [...allUsers];
      SEED_CREATORS.forEach(seed => {
        if (!mergedUsers.some(u => u.handle.toLowerCase() === seed.handle.toLowerCase())) {
          mergedUsers.push(seed);
        }
      });

      // Find users and sort
      const matchedUsers = mergedUsers.filter(u => 
        u.username.toLowerCase().includes(q) || 
        u.handle.toLowerCase().includes(q)
      ).sort((a, b) => {
        const aExact = a.username.toLowerCase() === q || a.handle.toLowerCase() === q;
        const bExact = b.username.toLowerCase() === q || b.handle.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });

      // Find local videos
      const matchedLocalVideos = allVideos.filter(v => {
        if (v.isRemoved) return false;
        const u = mergedUsers.find(user => user.id === v.userId);
        const descMatch = (v.description || '').toLowerCase().includes(q);
        const tagMatch = Array.isArray(v.tags) && v.tags.some(t => t && t.toLowerCase().includes(q));
        const userMatch = (u?.username || '').toLowerCase().includes(q);
        return descMatch || tagMatch || userMatch;
      }).map(v => ({...v, user: mergedUsers.find(u => u.id === v.userId)}));

      const formattedResults = [
        ...matchedUsers.map(u => ({ type: 'user' as const, data: u })),
        ...matchedLocalVideos.map(v => ({ type: 'video' as const, data: v }))
      ];

      setResults(formattedResults);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleTagClick = (tag: string) => {
    const cleanTag = tag.replace('#', '');
    setQuery(cleanTag);
    executeSearch(cleanTag);
  };

  const clearSearch = () => {
    setQuery('');
    setActiveQuery('');
    setResults([]);
  };

  const users = results.filter(r => r.type === 'user').map(r => r.data as User);
  const videos = results.filter(r => r.type === 'video').map(r => r.data as Video & { user: User });

  return (
    <div className="w-full h-full bg-zinc-950 text-white overflow-y-auto hide-scrollbar p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Search Input Bar (Matching Screenshot) */}
        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts and videos..."
            className="w-full bg-[#18181b]/90 border border-zinc-800 rounded-full py-3.5 pl-12 pr-10 outline-none focus:border-zinc-600 transition-colors text-sm text-white placeholder:text-zinc-500 shadow-inner"
          />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          {query && (
            <button 
              type="button" 
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          )}
        </form>

        {(exploreOutageError || isFirebasePartDisabledNow('explore_search')) && (
          <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-500 text-xs font-bold">
            {exploreOutageError || FIREBASE_OUTAGE_MESSAGE}
          </div>
        )}

        {/* Trending Hashtags Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar select-none text-xs">
          <div className="flex items-center gap-1.5 text-red-500 shrink-0 font-bold mr-1">
            <Flame size={16} className="text-red-500 fill-current" />
            <span>Trending:</span>
          </div>
          {TRENDING_TAGS.map(tag => (
            <button 
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all text-xs font-semibold shrink-0 hover:scale-105 active:scale-95"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-3 border-[#FE2C55] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Active Search Results View */}
        {!loading && activeQuery && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <p className="text-sm text-zinc-400">
                Results for "<span className="text-white font-bold">{activeQuery}</span>"
              </p>
              <button 
                onClick={clearSearch}
                className="text-xs text-[#FE2C55] font-bold hover:underline"
              >
                Clear Search
              </button>
            </div>

            {results.length === 0 ? (
              <div className="text-center text-zinc-500 py-16">
                No accounts or videos found for "{activeQuery}"
              </div>
            ) : (
              <div className="space-y-8">
                {users.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold mb-3 text-zinc-200">Accounts</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      {users.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => navigate(`/profile/${u.handle}`)}
                          className="bg-[#121214] hover:bg-[#1a1b1e] border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all shadow-sm group hover:scale-[1.02]"
                        >
                          <div className="relative mb-2.5">
                            <img 
                              src={u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                              alt="" 
                              className="w-14 h-14 rounded-full object-cover border border-zinc-700 group-hover:border-zinc-500 transition-colors"
                            />
                            {u.isVerified && (
                              <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-black rounded-full p-0.5 shadow">
                                <Check size={10} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 max-w-full">
                            <span className="font-bold text-sm text-white truncate">{u.username}</span>
                            {u.isVerified && (
                              <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[9px] font-black shrink-0">
                                ✓
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-400 truncate mt-0.5">@{u.handle}</span>
                          <span className="text-[11px] text-zinc-500 mt-1">
                            {u.followers?.length || 0} followers
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {videos.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold mb-3 text-zinc-200">Videos</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                      {videos.map((video, idx) => (
                        <div 
                          key={video.id + idx} 
                          className="aspect-[9/16] bg-zinc-900 rounded-xl relative overflow-hidden cursor-pointer group border border-zinc-800/60 hover:border-zinc-700"
                          onClick={() => setSelectedVideo(video)}
                        >
                          {video.isYouTube && video.youtubeId ? (
                            <img src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`} className="w-full h-full object-cover" alt="" />
                          ) : video.videoUrl ? (
                            <video src={video.videoUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                              <Play size={24} className="text-zinc-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play size={32} className="text-white drop-shadow-lg" />
                          </div>
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-bold drop-shadow">
                            <Play size={12} className="fill-current" /> {video.views || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Default View (Matching User Screenshot Exactly) */}
        {!loading && !activeQuery && (
          <div className="space-y-8 animate-in fade-in">
            {/* 1. Suggested Accounts Section */}
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Suggested Accounts
                </h2>
              </div>

              {/* 4-column cards grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {suggestedAccounts.map((account) => (
                  <div 
                    key={account.id}
                    onClick={() => navigate(`/profile/${account.handle}`)}
                    className="bg-[#121214] hover:bg-[#1a1b1e] border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-200 shadow-sm group hover:scale-[1.02]"
                  >
                    <div className="relative mb-2.5">
                      <img 
                        src={account.avatarUrl} 
                        alt="" 
                        className="w-14 h-14 rounded-full object-cover border border-zinc-700 group-hover:border-zinc-500 transition-colors"
                      />
                      {account.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-black rounded-full p-0.5 shadow">
                          <Check size={10} strokeWidth={4} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 max-w-full">
                      <span className="font-bold text-sm text-white truncate">{account.username}</span>
                      {account.isVerified && (
                        <span className="w-3.5 h-3.5 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[9px] font-black shrink-0">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-400 truncate mt-0.5">@{account.handle}</span>
                    <span className="text-[11px] text-zinc-500 mt-1">
                      {account.followers?.length || 0} followers
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Trending Now Section */}
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <Flame size={18} className="text-red-500 fill-current" />
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Trending Now
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {trendingVideos.map((video, idx) => (
                  <div 
                    key={video.id + idx} 
                    className="aspect-[9/16] bg-zinc-900 rounded-xl relative overflow-hidden cursor-pointer group border border-zinc-800/60 hover:border-zinc-700 shadow-sm"
                    onClick={() => setSelectedVideo(video)}
                  >
                    {video.isYouTube && video.youtubeId ? (
                      <img src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`} className="w-full h-full object-cover" alt="" />
                    ) : video.videoUrl ? (
                      <video src={video.videoUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Play size={24} className="text-zinc-600" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play size={32} className="text-white drop-shadow-lg" />
                    </div>

                    <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end">
                      <p className="text-[11px] font-bold text-white truncate drop-shadow">
                        @{video.user?.handle || 'creator'}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-300 mt-0.5">
                        <Play size={10} className="fill-current text-white" />
                        <span>{video.views || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Playback Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-in fade-in duration-200">
          <button 
            onClick={() => setSelectedVideo(null)} 
            className="absolute top-4 left-4 z-50 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <div className="w-full h-full max-w-[500px] relative bg-zinc-950">
            <VideoItem 
              video={{...selectedVideo, feedId: selectedVideo.id} as any} 
              onMinimize={() => setSelectedVideo(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// CENTRALTOK LIVE STREAMING HUB & STUDIO
// ==========================================

const LIVE_CATEGORIES: LiveStream['category'][] = [
  'Just Chatting',
  'Gaming',
  'Music',
  'Creative',
  'Q&A',
  'Study Room'
];

const LIVE_REACTIONS = ['❤️', '🔥', '😂', '👏', '🚀', '🎉'];

const LIVE_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'e8dd65c92f64151e7a04731c',
      credential: 'L7/tY+K2mD4N8rQv'
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'e8dd65c92f64151e7a04731c',
      credential: 'L7/tY+K2mD4N8rQv'
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65c92f64151e7a04731c',
      credential: 'L7/tY+K2mD4N8rQv'
    }
  ],
  iceCandidatePoolSize: 10,
};

// Module-level handoff stream so navigating from Setup Modal -> /live/:streamId preserves permissions cleanly
let pendingHostStream: MediaStream | null = null;

function formatElapsed(startedAt: number, now: number) {
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function Live() {
  const { streamId } = useParams<{ streamId?: string }>();
  if (streamId) {
    return <LiveBroadcastRoom streamId={streamId} />;
  }
  return <LiveDirectory />;
}

function LiveDirectory() {
  const { currentUser, setShowAuthModal } = useAppStore();
  const navigate = useNavigate();

  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  // Go Live Setup Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<LiveStream['category']>('Just Chatting');
  const [sourceInput, setSourceInput] = useState<LiveStream['sourceType']>('camera');
  const [chatEnabledInput, setChatEnabledInput] = useState(true);
  const [slowModeInput, setSlowModeInput] = useState<number>(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsub = subscribeToLiveStreams(setStreams);
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const stopPreviewTracks = (stream: MediaStream | null) => {
    stream?.getTracks().forEach(t => t.stop());
  };

  const captureBroadcastMedia = async (source: LiveStream['sourceType']): Promise<MediaStream> => {
    if (source === 'screen') {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getAudioTracks().forEach(track => displayStream.addTrack(track));
      } catch {
        // Screen share still works without mic if user declines mic
      }
      return displayStream;
    }
    if (source === 'audio') {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  };

  const handleOpenSetup = () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (isFirebasePartDisabledNow('live_streams')) {
      setPreviewError(FIREBASE_OUTAGE_MESSAGE);
      return;
    }
    setTitleInput(`${currentUser.username}'s Live Stream`);
    setPreviewError(null);
    setShowSetupModal(true);
  };

  const handleTestPreview = async (source: LiveStream['sourceType']) => {
    setSourceInput(source);
    setPreviewError(null);
    stopPreviewTracks(previewStream);
    setPreviewStream(null);
    try {
      const media = await captureBroadcastMedia(source);
      setPreviewStream(media);
    } catch (err: any) {
      setPreviewError(err?.message || 'Permission denied or device unavailable.');
    }
  };

  const handleCloseSetup = () => {
    stopPreviewTracks(previewStream);
    setPreviewStream(null);
    setPreviewError(null);
    setShowSetupModal(false);
  };

  const handleStartLive = async () => {
    if (!currentUser) return;
    if (isFirebasePartDisabledNow('live_streams')) {
      setPreviewError(FIREBASE_OUTAGE_MESSAGE);
      return;
    }
    setIsStarting(true);
    setPreviewError(null);
    try {
      let media = previewStream;
      if (!media || media.getTracks().every(t => t.readyState === 'ended')) {
        media = await captureBroadcastMedia(sourceInput);
      }
      const newStreamId = `live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newStream: LiveStream = {
        id: newStreamId,
        isLiveStream: true,
        hostId: currentUser.id,
        hostUsername: currentUser.username,
        hostHandle: currentUser.handle,
        hostAvatar: currentUser.avatarUrl,
        hostVerified: Boolean(currentUser.isVerified),
        hostCentralPro: Boolean(currentUser.isCentralPro),
        title: titleInput.trim() || `${currentUser.username}'s Live Stream`,
        category: categoryInput,
        sourceType: sourceInput,
        status: 'live',
        viewers: [currentUser.id],
        peakViewers: 1,
        likes: 0,
        chatEnabled: chatEnabledInput,
        slowModeSec: slowModeInput,
        pinnedMessage: null,
        mutedChatters: [],
        bannedChatters: [],
        poll: null,
        activeQuestion: null,
        recentReaction: null,
        startedAt: Date.now(),
        updatedAt: Date.now()
      };

      pendingHostStream = media;
      await createLiveStream(newStream);
      setPreviewStream(null);
      setShowSetupModal(false);
      navigate(`/live/${newStreamId}`);
    } catch (err: any) {
      setPreviewError(err?.message || 'Could not access camera/screen. Please allow media permissions.');
    } finally {
      setIsStarting(false);
    }
  };

  const filteredStreams = streams.filter(s => {
    if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.hostUsername.toLowerCase().includes(q) ||
        s.hostHandle.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full h-full bg-[#09090b] text-white overflow-y-auto hide-scrollbar p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Studio Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FE2C55] text-white text-[11px] font-black uppercase tracking-widest shadow-[0_0_16px_rgba(254,44,85,0.45)]">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                LIVE
              </span>
              <span className="text-xs font-bold text-zinc-400">
                {streams.length} {streams.length === 1 ? 'creator streaming' : 'creators streaming'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              CentralTok <span className="text-[#FE2C55]">Broadcasts</span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Watch live gameplay, music sessions, and hangouts with real-time chat, polls, and Q&amp;A.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search live streams..."
                className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 focus:border-[#FE2C55] rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={handleOpenSetup}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FE2C55] to-rose-600 hover:from-[#e6244b] hover:to-rose-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#FE2C55]/25 transition-all active:scale-95"
            >
              <Radio size={16} />
              <span>Go Live</span>
            </button>
          </div>
        </div>

        {(previewError || isFirebasePartDisabledNow('live_streams')) && !showSetupModal && (
          <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold">
            {previewError || FIREBASE_OUTAGE_MESSAGE}
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {['All', ...LIVE_CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? 'bg-[#FE2C55] text-white border-[#FE2C55] shadow-md shadow-[#FE2C55]/20'
                  : 'bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Active Streams Grid */}
        {filteredStreams.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-[#FE2C55]/15 border border-[#FE2C55]/30 flex items-center justify-center text-[#FE2C55]">
              <Radio size={36} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">
                {searchQuery || selectedCategory !== 'All' ? 'No matching live streams' : 'No live broadcasts right now'}
              </h3>
              <p className="text-sm text-zinc-400 mt-1 max-w-md mx-auto">
                Start streaming your camera, screen gameplay, or a live music hangout — viewers can join with real-time chat, polls, and reactions.
              </p>
            </div>
            <button
              onClick={handleOpenSetup}
              className="px-6 py-3 bg-[#FE2C55] hover:bg-[#e6244b] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#FE2C55]/25 transition-all active:scale-95 flex items-center gap-2"
            >
              <Radio size={15} />
              Start the First Stream
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredStreams.map(stream => {
              const viewerCount = (stream.viewers || []).length;
              return (
                <div
                  key={stream.id}
                  onClick={() => navigate(`/live/${stream.id}`)}
                  className="group cursor-pointer rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-[#FE2C55]/60 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-[#FE2C55]/10 flex flex-col"
                >
                  {/* Preview Stage */}
                  <div className="relative aspect-video bg-zinc-950 overflow-hidden flex items-center justify-center">
                    <img
                      src={stream.hostAvatar}
                      alt=""
                      className="w-full h-full object-cover opacity-30 blur-xl scale-110 group-hover:scale-125 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />

                    {/* Center Avatar Stage */}
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <div className="relative">
                        <img
                          src={stream.hostAvatar}
                          alt={stream.hostUsername}
                          className="w-16 h-16 rounded-full object-cover border-2 border-[#FE2C55] shadow-lg"
                        />
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#FE2C55] text-white text-[9px] font-black uppercase rounded tracking-wider shadow">
                          LIVE
                        </span>
                      </div>
                    </div>

                    {/* Top Left: Timer & Source */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                      <span className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-mono font-bold text-white flex items-center gap-1 border border-white/10">
                        <Clock size={11} className="text-[#FE2C55]" />
                        {formatElapsed(stream.startedAt, nowTick)}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-zinc-200 flex items-center gap-1 border border-white/10">
                        {stream.sourceType === 'screen' ? <Monitor size={11} className="text-cyan-400" /> : stream.sourceType === 'audio' ? <Mic size={11} className="text-emerald-400" /> : <VideoIcon size={11} className="text-pink-400" />}
                        {stream.sourceType === 'screen' ? 'Screen' : stream.sourceType === 'audio' ? 'Audio' : 'Camera'}
                      </span>
                    </div>

                    {/* Top Right: Viewers & Likes */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                      <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1 border border-white/10">
                        <Eye size={12} className="text-[#25F4EE]" />
                        {viewerCount}
                      </span>
                      {(stream.likes || 0) > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-bold text-pink-400 flex items-center gap-1 border border-white/10">
                          <Heart size={11} className="fill-current" />
                          {stream.likes}
                        </span>
                      )}
                    </div>

                    {/* Bottom Watch Prompt on Hover */}
                    <div className="absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-3 py-1.5 rounded-lg bg-[#FE2C55] text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg">
                        <Play size={11} className="fill-current" /> Watch
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 flex items-start gap-3">
                    <img
                      src={stream.hostAvatar}
                      alt={stream.hostUsername}
                      className="w-10 h-10 rounded-full object-cover border border-zinc-700 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-white truncate group-hover:text-[#FE2C55] transition-colors">
                        {stream.title}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs font-semibold text-zinc-300 truncate">{stream.hostUsername}</span>
                        {stream.hostVerified && <HolographicBadge />}
                        {stream.hostCentralPro && <CentralProBadge />}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                          {stream.category}
                        </span>
                        {stream.poll?.active && (
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1">
                            <BarChart3 size={10} /> Poll Live
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Go Live Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FE2C55]/20 text-[#FE2C55] flex items-center justify-center">
                  <Radio size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white tracking-tight">Go Live Studio</h2>
                  <p className="text-[11px] text-zinc-400">Configure your broadcast &amp; check media before starting</p>
                </div>
              </div>
              <button onClick={handleCloseSetup} className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-900">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Media Preview Box */}
              <div className="relative aspect-video rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                {previewStream && sourceInput !== 'audio' ? (
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-contain ${sourceInput === 'camera' ? '-scale-x-100 object-cover' : ''}`}
                  />
                ) : previewStream && sourceInput === 'audio' ? (
                  <div className="flex flex-col items-center gap-3 text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                      <Mic size={28} />
                    </div>
                    <p className="text-sm font-bold text-white">Microphone Stage Ready</p>
                    <p className="text-xs text-zinc-400">Audio-only live broadcast is armed.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center p-6">
                    <VideoIcon size={32} className="text-zinc-600" />
                    <p className="text-xs font-semibold text-zinc-400">Click &quot;Preview Source&quot; or choose Camera / Screen below</p>
                    <button
                      type="button"
                      onClick={() => handleTestPreview(sourceInput)}
                      className="mt-1 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
                    >
                      Preview {sourceInput === 'screen' ? 'Screen Share' : sourceInput === 'audio' ? 'Microphone' : 'Camera'}
                    </button>
                  </div>
                )}

                {previewStream && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                    Preview Active
                  </span>
                )}
              </div>

              {previewError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                  {previewError}
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Stream Title
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="What are you streaming today?"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#FE2C55] rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
              </div>

              {/* Video Source */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Broadcast Source
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'camera' as const, label: 'Camera + Mic', icon: VideoIcon },
                    { id: 'screen' as const, label: 'Screen Share', icon: Monitor },
                    { id: 'audio' as const, label: 'Audio Stage', icon: Mic }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleTestPreview(opt.id)}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        sourceInput === opt.id
                          ? 'bg-[#FE2C55]/15 border-[#FE2C55] text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <opt.icon size={18} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {LIVE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryInput(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        categoryInput === cat
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat & Moderation Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setChatEnabledInput(v => !v)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-left"
                >
                  <div>
                    <p className="text-xs font-bold text-white">Live Chat</p>
                    <p className="text-[11px] text-zinc-400">{chatEnabledInput ? 'Viewers can chat live' : 'Chat disabled'}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${chatEnabledInput ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {chatEnabledInput ? 'ON' : 'OFF'}
                  </span>
                </button>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div>
                    <p className="text-xs font-bold text-white">Slow Mode</p>
                    <p className="text-[11px] text-zinc-400">Cooldown between messages</p>
                  </div>
                  <select
                    value={slowModeInput}
                    onChange={(e) => setSlowModeInput(Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none"
                  >
                    <option value={0}>Off</option>
                    <option value={3}>3s</option>
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3 bg-zinc-950">
              <button
                type="button"
                onClick={handleCloseSetup}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isStarting}
                onClick={handleStartLive}
                className="px-6 py-2.5 rounded-xl bg-[#FE2C55] hover:bg-[#e6244b] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-[#FE2C55]/25 disabled:opacity-50 flex items-center gap-2"
              >
                <Radio size={15} />
                <span>{isStarting ? 'Starting Broadcast...' : 'Start Live Broadcast'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FloatingReaction = {
  id: string;
  emoji: string;
  leftPct: number;
};

function LiveBroadcastRoom({ streamId }: { streamId: string }) {
  const { currentUser, setCurrentUser, setShowAuthModal } = useAppStore();
  const navigate = useNavigate();

  const [guestViewerId] = useState<string>(() => {
    const existing = sessionStorage.getItem('ct_live_guest_id');
    if (existing) return existing;
    const id = `guest_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('ct_live_guest_id', id);
    return id;
  });

  const viewerId = currentUser?.id || guestViewerId;

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [streamLoaded, setStreamLoaded] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());

  // Media / WebRTC UI State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [isMutedPlayback, setIsMutedPlayback] = useState(false);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState<string>('Connecting stream...');
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Interactive Right Panel & Controls State
  const [rightTab, setRightTab] = useState<'chat' | 'polls' | 'viewers'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [isQuestionMode, setIsQuestionMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; senderName: string; content: string } | null>(null);
  const [lastSentAt, setLastSentAt] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Host Modals
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Yes', 'No']);
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [pinDraft, setPinDraft] = useState('');

  const videoStageRef = useRef<HTMLDivElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const hostAppliedAnswersRef = useRef<Set<string>>(new Set());
  const hostAppliedCandidatesRef = useRef<Set<string>>(new Set());
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const viewerAppliedOfferRef = useRef<string>('');
  const viewerAppliedCandidatesRef = useRef<Set<string>>(new Set());
  const seenReactionIdsRef = useRef<Set<string>>(new Set());

  const isHost = Boolean(currentUser && stream && stream.hostId === currentUser.id);
  const isMod = Boolean(currentUser && (currentUser.role === 'owner' || currentUser.role === 'staff'));

  // 1. Load users & subscribe to stream metadata + live chat
  useEffect(() => {
    getUsers().then(users => setAllUsers(users)).catch(() => {});
    const unsubStream = subscribeToLiveStream(streamId, (s) => {
      setStream(s);
      setStreamLoaded(true);
    });
    const unsubChat = subscribeToLiveChat(streamId, (msgs) => {
      setChatMessages(msgs);
    });
    const ticker = setInterval(() => setNowTick(Date.now()), 1000);

    return () => {
      unsubStream();
      unsubChat();
      clearInterval(ticker);
    };
  }, [streamId]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Spawn floating emojis on new reactions
  const spawnFloatingEmoji = (emoji: string) => {
    const id = `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const leftPct = 10 + Math.random() * 75;
    setFloatingReactions(prev => [...prev.slice(-18), { id, emoji, leftPct }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2200);
  };

  useEffect(() => {
    const rx = stream?.recentReaction;
    if (!rx?.id || seenReactionIdsRef.current.has(rx.id)) return;
    seenReactionIdsRef.current.add(rx.id);
    if (Date.now() - rx.timestamp < 10000) {
      spawnFloatingEmoji(rx.emoji);
    }
  }, [stream?.recentReaction?.id]);

  // 2. Host Media Initialization (adopt pendingHostStream or capture fresh media)
  useEffect(() => {
    if (!isHost || !stream || stream.status !== 'live') return;

    let cancelled = false;

    const initHostMedia = async () => {
      let media = pendingHostStream;
      pendingHostStream = null;

      if (!media || media.getTracks().every(t => t.readyState === 'ended')) {
        try {
          if (stream.sourceType === 'screen') {
            media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          } else if (stream.sourceType === 'audio') {
            media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } else {
            media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          }
        } catch (err: any) {
          if (!cancelled) {
            setMediaError(err?.message || 'Camera/Screen permission is required to broadcast.');
          }
          return;
        }
      }

      if (cancelled) {
        media.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = media;
      setLocalStream(media);
      setMediaError(null);
      setConnectionLabel('Broadcasting Live');
    };

    initHostMedia();

    return () => {
      cancelled = true;
    };
  }, [isHost, stream?.id, stream?.status]);

  useEffect(() => {
    if (hostVideoRef.current && localStream) {
      hostVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // 3. Host Heartbeat + Viewer Registration
  useEffect(() => {
    if (!stream || stream.status !== 'live') return;
    if (isHost) {
      const hb = setInterval(() => {
        const count = (stream.viewers || []).length;
        const peak = Math.max(stream.peakViewers || 1, count);
        updateLiveStream(streamId, { peakViewers: peak });
      }, 30000);

      const handleBeforeUnload = () => {
        // Best effort signal when closing tab
        localStreamRef.current?.getTracks().forEach(t => t.stop());
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        clearInterval(hb);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      joinLiveStream(streamId, viewerId);
      return () => {
        leaveLiveStream(streamId, viewerId);
        cleanupLiveRtcForViewer(streamId, viewerId);
      };
    }
  }, [streamId, isHost, viewerId, stream?.status]);

  // Cleanup host streams & peers on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      hostPeersRef.current.forEach(pc => pc.close());
      hostPeersRef.current.clear();
      viewerPeerRef.current?.close();
      viewerPeerRef.current = null;
    };
  }, []);

  // 4. WebRTC Host 1-to-N Broadcast Signaling Loop
  const [hostPeerRetryTick, setHostPeerRetryTick] = useState(0);

  useEffect(() => {
    if (!isHost || !stream || stream.status !== 'live' || !localStream) return;

    const activeViewers = (stream.viewers || []).filter(vid => vid && vid !== stream.hostId);

    // Close peer connections for viewers who left
    for (const [vid, pc] of hostPeersRef.current.entries()) {
      if (!activeViewers.includes(vid)) {
        pc.close();
        hostPeersRef.current.delete(vid);
      }
    }

    // Create offers for new viewers (or retry failed cross-WiFi peers)
    activeViewers.forEach(async (vid) => {
      if (hostPeersRef.current.has(vid)) return;

      const pc = new RTCPeerConnection(LIVE_ICE_SERVERS);
      hostPeersRef.current.set(vid, pc);

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          addLiveRtcCandidate(streamId, vid, 'host', e.candidate.toJSON());
        }
      };

      const recoverPeer = () => {
        if (hostPeersRef.current.get(vid) === pc) {
          try { pc.close(); } catch {}
          hostPeersRef.current.delete(vid);
          setTimeout(() => setHostPeerRetryTick(t => t + 1), 1500);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          recoverPeer();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          try {
            pc.restartIce?.();
          } catch {
            recoverPeer();
          }
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendLiveRtcOffer(streamId, stream.hostId, vid, { type: offer.type, sdp: offer.sdp });
      } catch (err) {
        console.warn('Error creating host offer for viewer:', vid, err);
      }
    });
  }, [isHost, stream?.viewers, stream?.status, localStream, streamId, hostPeerRetryTick]);

  useEffect(() => {
    if (!isHost || !stream || stream.status !== 'live') return;

    const flushViewerCandidates = async (pc: RTCPeerConnection, sig: LiveRtcSignal) => {
      if (!Array.isArray(sig.viewerCandidates) || !pc.remoteDescription) return;
      for (const cand of sig.viewerCandidates) {
        const key = `${sig.id}_v_${JSON.stringify(cand)}`;
        if (!hostAppliedCandidatesRef.current.has(key)) {
          hostAppliedCandidatesRef.current.add(key);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
      }
    };

    const unsubSignals = subscribeToLiveRtcHost(streamId, async (signals: LiveRtcSignal[]) => {
      for (const sig of signals) {
        const pc = hostPeersRef.current.get(sig.viewerId);
        if (!pc) continue;

        if (sig.answer && !hostAppliedAnswersRef.current.has(`${sig.id}_${sig.answer.sdp?.slice(0, 24)}`)) {
          hostAppliedAnswersRef.current.add(`${sig.id}_${sig.answer.sdp?.slice(0, 24)}`);
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.answer));
            }
          } catch (err) {
            console.warn('Host failed setting remote answer:', err);
          }
        }

        await flushViewerCandidates(pc, sig);
      }
    });

    return () => unsubSignals();
  }, [isHost, stream?.status, streamId]);

  // 5. WebRTC Viewer Receive Signaling Loop
  useEffect(() => {
    if (isHost || !stream || stream.status !== 'live') return;

    const flushHostCandidates = async (pc: RTCPeerConnection, sig: LiveRtcSignal) => {
      if (!pc.remoteDescription || !Array.isArray(sig.hostCandidates)) return;
      for (const cand of sig.hostCandidates) {
        const key = `${sig.id}_h_${JSON.stringify(cand)}`;
        if (!viewerAppliedCandidatesRef.current.has(key)) {
          viewerAppliedCandidatesRef.current.add(key);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
      }
    };

    const unsubViewer = subscribeToLiveRtcViewer(streamId, viewerId, async (sig) => {
      if (!sig || !sig.offer?.sdp) return;

      const offerKey = `${sig.id}_${sig.offer.sdp.slice(0, 32)}`;
      if (viewerAppliedOfferRef.current !== offerKey) {
        viewerAppliedOfferRef.current = offerKey;
        viewerAppliedCandidatesRef.current.clear();
        viewerPeerRef.current?.close();

        const pc = new RTCPeerConnection(LIVE_ICE_SERVERS);
        viewerPeerRef.current = pc;

        const inboundStream = new MediaStream();
        pc.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach(t => {
            if (!inboundStream.getTracks().some(existing => existing.id === t.id)) {
              inboundStream.addTrack(t);
            }
          });
          if (event.track && !inboundStream.getTracks().some(existing => existing.id === event.track.id)) {
            inboundStream.addTrack(event.track);
          }
          setRemoteStream(new MediaStream(inboundStream.getTracks()));
          setConnectionLabel('Live HD');
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            addLiveRtcCandidate(streamId, viewerId, 'viewer', e.candidate.toJSON());
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setConnectionLabel('Live Connected');
          } else if (pc.connectionState === 'connecting') {
            setConnectionLabel('Connecting...');
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            setConnectionLabel('Reconnecting...');
          }
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendLiveRtcAnswer(streamId, viewerId, { type: answer.type, sdp: answer.sdp });
        } catch (err) {
          console.warn('Viewer failed answering offer:', err);
        }
      }

      const pc = viewerPeerRef.current;
      if (pc) {
        await flushHostCandidates(pc, sig);
      }
    });

    return () => {
      unsubViewer();
      viewerPeerRef.current?.close();
      viewerPeerRef.current = null;
      viewerAppliedOfferRef.current = '';
    };
  }, [isHost, stream?.status, streamId, viewerId]);

  useEffect(() => {
    const vid = viewerVideoRef.current;
    if (!vid || !remoteStream) return;
    vid.srcObject = remoteStream;
    vid.muted = isMutedPlayback;
    vid.volume = isMutedPlayback ? 0 : playbackVolume;
    vid.play().catch(() => {
      setNeedsUserGesture(true);
      vid.muted = true;
      setIsMutedPlayback(true);
      vid.play().catch(() => {});
    });
  }, [remoteStream]);

  useEffect(() => {
    const vid = viewerVideoRef.current;
    if (!vid) return;
    vid.muted = isMutedPlayback;
    vid.volume = isMutedPlayback ? 0 : playbackVolume;
  }, [isMutedPlayback, playbackVolume]);

  // Host Controls Handlers
  const handleToggleMic = () => {
    const streamObj = localStreamRef.current;
    if (!streamObj) return;
    const nextMuted = !isMicMuted;
    streamObj.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
    setIsMicMuted(nextMuted);
  };

  const handleToggleCamera = () => {
    const streamObj = localStreamRef.current;
    if (!streamObj) return;
    const nextOff = !isCamOff;
    streamObj.getVideoTracks().forEach(t => { t.enabled = !nextOff; });
    setIsCamOff(nextOff);
  };

  const handleSwitchSourceLive = async (nextSource: 'camera' | 'screen') => {
    if (!isHost || !stream) return;
    try {
      const nextMedia = nextSource === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      const newVideoTrack = nextMedia.getVideoTracks()[0];
      const newAudioTrack = nextMedia.getAudioTracks()[0] || localStreamRef.current?.getAudioTracks()[0];

      // Replace tracks across all active viewer peer connections seamlessly
      hostPeersRef.current.forEach(pc => {
        const senders = pc.getSenders();
        if (newVideoTrack) {
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) videoSender.replaceTrack(newVideoTrack);
        }
        if (newAudioTrack) {
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          if (audioSender) audioSender.replaceTrack(newAudioTrack);
        }
      });

      // Keep existing mic if screen share didn't include audio
      if (nextSource === 'screen' && !nextMedia.getAudioTracks().length && localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => nextMedia.addTrack(t));
      } else {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
      }

      localStreamRef.current = nextMedia;
      setLocalStream(nextMedia);
      setIsCamOff(false);
      await updateLiveStream(streamId, { sourceType: nextSource });
    } catch (err: any) {
      setMediaError(err?.message || 'Unable to switch broadcast source.');
    }
  };

  const handleEndBroadcast = async () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    hostPeersRef.current.forEach(pc => pc.close());
    hostPeersRef.current.clear();
    await endLiveStream(streamId);
    navigate('/live');
  };

  // Interactive Chat & Actions
  const slowRemainingSec = (!isHost && stream?.slowModeSec && lastSentAt)
    ? Math.max(0, Math.ceil((lastSentAt + stream.slowModeSec * 1000 - nowTick) / 1000))
    : 0;

  const isChatterMuted = Boolean(currentUser && stream?.mutedChatters?.includes(currentUser.id));

  const handleSendChat = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (isFirebasePartDisabledNow('live_streams')) {
      setMediaError(FIREBASE_OUTAGE_MESSAGE);
      return;
    }
    if (!stream || (!stream.chatEnabled && !isHost) || isChatterMuted || slowRemainingSec > 0) return;

    const raw = (overrideText ?? chatInput).trim();
    if (!raw) return;

    const formattedContent = isQuestionMode && !raw.startsWith('[Q&A]') ? `[Q&A] ${raw}` : raw;
    const msg: Message = {
      id: `live_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fromUserId: currentUser.id,
      groupId: `live_chat_${streamId}`,
      content: formattedContent,
      timestamp: Date.now(),
      ...(replyingTo ? { replyTo: { id: replyingTo.id, senderName: replyingTo.senderName, content: replyingTo.content } } : {})
    };

    if (!overrideText) {
      setChatInput('');
      setIsQuestionMode(false);
      setReplyingTo(null);
    }
    setLastSentAt(Date.now());
    await sendLiveChatMessage(streamId, msg);
  };

  const handleReactionClick = async (emoji: string) => {
    if (isFirebasePartDisabledNow('live_streams')) {
      setMediaError(FIREBASE_OUTAGE_MESSAGE);
      return;
    }
    spawnFloatingEmoji(emoji);
    await sendLiveReaction(streamId, emoji, currentUser?.username || 'Guest');
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFirebasePartDisabledNow('live_streams')) {
      setMediaError(FIREBASE_OUTAGE_MESSAGE);
      return;
    }
    if (!isHost || !pollQuestion.trim()) return;
    const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) return;

    const newPoll: LivePoll = {
      id: `poll_${Date.now()}`,
      question: pollQuestion.trim(),
      options: cleanOptions,
      votes: {},
      active: true,
      createdAt: Date.now()
    };
    await updateLiveStream(streamId, { poll: newPoll });
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['Yes', 'No']);
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost) return;
    await updateLiveStream(streamId, { pinnedMessage: pinDraft.trim() || null });
    setShowPinEditor(false);
  };

  const handleFollowHost = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (!stream || currentUser.id === stream.hostId) return;
    const targetUser = allUsers.find(u => u.id === stream.hostId);
    const isCurrentlyFollowing = (currentUser.following || []).includes(stream.hostId);
    const nextFollowing = isCurrentlyFollowing
      ? (currentUser.following || []).filter(id => id !== stream.hostId)
      : Array.from(new Set([...(currentUser.following || []), stream.hostId]));
    setCurrentUser({ ...currentUser, following: nextFollowing });
    await updateUser(currentUser.id, { following: nextFollowing });
    if (targetUser) {
      const nextFollowers = isCurrentlyFollowing
        ? (targetUser.followers || []).filter(id => id !== currentUser.id)
        : Array.from(new Set([...(targetUser.followers || []), currentUser.id]));
      await updateUser(targetUser.id, { followers: nextFollowers });
    }
  };

  const handleCopyShareLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleFullscreen = () => {
    if (!videoStageRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoStageRef.current.requestFullscreen?.().catch(() => {});
    }
  };

  const handlePiP = async () => {
    const el = isHost ? hostVideoRef.current : viewerVideoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await el.requestPictureInPicture();
      }
    } catch {}
  };

  if (streamLoaded && (!stream || stream.status === 'ended')) {
    return (
      <div className="w-full h-full bg-[#09090b] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-zinc-900/90 border border-zinc-800 p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
            <Radio size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Broadcast Ended</h2>
            <p className="text-sm text-zinc-400 mt-1">
              {stream ? `${stream.hostUsername}'s stream "${stream.title}" has wrapped up.` : 'This live stream could not be found or has already ended.'}
            </p>
          </div>
          {stream && (
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <p className="text-lg font-black text-white">{stream.peakViewers || stream.viewers?.length || 1}</p>
                <p className="text-[10px] font-bold uppercase text-zinc-500">Peak Viewers</p>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <p className="text-lg font-black text-[#FE2C55]">{stream.likes || 0}</p>
                <p className="text-[10px] font-bold uppercase text-zinc-500">Total Likes</p>
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/live')}
            className="w-full py-3 rounded-xl bg-[#FE2C55] hover:bg-[#e6244b] text-white font-black text-xs uppercase tracking-widest transition-colors"
          >
            Back to LIVE Lobby
          </button>
        </div>
      </div>
    );
  }

  if (currentUser && stream?.bannedChatters?.includes(currentUser.id)) {
    return (
      <div className="w-full h-full bg-[#09090b] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-zinc-900 border border-red-900/50 p-8 text-center space-y-4">
          <Ban size={40} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-black">Removed from Stream</h2>
          <p className="text-sm text-zinc-400">You were removed by the broadcaster.</p>
          <button onClick={() => navigate('/live')} className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold">
            Return to LIVE
          </button>
        </div>
      </div>
    );
  }

  const viewerIds = stream?.viewers || [];
  const loggedInViewers = viewerIds
    .map(id => allUsers.find(u => u.id === id))
    .filter((u): u is User => Boolean(u));
  const guestCount = Math.max(0, viewerIds.length - loggedInViewers.length);
  const questionMessages = chatMessages.filter(m => m.content.startsWith('[Q&A]'));
  const isFollowingHost = Boolean(currentUser && stream && (currentUser.following || []).includes(stream.hostId));
  const activePoll = stream?.poll;
  const pollTotalVotes = activePoll ? Object.keys(activePoll.votes || {}).length : 0;

  return (
    <div className="w-full h-full bg-[#09090b] text-white flex flex-col lg:flex-row overflow-hidden">
      {/* LEFT: Broadcast Video Stage */}
      <div className="flex-1 min-w-0 flex flex-col bg-black relative">
        {/* Top Broadcast Bar */}
        <div className="px-4 py-3 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/live')}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white shrink-0"
              title="Back to LIVE Directory"
            >
              <ArrowLeft size={18} />
            </button>

            {stream && (
              <div className="flex items-center gap-2.5 min-w-0">
                <Link to={`/profile/${stream.hostHandle}`} className="relative shrink-0">
                  <img
                    src={stream.hostAvatar}
                    alt={stream.hostUsername}
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#FE2C55]"
                  />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black text-white truncate">{stream.title}</h2>
                    <span className="px-2 py-0.5 rounded bg-[#FE2C55] text-white text-[9px] font-black uppercase tracking-wider shrink-0">
                      LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <Link to={`/profile/${stream.hostHandle}`} className="font-semibold text-zinc-300 hover:underline flex items-center gap-1 truncate">
                      <span>@{stream.hostHandle}</span>
                      {stream.hostVerified && <HolographicBadge />}
                      {stream.hostCentralPro && <CentralProBadge />}
                    </Link>
                    <span>•</span>
                    <span>{stream.category}</span>
                    <span>•</span>
                    <span className="font-mono text-zinc-300">{formatElapsed(stream.startedAt, nowTick)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isHost && stream && (
              <button
                onClick={handleFollowHost}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  isFollowingHost
                    ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                    : 'bg-[#FE2C55] hover:bg-[#e6244b] text-white shadow-md shadow-[#FE2C55]/25'
                }`}
              >
                {isFollowingHost ? 'Following' : 'Follow'}
              </button>
            )}

            <button
              onClick={() => setRightTab('viewers')}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-white flex items-center gap-1.5 hover:border-zinc-700"
            >
              <Eye size={14} className="text-[#25F4EE]" />
              <span>{viewerIds.length}</span>
            </button>

            <button
              onClick={handleCopyShareLink}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
              title="Copy stream link"
            >
              {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
            </button>

            {isHost && (
              <button
                onClick={handleEndBroadcast}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/25"
              >
                End Live
              </button>
            )}
          </div>
        </div>

        {/* Center Video / Audio Stage */}
        <div ref={videoStageRef} className="flex-1 min-h-[240px] relative bg-zinc-950 flex items-center justify-center overflow-hidden">
          {isHost ? (
            stream?.sourceType === 'audio' ? (
              <div className="flex flex-col items-center gap-4 text-center p-8">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-[#FE2C55]/20 animate-ping" />
                  <img src={stream.hostAvatar} alt="" className="relative w-28 h-28 rounded-full object-cover border-4 border-[#FE2C55]" />
                </div>
                <div>
                  <p className="text-lg font-black text-white">Audio Stage Live</p>
                  <p className="text-xs text-zinc-400 mt-1">{isMicMuted ? 'Microphone is muted' : 'Streaming crystal-clear audio to viewers'}</p>
                </div>
              </div>
            ) : (
              <video
                ref={hostVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full ${stream?.sourceType === 'screen' ? 'object-contain' : `object-cover ${isMirrored ? '-scale-x-100' : ''}`}`}
              />
            )
          ) : remoteStream ? (
            stream?.sourceType === 'audio' && remoteStream.getVideoTracks().length === 0 ? (
              <div className="flex flex-col items-center gap-4 text-center p-8">
                <video ref={viewerVideoRef} autoPlay playsInline className="hidden" />
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
                  <img src={stream.hostAvatar} alt="" className="relative w-28 h-28 rounded-full object-cover border-4 border-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-black text-white">{stream.hostUsername} is on Audio Stage</p>
                  <p className="text-xs text-zinc-400 mt-1">Listening live in real time</p>
                </div>
              </div>
            ) : (
              <video
                ref={viewerVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full ${stream?.sourceType === 'screen' ? 'object-contain' : 'object-cover'}`}
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 text-center p-8">
              {stream?.hostAvatar && (
                <img src={stream.hostAvatar} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[#FE2C55] opacity-80 animate-pulse" />
              )}
              <p className="text-sm font-bold text-zinc-300">{connectionLabel}</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                Establishing peer-to-peer WebRTC feed with @{stream?.hostHandle || 'broadcaster'}...
              </p>
            </div>
          )}

          {/* Media Permission Error Overlay */}
          {mediaError && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-30">
              <p className="text-sm font-bold text-red-400 mb-3">{mediaError}</p>
              <button
                onClick={() => handleSwitchSourceLive('camera')}
                className="px-4 py-2 rounded-xl bg-[#FE2C55] text-white text-xs font-bold"
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Browser Autoplay Gesture Prompt for Viewers */}
          {!isHost && needsUserGesture && (
            <button
              onClick={() => {
                setNeedsUserGesture(false);
                setIsMutedPlayback(false);
                if (viewerVideoRef.current) {
                  viewerVideoRef.current.muted = false;
                  viewerVideoRef.current.play().catch(() => {});
                }
              }}
              className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-center"
            >
              <div className="px-6 py-3.5 rounded-2xl bg-[#FE2C55] text-white font-black text-sm flex items-center gap-2 shadow-2xl">
                <Volume2 size={18} />
                <span>Tap to Enable Live Audio</span>
              </div>
            </button>
          )}

          {/* Highlighted Q&A Question Overlay */}
          {stream?.activeQuestion && (
            <div className="absolute bottom-20 left-4 z-20 max-w-sm bg-zinc-950/90 backdrop-blur-md border border-cyan-500/50 rounded-2xl p-3.5 shadow-2xl">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                  <HelpCircle size={11} /> Featured Question • @{stream.activeQuestion.senderHandle}
                </span>
                {isHost && (
                  <button
                    onClick={() => updateLiveStream(streamId, { activeQuestion: null })}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-xs font-semibold text-white">{stream.activeQuestion.text}</p>
            </div>
          )}

          {/* Floating Live Reactions Column */}
          <div className="pointer-events-none absolute inset-y-4 right-4 w-28 overflow-hidden z-20">
            {floatingReactions.map(r => (
              <div
                key={r.id}
                style={{ left: `${r.leftPct}%`, animation: 'floatReactionUp 2.1s ease-out forwards' }}
                className="absolute bottom-4 text-2xl drop-shadow-lg select-none"
              >
                {r.emoji}
              </div>
            ))}
          </div>

          {/* Stage Bottom Controls Overlay */}
          <div className="absolute bottom-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2">
            {/* Playback & Host Media Controls */}
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-1.5">
              {isHost ? (
                <>
                  <button
                    onClick={handleToggleMic}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${isMicMuted ? 'bg-red-500/20 text-red-400' : 'text-white hover:bg-white/10'}`}
                    title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                  >
                    {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  {stream?.sourceType !== 'audio' && (
                    <button
                      onClick={handleToggleCamera}
                      className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${isCamOff ? 'bg-red-500/20 text-red-400' : 'text-white hover:bg-white/10'}`}
                      title={isCamOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {isCamOff ? <VideoOff size={16} /> : <VideoIcon size={16} />}
                    </button>
                  )}
                  <button
                    onClick={() => handleSwitchSourceLive(stream?.sourceType === 'screen' ? 'camera' : 'screen')}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 flex items-center gap-1.5"
                    title="Switch between Camera and Screen Share live"
                  >
                    {stream?.sourceType === 'screen' ? <VideoIcon size={15} className="text-pink-400" /> : <Monitor size={15} className="text-cyan-400" />}
                    <span className="hidden sm:inline">{stream?.sourceType === 'screen' ? 'Use Camera' : 'Share Screen'}</span>
                  </button>
                  {stream?.sourceType === 'camera' && (
                    <button
                      onClick={() => setIsMirrored(m => !m)}
                      className="px-2 py-2 rounded-xl text-[11px] font-bold text-zinc-300 hover:bg-white/10"
                      title="Flip Camera Preview"
                    >
                      Flip
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsMutedPlayback(m => !m)}
                    className="p-2 rounded-xl text-white hover:bg-white/10"
                    title={isMutedPlayback ? 'Unmute Stream' : 'Mute Stream'}
                  >
                    {isMutedPlayback ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMutedPlayback ? 0 : playbackVolume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPlaybackVolume(val);
                      setIsMutedPlayback(val === 0);
                    }}
                    className="w-16 sm:w-20 accent-[#FE2C55] cursor-pointer"
                  />
                </>
              )}

              <button onClick={handlePiP} className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10" title="Picture-in-Picture">
                <PictureInPicture2 size={16} />
              </button>
              <button onClick={handleFullscreen} className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10" title="Fullscreen">
                <Maximize2 size={16} />
              </button>
            </div>

            {/* Host Stream Studio Extras + Reaction Cannon */}
            <div className="flex items-center gap-1.5">
              {isHost && (
                <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-1.5">
                  <button
                    onClick={() => setShowPollCreator(true)}
                    className="px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-xs font-bold text-cyan-300 flex items-center gap-1"
                    title="Launch Live Poll"
                  >
                    <BarChart3 size={14} />
                    <span className="hidden sm:inline">Poll</span>
                  </button>
                  <button
                    onClick={() => {
                      setPinDraft(stream?.pinnedMessage || '');
                      setShowPinEditor(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-xs font-bold text-amber-300 flex items-center gap-1"
                    title="Pin Stream Announcement"
                  >
                    <Pin size={14} />
                    <span className="hidden sm:inline">Pin</span>
                  </button>
                  <button
                    onClick={() => updateLiveStream(streamId, { chatEnabled: !stream?.chatEnabled })}
                    className={`px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-xs font-bold flex items-center gap-1 ${stream?.chatEnabled ? 'text-emerald-300' : 'text-red-400'}`}
                    title="Toggle Live Chat"
                  >
                    <MessageSquare size={14} />
                    <span className="hidden sm:inline">{stream?.chatEnabled ? 'Chat On' : 'Chat Off'}</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-2 py-1.5">
                {LIVE_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className="w-8 h-8 rounded-xl hover:bg-white/15 active:scale-125 transition-transform flex items-center justify-center text-base"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <span className="pl-1 pr-1.5 text-[11px] font-black text-pink-400">
                  {stream?.likes || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Interactive Live Chat, Polls & Viewers Sidebar */}
      <div className="w-full lg:w-[370px] xl:w-[400px] h-[44vh] lg:h-full bg-zinc-950 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col shrink-0">
        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          {[
            { id: 'chat' as const, label: 'Live Chat', icon: MessageSquare },
            { id: 'polls' as const, label: `Polls & Q&A`, icon: BarChart3 },
            { id: 'viewers' as const, label: `Viewers (${viewerIds.length})`, icon: Users }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setRightTab(t.id)}
              className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                rightTab === t.id
                  ? 'border-[#FE2C55] text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <t.icon size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Pinned Banner */}
        {stream?.pinnedMessage && (
          <div className="px-3.5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Pin size={13} className="text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-amber-100 truncate">{stream.pinnedMessage}</p>
            </div>
            {isHost && (
              <button
                onClick={() => updateLiveStream(streamId, { pinnedMessage: null })}
                className="text-amber-400 hover:text-white shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Active Live Poll Card (always accessible on Chat & Polls tabs) */}
        {activePoll && activePoll.active && rightTab !== 'viewers' && (
          <div className="p-3 bg-zinc-900/90 border-b border-zinc-800 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <BarChart3 size={12} /> Live Poll • {pollTotalVotes} {pollTotalVotes === 1 ? 'vote' : 'votes'}
              </span>
              {isHost && (
                <button
                  onClick={() => updateLiveStream(streamId, { poll: null })}
                  className="text-[10px] font-bold text-red-400 hover:underline"
                >
                  End Poll
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-white">{activePoll.question}</p>
            <div className="space-y-1.5">
              {activePoll.options.map((opt, idx) => {
                const votesForOpt = Object.values(activePoll.votes || {}).filter(v => v === idx).length;
                const pct = pollTotalVotes > 0 ? Math.round((votesForOpt / pollTotalVotes) * 100) : 0;
                const hasVotedThis = currentUser && activePoll.votes?.[currentUser.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!currentUser) { setShowAuthModal(true); return; }
                      voteLivePoll(streamId, currentUser.id, idx);
                    }}
                    className={`w-full relative overflow-hidden rounded-xl border text-left px-3 py-1.5 transition-all ${
                      hasVotedThis ? 'border-cyan-400 bg-cyan-500/10' : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-500/20 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{opt}</span>
                      <span className="font-mono text-[11px] text-cyan-300 font-bold">{pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 1: LIVE CHAT */}
        {rightTab === 'chat' && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-8">
                  <MessageSquare size={28} className="mb-2 opacity-40" />
                  <p className="text-xs font-bold">Welcome to LIVE Chat!</p>
                  <p className="text-[11px] mt-0.5">Say hello or switch on Q&amp;A mode below.</p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const sender = allUsers.find(u => u.id === msg.fromUserId);
                  const isMsgHost = msg.fromUserId === stream?.hostId;
                  const isQA = msg.content.startsWith('[Q&A]');
                  const displayText = isQA ? msg.content.replace(/^\[Q&A\]\s*/, '') : msg.content;
                  const isMutedUser = Boolean(stream?.mutedChatters?.includes(msg.fromUserId));

                  return (
                    <div
                      key={msg.id}
                      className={`group rounded-xl p-2 transition-colors ${isQA ? 'bg-cyan-500/10 border border-cyan-500/25' : 'hover:bg-zinc-900/70'}`}
                    >
                      {msg.replyTo && (
                        <div className="text-[10px] text-zinc-400 border-l-2 border-zinc-700 pl-2 mb-1 truncate">
                          Replying to <span className="font-bold text-zinc-300">@{msg.replyTo.senderName}</span>: {msg.replyTo.content}
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <img
                          src={sender?.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + msg.fromUserId}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-1">
                            <span className={`text-xs font-bold ${isMsgHost ? 'text-[#FE2C55]' : 'text-zinc-300'}`}>
                              {sender?.username || 'Viewer'}
                            </span>
                            {isMsgHost && (
                              <span className="px-1.5 py-0.2 rounded bg-[#FE2C55] text-white text-[9px] font-black uppercase">HOST</span>
                            )}
                            {sender?.isVerified && <HolographicBadge />}
                            {sender?.isCentralPro && <CentralProBadge />}
                            {isQA && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase">Q&amp;A</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-100 break-words leading-snug mt-0.5">{displayText}</p>
                        </div>

                        {/* Quick Actions */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                          <button
                            onClick={() => setReplyingTo({ id: msg.id, senderName: sender?.handle || 'viewer', content: displayText })}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                            title="Reply"
                          >
                            <Reply size={12} />
                          </button>
                          {(isHost || isMod) && (
                            <>
                              {isQA && isHost && (
                                <button
                                  onClick={() => updateLiveStream(streamId, {
                                    activeQuestion: {
                                      id: msg.id,
                                      senderName: sender?.username || 'Viewer',
                                      senderHandle: sender?.handle || 'viewer',
                                      text: displayText,
                                      timestamp: msg.timestamp
                                    }
                                  })}
                                  className="p-1 rounded hover:bg-zinc-800 text-cyan-400"
                                  title="Highlight Question on Screen"
                                >
                                  <HelpCircle size={12} />
                                </button>
                              )}
                              {isHost && (
                                <button
                                  onClick={() => updateLiveStream(streamId, { pinnedMessage: `${sender?.username || 'Viewer'}: ${displayText}` })}
                                  className="p-1 rounded hover:bg-zinc-800 text-amber-400"
                                  title="Pin Message"
                                >
                                  <Pin size={12} />
                                </button>
                              )}
                              {!isMsgHost && (
                                <button
                                  onClick={() => {
                                    const currentMuted = stream?.mutedChatters || [];
                                    const next = isMutedUser
                                      ? currentMuted.filter(id => id !== msg.fromUserId)
                                      : Array.from(new Set([...currentMuted, msg.fromUserId]));
                                    updateLiveStream(streamId, { mutedChatters: next });
                                  }}
                                  className="p-1 rounded hover:bg-zinc-800 text-orange-400"
                                  title={isMutedUser ? 'Unmute User' : 'Mute User in Chat'}
                                >
                                  <MicOff size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1 rounded hover:bg-zinc-800 text-red-400"
                                title="Delete Message"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Box */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950 shrink-0 space-y-2">
              {replyingTo && (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                  <span className="truncate">Replying to <strong className="text-white">@{replyingTo.senderName}</strong></span>
                  <button onClick={() => setReplyingTo(null)} className="text-zinc-400 hover:text-white"><X size={13} /></button>
                </div>
              )}

              {(mediaError || isFirebasePartDisabledNow('live_streams')) && (
                <div className="px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-[11px] font-bold">
                  {mediaError || FIREBASE_OUTAGE_MESSAGE}
                </div>
              )}

              {!stream?.chatEnabled && !isHost ? (
                <div className="py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-500 flex items-center justify-center gap-1.5">
                  <Lock size={13} /> Host has turned off chat
                </div>
              ) : isChatterMuted ? (
                <div className="py-2.5 px-3 rounded-xl bg-red-950/30 border border-red-900/40 text-center text-xs text-red-400">
                  You are muted in this live chat
                </div>
              ) : (
                <form onSubmit={handleSendChat} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuestionMode(q => !q)}
                    className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
                      isQuestionMode
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                    title="Send as Q&A Question"
                  >
                    <HelpCircle size={16} />
                  </button>

                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      !currentUser
                        ? 'Log in to chat live...'
                        : isQuestionMode
                        ? 'Ask the host a question...'
                        : 'Send a live message...'
                    }
                    className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 focus:border-[#FE2C55] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 outline-none select-text cursor-text"
                  />

                  <button
                    type="submit"
                    disabled={slowRemainingSec > 0 || !chatInput.trim()}
                    className="px-3.5 py-2.5 rounded-xl bg-[#FE2C55] hover:bg-[#e6244b] disabled:opacity-40 text-white text-xs font-black flex items-center gap-1 shrink-0 transition-all"
                  >
                    {slowRemainingSec > 0 ? <span>{slowRemainingSec}s</span> : <Send size={15} />}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {/* TAB 2: POLLS & Q&A */}
        {rightTab === 'polls' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {isHost && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">Host Poll Studio</h4>
                  <button
                    onClick={() => setShowPollCreator(true)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-[11px] flex items-center gap-1"
                  >
                    <Plus size={13} /> New Poll
                  </button>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Chat Slow Mode</span>
                  <select
                    value={stream?.slowModeSec || 0}
                    onChange={(e) => updateLiveStream(streamId, { slowModeSec: Number(e.target.value) })}
                    className="bg-zinc-800 border border-zinc-700 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none"
                  >
                    <option value={0}>Off</option>
                    <option value={3}>3s</option>
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2.5">
                Viewer Q&amp;A Queue ({questionMessages.length})
              </h4>
              {questionMessages.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-500">
                  No questions submitted yet. Click the <strong className="text-cyan-400">?</strong> icon in chat to ask a question!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {questionMessages.map(qm => {
                    const sender = allUsers.find(u => u.id === qm.fromUserId);
                    const text = qm.content.replace(/^\[Q&A\]\s*/, '');
                    return (
                      <div key={qm.id} className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400">@{sender?.handle || 'viewer'}</span>
                          <span className="text-[10px] text-zinc-500">{new Date(qm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-white">{text}</p>
                        {isHost && (
                          <button
                            onClick={() => updateLiveStream(streamId, {
                              activeQuestion: {
                                id: qm.id,
                                senderName: sender?.username || 'Viewer',
                                senderHandle: sender?.handle || 'viewer',
                                text,
                                timestamp: qm.timestamp
                              }
                            })}
                            className="px-3 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-[11px] font-bold"
                          >
                            Highlight on Screen
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: VIEWERS LIST */}
        {rightTab === 'viewers' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loggedInViewers.map(v => {
              const isViewerHost = v.id === stream?.hostId;
              const isMuted = Boolean(stream?.mutedChatters?.includes(v.id));
              return (
                <div key={v.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                  <Link to={`/profile/${v.handle}`} className="flex items-center gap-2.5 min-w-0">
                    <img src={v.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                        <span>{v.username}</span>
                        {v.isVerified && <HolographicBadge />}
                        {isViewerHost && <span className="px-1.5 py-0.2 bg-[#FE2C55] text-white text-[9px] rounded uppercase font-black">HOST</span>}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">@{v.handle}</p>
                    </div>
                  </Link>

                  {(isHost || isMod) && !isViewerHost && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          const current = stream?.mutedChatters || [];
                          const next = isMuted ? current.filter(id => id !== v.id) : Array.from(new Set([...current, v.id]));
                          updateLiveStream(streamId, { mutedChatters: next });
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${isMuted ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        onClick={() => {
                          const banned = Array.from(new Set([...(stream?.bannedChatters || []), v.id]));
                          const nextViewers = (stream?.viewers || []).filter(id => id !== v.id);
                          updateLiveStream(streamId, { bannedChatters: banned, viewers: nextViewers });
                        }}
                        className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-bold"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {guestCount > 0 && (
              <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-400 text-center">
                + {guestCount} guest {guestCount === 1 ? 'viewer' : 'viewers'} watching
              </div>
            )}
          </div>
        )}
      </div>

      {/* Host Poll Creator Modal */}
      {showPollCreator && isHost && (
        <div className="fixed inset-0 z-[1600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreatePoll} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-cyan-400" /> Launch Live Poll
              </h3>
              <button type="button" onClick={() => setShowPollCreator(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <input
              type="text"
              required
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask viewers a question..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            />
            <div className="space-y-2">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => setPollOptions(prev => prev.map((o, i) => (i === idx ? e.target.value : o)))}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions(prev => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-zinc-500 hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions(prev => [...prev, ''])}
                  className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add Option
                </button>
              )}
            </div>
            <button type="submit" className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs uppercase tracking-wider">
              Launch Poll Now
            </button>
          </form>
        </div>
      )}

      {/* Host Pin Banner Modal */}
      {showPinEditor && isHost && (
        <div className="fixed inset-0 z-[1600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSavePin} className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Pin size={18} className="text-amber-400" /> Pin Chat Announcement
              </h3>
              <button type="button" onClick={() => setShowPinEditor(false)} className="text-zinc-400 hover:text-white"><X size={18} /></button>
            </div>
            <input
              type="text"
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value)}
              placeholder="Write a pinned message for everyone (leave blank to unpin)..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider">
              Save Pinned Message
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

