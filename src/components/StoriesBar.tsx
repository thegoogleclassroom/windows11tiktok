import React, { useState, useEffect, useRef } from 'react';
import { getStories, markStoryViewed, deleteStoryFromDB, getUsers } from '../lib/db';
import { Story, User } from '../types';
import { useAppStore } from '../store';
import { isFriend } from '../lib/utils';
import { Plus, X, Trash2, Eye, ChevronLeft, ChevronRight, Users, Lock, Globe, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserStoriesGroup {
  user: User;
  stories: Story[];
  hasUnseen: boolean;
}

export function StoriesBar() {
  const { currentUser, setActiveStory } = useAppStore();
  const navigate = useNavigate();
  const [storyGroups, setStoryGroups] = useState<UserStoriesGroup[]>([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const loadStories = async () => {
    try {
      const allStories = await getStories();
      const allUsers = await getUsers();
      const now = Date.now();

      // Only valid unexpired stories
      const validStories = allStories.filter(s => s.expiresAt > now);

      // Filter by visibility
      const viewableStories = validStories.filter(s => {
        if (currentUser?.id === s.userId) return true;
        if (currentUser?.role === 'owner' || currentUser?.role === 'staff') return true;
        if (s.visibility === 'only_you') return false;
        if (s.visibility === 'friends') {
          const author = allUsers.find(u => u.id === s.userId);
          return isFriend(currentUser, author);
        }
        return true;
      });

      // Group stories by author
      const groupsMap = new Map<string, Story[]>();
      viewableStories.forEach(s => {
        const list = groupsMap.get(s.userId) || [];
        list.push(s);
        groupsMap.set(s.userId, list);
      });

      const groups: UserStoriesGroup[] = [];
      groupsMap.forEach((stories, userId) => {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
          // Sort stories chronologically
          stories.sort((a, b) => a.timestamp - b.timestamp);
          const hasUnseen = stories.some(s => !currentUser || !(s.viewers || []).includes(currentUser.id));
          groups.push({ user, stories, hasUnseen });
        }
      });

      // Sort so current user is first, then users with unseen stories
      groups.sort((a, b) => {
        if (a.user.id === currentUser?.id) return -1;
        if (b.user.id === currentUser?.id) return 1;
        if (a.hasUnseen && !b.hasUnseen) return -1;
        if (!a.hasUnseen && b.hasUnseen) return 1;
        return 0;
      });

      setStoryGroups(groups);
    } catch (err) {
      console.error("Error loading stories:", err);
    }
  };

  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const currentUserGroup = storyGroups.find(g => g.user.id === currentUser?.id);
  const otherGroups = storyGroups.filter(g => g.user.id !== currentUser?.id);

  const openStoryViewer = (groupIndex: number, storyIndex = 0) => {
    const group = storyGroups[groupIndex];
    if (group) {
      setActiveStory({ userId: group.user.id, user: group.user });
    }
  };

  return (
    <div className={`w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 py-3 px-3 overflow-x-auto hide-scrollbar z-30 transition-all`}>
      <div className="flex items-center gap-3 min-w-max">
        
        {/* Current User Story Bubble */}
        <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
          <div className="relative">
            <div 
              onClick={() => {
                if (currentUserGroup && currentUserGroup.stories.length > 0) {
                  const idx = storyGroups.findIndex(g => g.user.id === currentUser?.id);
                  openStoryViewer(idx);
                } else {
                  navigate('/upload');
                }
              }}
              className={`w-16 h-16 rounded-full p-[2.5px] transition-transform group-hover:scale-105 ${
                currentUserGroup && currentUserGroup.stories.length > 0
                  ? 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600'
                  : 'bg-zinc-800'
              }`}
            >
              <div className="w-full h-full rounded-full border-2 border-zinc-950 overflow-hidden bg-zinc-900 flex items-center justify-center">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {currentUser?.username?.charAt(0) || '+'}
                  </span>
                )}
              </div>
            </div>

            {/* Plus badge to add new story */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/upload');
              }}
              className="absolute bottom-0 right-0 w-5 h-5 bg-pink-600 hover:bg-pink-500 text-white rounded-full flex items-center justify-center border-2 border-zinc-950 shadow-md transition-transform hover:scale-110"
              title="Add to Story"
            >
              <Plus size={12} strokeWidth={3} />
            </button>
          </div>
          <span className="text-[11px] font-medium text-zinc-300 max-w-[68px] truncate">
            {currentUserGroup && currentUserGroup.stories.length > 0 ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Other Users' Stories */}
        {otherGroups.map((group) => {
          const groupIndex = storyGroups.findIndex(g => g.user.id === group.user.id);
          return (
            <div 
              key={group.user.id} 
              onClick={() => openStoryViewer(groupIndex)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
            >
              <div 
                className={`w-16 h-16 rounded-full p-[2.5px] transition-transform group-hover:scale-105 ${
                  group.hasUnseen 
                    ? 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 animate-pulse' 
                    : 'bg-zinc-700/60'
                }`}
              >
                <div className="w-full h-full rounded-full border-2 border-zinc-950 overflow-hidden bg-zinc-900 flex items-center justify-center">
                  {group.user.avatarUrl ? (
                    <img src={group.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-lg">{group.user.username.charAt(0)}</span>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-medium text-zinc-300 max-w-[68px] truncate text-center">
                {group.user.username}
              </span>
            </div>
          );
        })}

      </div>
    </div>
  );
}

// Global viewer that overlaps the whole app
export function GlobalStoryViewer() {
  const { currentUser, activeStory, setActiveStory } = useAppStore();
  const [storyGroups, setStoryGroups] = useState<UserStoriesGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStories = async () => {
    try {
      const allStories = await getStories();
      const allUsers = await getUsers();
      const now = Date.now();
      const validStories = allStories.filter(s => s.expiresAt > now);
      const viewableStories = validStories.filter(s => {
        if (currentUser?.id === s.userId) return true;
        if (currentUser?.role === 'owner' || currentUser?.role === 'staff') return true;
        if (s.visibility === 'only_you') return false;
        if (s.visibility === 'friends') {
          const author = allUsers.find(u => u.id === s.userId);
          return isFriend(currentUser, author);
        }
        return true;
      });
      const groupsMap = new Map<string, Story[]>();
      viewableStories.forEach(s => {
        const list = groupsMap.get(s.userId) || [];
        list.push(s);
        groupsMap.set(s.userId, list);
      });
      const groups: UserStoriesGroup[] = [];
      groupsMap.forEach((stories, userId) => {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
          stories.sort((a, b) => a.timestamp - b.timestamp);
          const hasUnseen = stories.some(s => !currentUser || !(s.viewers || []).includes(currentUser.id));
          groups.push({ user, stories, hasUnseen });
        }
      });
      setStoryGroups(groups);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeStory) loadStories();
  }, [activeStory, currentUser?.id]);

  if (!activeStory || loading) return null;

  const currentGroupIndex = storyGroups.findIndex(g => g.user.id === activeStory.userId);
  if (currentGroupIndex === -1) return null;

  return (
    <StoryViewerModal 
      groups={storyGroups}
      currentGroupIndex={currentGroupIndex}
      initialStoryIndex={0}
      onClose={() => setActiveStory(null)}
      onStoryDeleted={loadStories}
    />
  );
}

interface StoryViewerModalProps {
  groups: UserStoriesGroup[];
  currentGroupIndex: number;
  initialStoryIndex: number;
  onClose: () => void;
  onStoryDeleted: () => void;
}

function StoryViewerModal({ groups, currentGroupIndex, initialStoryIndex, onClose, onStoryDeleted }: StoryViewerModalProps) {
  const { currentUser } = useAppStore();
  const [groupIndex, setGroupIndex] = useState(currentGroupIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isOwnStory = currentUser?.id === currentStory?.userId;
  const isStaff = currentUser?.role === 'owner' || currentUser?.role === 'staff';

  // Mark story as viewed
  useEffect(() => {
    if (!currentStory || !currentUser) return;
    if (!(currentStory.viewers || []).includes(currentUser.id)) {
      const updatedViewers = [...(currentStory.viewers || []), currentUser.id];
      currentStory.viewers = updatedViewers;
      markStoryViewed(currentStory.id, currentUser.id);
    }
  }, [currentStory?.id, currentUser?.id]);

  // Handle story progress timer
  useEffect(() => {
    setProgress(0);
    if (!currentStory) return;

    if (currentStory.mediaType === 'image') {
      const durationMs = 6000; // 6 seconds for images
      const stepMs = 50;
      const totalSteps = durationMs / stepMs;
      let currentStep = 0;

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (isPaused) return;
        currentStep++;
        setProgress((currentStep / totalSteps) * 100);
        if (currentStep >= totalSteps) {
          clearInterval(timerRef.current);
          handleNextStory();
        }
      }, stepMs);

      return () => clearInterval(timerRef.current);
    }
  }, [groupIndex, storyIndex, isPaused, currentStory?.id]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && currentStory?.mediaType !== 'image') {
      const p = (videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100;
      setProgress(p);
    }
  };

  const handleVideoEnded = () => {
    handleNextStory();
  };

  const handleNextStory = () => {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    if (!window.confirm("Delete this story? This cannot be undone.")) return;
    await deleteStoryFromDB(currentStory.id);
    onStoryDeleted();
    if (currentGroup.stories.length <= 1) {
      onClose();
    } else {
      setStoryIndex(prev => Math.max(0, prev - 1));
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-[2100] bg-black/95 flex items-center justify-center backdrop-blur-2xl animate-in fade-in duration-300">
      
      {/* Close button - High priority for user request */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed top-6 right-6 z-[2200] p-3 bg-white/10 hover:bg-red-500 hover:scale-110 active:scale-95 text-white rounded-full transition-all border border-white/20 backdrop-blur-md shadow-2xl group"
        title="Close story"
      >
        <X size={28} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* Prev / Next Buttons on Desktop */}
      {groupIndex > 0 && (
        <button
          onClick={handlePrevStory}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-40"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {(groupIndex < groups.length - 1 || storyIndex < currentGroup.stories.length - 1) && (
        <button
          onClick={handleNextStory}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-40"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Phone Stage - Immersive overlay */}
      <div 
        className="relative w-full md:max-w-[420px] h-full md:max-h-[850px] bg-zinc-950 rounded-none md:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        
        {/* Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {currentGroup.stories.map((s, idx) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-75"
                style={{
                  width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Header */}
        <div className="absolute top-7 left-3 right-3 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/40 bg-zinc-800">
              {currentGroup.user.avatarUrl ? (
                <img src={currentGroup.user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-xs">{currentGroup.user.username.charAt(0)}</div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs">{currentGroup.user.username}</span>
                <span className="text-[10px] text-zinc-300">· {formatTimeAgo(currentStory.timestamp)}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-zinc-300">
                {currentStory.visibility === 'friends' && (
                  <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
                    <Users size={10} /> Friends
                  </span>
                )}
                {currentStory.visibility === 'only_you' && (
                  <span className="flex items-center gap-0.5 text-amber-300 font-semibold">
                    <Lock size={10} /> Only You
                  </span>
                )}
                {currentStory.visibility === 'everyone' && (
                  <span className="flex items-center gap-0.5 opacity-80">
                    <Globe size={10} /> Public
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {currentStory.mediaType !== 'image' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}

            {/* Author or Staff Delete Story */}
            {(isOwnStory || isStaff) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStory();
                }}
                className="p-1.5 bg-black/40 hover:bg-red-600 rounded-full text-white transition-colors"
                title="Delete story"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Media Container */}
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {currentStory.mediaType === 'image' ? (
            <img 
              src={currentStory.mediaUrl} 
              alt="Story" 
              className="w-full h-full object-contain" 
            />
          ) : (
            <video 
              ref={videoRef}
              src={currentStory.mediaUrl} 
              autoPlay 
              playsInline 
              muted={isMuted}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              className="w-full h-full object-contain" 
            />
          )}

          {/* Left / Right Tap zones */}
          <div 
            onClick={handlePrevStory}
            className="absolute top-16 left-0 bottom-16 w-1/3 z-20 cursor-pointer" 
          />
          <div 
            onClick={handleNextStory}
            className="absolute top-16 right-0 bottom-16 w-2/3 z-20 cursor-pointer" 
          />
        </div>

        {/* Bottom Caption & Viewers */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white z-30">
          {currentStory.caption && (
            <p className="text-sm font-medium mb-3 px-1 drop-shadow-md">{currentStory.caption}</p>
          )}

          {/* Viewers Counter for Author */}
          {isOwnStory && (
            <div className="flex items-center justify-between border-t border-white/20 pt-2 text-xs">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewers(!showViewers);
                }}
                className="flex items-center gap-1.5 text-zinc-300 hover:text-white font-semibold"
              >
                <Eye size={16} />
                <span>{(currentStory.viewers || []).length} views</span>
              </button>
              <span className="text-[10px] text-zinc-400">Expires in 24h</span>
            </div>
          )}
        </div>

        {/* Viewers Drawer */}
        {showViewers && isOwnStory && (
          <div className="absolute inset-x-0 bottom-0 max-h-60 bg-zinc-900/95 backdrop-blur-md rounded-t-2xl p-4 z-40 border-t border-zinc-700 overflow-y-auto hide-scrollbar">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                <Eye size={16} /> Viewers ({(currentStory.viewers || []).length})
              </h4>
              <button onClick={() => setShowViewers(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {currentStory.viewers && (currentStory.viewers || []).length > 0 ? (
                (currentStory.viewers || []).map(viewerId => (
                  <div key={viewerId} className="flex items-center gap-2 text-xs text-zinc-200">
                    <div className="w-6 h-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-[10px]">
                      {viewerId?.toString().charAt(0).toUpperCase() || '?'}
                    </div>
                    <span>{viewerId === currentUser?.id ? 'You' : `User: ${viewerId}`}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400">No viewers yet.</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
