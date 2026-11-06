import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Play, Compass, Sparkles, Flame, Check } from 'lucide-react';
import { getVideos, getUsers } from '../lib/db';
import { Video, User } from '../types';
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
