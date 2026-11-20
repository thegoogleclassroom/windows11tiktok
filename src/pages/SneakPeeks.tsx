import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { 
  getSneakPeeks, saveSneakPeeks, saveSneakPeek, deleteSneakPeekFromDB, subscribeToSneakPeeks, getUsers,
  isFirebasePartDisabledNow, FIREBASE_OUTAGE_MESSAGE
} from '../lib/db';
import { SneakPeek, SneakPeekComment, User } from '../types';
import { 
  Sparkles, Megaphone, ChevronLeft, Plus, Flame, Rocket, Eye, Lightbulb, 
  PartyPopper, MessageSquare, Send, Trash2, Edit3, Pin, Tag, Search, 
  Filter, Check, X, ShieldCheck, Crown, Clock, BarChart3, Lock, Video as VideoIcon,
  Image as ImageIcon, Share2
} from 'lucide-react';

const SEED_SNEAK_PEEKS: SneakPeek[] = [
  {
    id: 'sneak_peek_1',
    authorId: 'system_staff',
    title: '🎥 Multi-Guest Live Streams & Dual-Cam Creator Studio',
    content: `We are putting the final touches on our biggest upgrade yet! The upcoming V1.0 update brings real-time interactive live streaming directly to CentralTok.\n\nKey features in this drop:\n- **Host + Up to 4 Co-Hosts**: Bring guests onto your live broadcast with ultra-low latency WebRTC streaming.\n- **Dual-Camera Mode**: Stream your front and rear cameras simultaneously in customizable picture-in-picture layouts.\n- **Live Reactions Burst**: Viewers can send animated sticker hearts and real-time hype waves.\n- **Interactive Q&A Pinning**: Pin audience questions to your live screen during broadcasts.\n\nLet us know your thoughts in the feedback below!`,
    status: 'rolling_out',
    progressPercentage: 92,
    targetVersion: 'V1.0 Launch',
    tags: ['LiveStreams', 'CreatorTools', 'DualCam'],
    mediaUrl: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    pinned: true,
    timestamp: Date.now() - 1000 * 60 * 60 * 6,
    reactions: {
      '🔥': ['system', 'user_1', 'user_2', 'user_3'],
      '🚀': ['system', 'user_1', 'user_4'],
      '👀': ['user_2', 'user_3', 'user_5']
    },
    comments: [
      {
        id: 'sp_comm_1',
        userId: 'system_staff',
        content: 'Final beta testing starts this weekend! Expect zero latency audio.',
        timestamp: Date.now() - 1000 * 60 * 60 * 4
      }
    ]
  },
  {
    id: 'sneak_peek_2',
    authorId: 'system_staff',
    title: '🎵 Magnetic Beat-Sync & Synthesizer Soundboard in Video Uploads',
    content: `Never manually align your video clips to music beats again. The new CentralTok Upload Studio introduces automated beat waveform detection.\n\nHighlights:\n- **Smart Snap Transitions**: Magnetic snap guides automatically align your cuts to drum kicks and synth drops.\n- **Built-in Sound FX Board**: 30+ custom synth sweeps, risers, and retro gaming sound bites to add instant spice.\n- **Custom Pitch & Tempo**: Speed up or slow down tracks with real-time vocal pitch correction.\n\nReady for public testing very soon!`,
    status: 'in_development',
    progressPercentage: 78,
    targetVersion: 'Next Beta Drop',
    tags: ['UploadStudio', 'BeatSync', 'AudioTools'],
    mediaUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    pinned: false,
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    reactions: {
      '🔥': ['user_1', 'user_3'],
      '💡': ['user_2', 'user_4'],
      '🚀': ['user_1']
    },
    comments: []
  },
  {
    id: 'sneak_peek_3',
    authorId: 'system_staff',
    title: '🔒 Ghost Circles & Ephemeral View-Once Secret Drops',
    content: `For the moments meant only for your inner circle. We are creating private circles with zero-trace architecture.\n\n- **View-Once Media**: Photos and video snippets disappear immediately after being viewed.\n- **Anti-Screenshot Shield**: Watermarked deterrents and real-time tamper warnings.\n- **Ephemeral Disappearing Comments**: Comments auto-dissolve after 12 hours.`,
    status: 'testing',
    progressPercentage: 65,
    targetVersion: 'V1.1 Preview',
    tags: ['Privacy', 'GhostMode', 'Security'],
    mediaUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    pinned: false,
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    reactions: {
      '👀': ['user_1', 'user_2', 'user_5'],
      '🔥': ['user_3', 'user_4']
    },
    comments: []
  },
  {
    id: 'sneak_peek_4',
    authorId: 'system_staff',
    title: '🕹️ Synchronous Arcade Mini-Tournaments in Games & Apps',
    content: `Turn gaming on CentralTok into friendly squad rivalries! We are building multiplayer tournament lobbies where you can challenge friends to 2-minute retro micro-battles.\n\n- Instant matchmaking right in your browser\n- Global weekly trophy leaderboards\n- Custom holographic badges for seasonal champions`,
    status: 'concept',
    progressPercentage: 40,
    targetVersion: 'Roadmap Concept',
    tags: ['Arcade', 'Multiplayer', 'Leaderboards'],
    mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    pinned: false,
    timestamp: Date.now() - 1000 * 60 * 60 * 72,
    reactions: {
      '🎉': ['user_1', 'user_2'],
      '🔥': ['user_3', 'user_5']
    },
    comments: []
  }
];

const STATUS_CONFIG = {
  rolling_out: {
    label: 'Rolling Out Soon',
    color: '#10B981', // emerald
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: '🚀'
  },
  in_development: {
    label: 'In Development',
    color: '#8B5CF6', // purple
    bg: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.3)',
    icon: '🔮'
  },
  testing: {
    label: 'Testing Phase',
    color: '#06B6D4', // cyan
    bg: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.3)',
    icon: '🧪'
  },
  concept: {
    label: 'Concept Prototype',
    color: '#F59E0B', // amber
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: '💡'
  }
};

export function SneakPeeks() {
  const navigate = useNavigate();
  const { currentUser, setShowAuthModal } = useAppStore();
  const [sneakPeeks, setSneakPeeks] = useState<SneakPeek[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  // Modal State for Staff/Owner
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPeek, setEditingPeek] = useState<SneakPeek | null>(null);

  // Form States
  const [peekTitle, setPeekTitle] = useState('');
  const [peekContent, setPeekContent] = useState('');
  const [peekStatus, setPeekStatus] = useState<'rolling_out' | 'in_development' | 'testing' | 'concept'>('in_development');
  const [peekProgress, setPeekProgress] = useState(70);
  const [peekTargetVersion, setPeekTargetVersion] = useState('V1.0');
  const [peekTags, setPeekTags] = useState('');
  const [peekMediaUrl, setPeekMediaUrl] = useState('');
  const [peekMediaType, setPeekMediaType] = useState<'image' | 'video'>('image');
  const [peekPinned, setPeekPinned] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStaffOrOwner = 
    currentUser?.role === 'staff' || 
    currentUser?.role === 'owner' || 
    currentUser?.email?.toLowerCase() === 'zaellacruze1@gmail.com';

  // Load Data
  const loadData = async () => {
    try {
      const [allUsers, allPeeks] = await Promise.all([getUsers(), getSneakPeeks()]);
      setUsers(allUsers);
      
      const deleted = JSON.parse(localStorage.getItem('deleted_sneak_peeks') || '[]');
      const hasInitialized = localStorage.getItem('sneak_peeks_seeded');

      if (allPeeks.length === 0 && !hasInitialized) {
        const initial = SEED_SNEAK_PEEKS.filter(p => !deleted.includes(p.id));
        await saveSneakPeeks(initial);
        localStorage.setItem('sneak_peeks_seeded', 'true');
        setSneakPeeks(initial);
      } else {
        const activePeeks = allPeeks.filter(p => !deleted.includes(p.id));
        setSneakPeeks(activePeeks);
      }
    } catch (err) {
      console.error("Error loading sneak peeks:", err);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to sneak_peeks real-time changes
    const unsubscribe = subscribeToSneakPeeks((peeks) => {
      if (peeks && peeks.length > 0) {
        const deleted = JSON.parse(localStorage.getItem('deleted_sneak_peeks') || '[]');
        const activePeeks = peeks.filter(p => !deleted.includes(p.id));
        setSneakPeeks(activePeeks);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getAuthor = (authorId: string) => users.find(u => u.id === authorId);

  // Filtered Sneak Peeks
  const filteredPeeks = sneakPeeks
    .filter(peek => {
      const matchesStatus = statusFilter === 'all' || peek.status === statusFilter;
      const matchesSearch = !searchQuery || 
        peek.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        peek.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        peek.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
    });

  // Calculate Hype Score
  const calculateHype = (peek: SneakPeek) => {
    const reactions = peek.reactions || {};
    const totalReactions = Object.values(reactions).reduce((sum, list) => sum + list.length, 0);
    const commentCount = peek.comments?.length || 0;
    // Score based on interaction weight
    const score = Math.min(99, 70 + totalReactions * 4 + commentCount * 3);
    return Math.max(75, score);
  };

  // Reactions Handler
  const handleReact = async (peekId: string, emoji: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (isFirebasePartDisabledNow('forums_announcements')) {
      return;
    }

    let targetPeek: SneakPeek | undefined;
    const updatedPeeks = sneakPeeks.map(peek => {
      if (peek.id !== peekId) return peek;

      const reactions = { ...(peek.reactions || {}) };
      const currentList = reactions[emoji] || [];
      const hasReacted = currentList.includes(currentUser.id);

      if (hasReacted) {
        reactions[emoji] = currentList.filter(id => id !== currentUser.id);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...currentList, currentUser.id];
      }

      targetPeek = { ...peek, reactions };
      return targetPeek;
    });

    setSneakPeeks(updatedPeeks);
    if (targetPeek) {
      await saveSneakPeek(targetPeek);
    }
  };

  // Comments Handler
  const handleAddComment = async (peekId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (isFirebasePartDisabledNow('forums_announcements')) {
      return;
    }

    const text = commentInputs[peekId]?.trim();
    if (!text) return;

    const newComment: SneakPeekComment = {
      id: `sp_comm_${Date.now()}`,
      userId: currentUser.id,
      content: text,
      timestamp: Date.now()
    };

    let targetPeek: SneakPeek | undefined;
    const updatedPeeks = sneakPeeks.map(peek => {
      if (peek.id !== peekId) return peek;
      targetPeek = {
        ...peek,
        comments: [...(peek.comments || []), newComment]
      };
      return targetPeek;
    });

    setSneakPeeks(updatedPeeks);
    if (targetPeek) {
      await saveSneakPeek(targetPeek);
    }
    setCommentInputs({ ...commentInputs, [peekId]: '' });
  };

  const handleDeleteComment = async (peekId: string, commentId: string) => {
    let targetPeek: SneakPeek | undefined;
    const updatedPeeks = sneakPeeks.map(peek => {
      if (peek.id !== peekId) return peek;
      targetPeek = {
        ...peek,
        comments: (peek.comments || []).filter(c => c.id !== commentId)
      };
      return targetPeek;
    });
    setSneakPeeks(updatedPeeks);
    if (targetPeek) {
      await saveSneakPeek(targetPeek);
    }
  };

  // Create Sneak Peek
  const handleCreateSneakPeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFirebasePartDisabledNow('forums_announcements')) return;
    if (!isStaffOrOwner || !currentUser) return;
    if (!peekTitle.trim() || !peekContent.trim()) return;

    const parsedTags = peekTags
      .split(/[, ]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean);

    const newPeek: SneakPeek = {
      id: `sneak_peek_${Date.now()}`,
      authorId: currentUser.id,
      title: peekTitle.trim(),
      content: peekContent.trim(),
      status: peekStatus,
      progressPercentage: Number(peekProgress),
      targetVersion: peekTargetVersion.trim() || 'Next Release',
      tags: parsedTags.length > 0 ? parsedTags : ['SneakPeek'],
      mediaUrl: peekMediaUrl.trim() || undefined,
      mediaType: peekMediaType,
      pinned: peekPinned,
      timestamp: Date.now(),
      reactions: { '🔥': [currentUser.id] },
      comments: []
    };

    const updated = [newPeek, ...sneakPeeks];
    setSneakPeeks(updated);
    await saveSneakPeek(newPeek);

    // Reset Form
    setPeekTitle('');
    setPeekContent('');
    setPeekStatus('in_development');
    setPeekProgress(70);
    setPeekTargetVersion('V1.0');
    setPeekTags('');
    setPeekMediaUrl('');
    setPeekPinned(false);
    setShowCreateModal(false);
  };

  // Edit Sneak Peek
  const handleEditClick = (peek: SneakPeek) => {
    setEditingPeek(peek);
    setPeekTitle(peek.title);
    setPeekContent(peek.content);
    setPeekStatus(peek.status);
    setPeekProgress(peek.progressPercentage);
    setPeekTargetVersion(peek.targetVersion);
    setPeekTags(peek.tags.join(', '));
    setPeekMediaUrl(peek.mediaUrl || '');
    setPeekMediaType(peek.mediaType || 'image');
    setPeekPinned(!!peek.pinned);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeek || !isStaffOrOwner) return;

    const parsedTags = peekTags
      .split(/[, ]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean);

    let updatedTarget: SneakPeek | null = null;
    const updatedPeeks = sneakPeeks.map(peek => {
      if (peek.id !== editingPeek.id) return peek;
      updatedTarget = {
        ...peek,
        title: peekTitle.trim(),
        content: peekContent.trim(),
        status: peekStatus,
        progressPercentage: Number(peekProgress),
        targetVersion: peekTargetVersion.trim() || 'Next Release',
        tags: parsedTags,
        mediaUrl: peekMediaUrl.trim() || undefined,
        mediaType: peekMediaType,
        pinned: peekPinned,
        updatedAt: Date.now()
      };
      return updatedTarget;
    });

    setSneakPeeks(updatedPeeks);
    if (updatedTarget) {
      await saveSneakPeek(updatedTarget);
    }
    setShowEditModal(false);
    setEditingPeek(null);
  };

  // Delete Sneak Peek
  const handleDeleteSneakPeek = async (peekId: string) => {
    if (!isStaffOrOwner) return;
    if (!window.confirm("Are you sure you want to delete this sneak peek?")) return;

    // Track in local deletion cache to prevent seed resurrection
    const deleted = JSON.parse(localStorage.getItem('deleted_sneak_peeks') || '[]');
    if (!deleted.includes(peekId)) {
      deleted.push(peekId);
      localStorage.setItem('deleted_sneak_peeks', JSON.stringify(deleted));
    }

    // Optimistic UI update
    setSneakPeeks(prev => prev.filter(p => p.id !== peekId));

    try {
      await deleteSneakPeekFromDB(peekId);
    } catch (err) {
      console.error("Error deleting sneak peek from DB:", err);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video');
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setPeekMediaUrl(ev.target.result as string);
        setPeekMediaType(isVid ? 'video' : 'image');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="sneak-peeks-page" className="w-full h-full overflow-y-auto bg-[#111214] text-white p-2 md:p-6 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {isFirebasePartDisabledNow('forums_announcements') && (
          <div className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold">
            {FIREBASE_OUTAGE_MESSAGE}
          </div>
        )}

        {/* Navigation Bar / Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1e1f22] p-3 md:p-4 rounded-2xl border border-zinc-800 shadow-md">
          
          <div className="flex items-center gap-2">
            <button
              id="back-to-forum-hub-btn-sneak"
              onClick={() => navigate('/forum')}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800"
              title="Return to Forum Gateway"
            >
              <ChevronLeft size={16} />
              <span>Forums Hub</span>
            </button>

            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                Sneak Peeks & Dev Drops
              </span>
            </div>
          </div>

          {/* Section Switcher Tabs & Staff Action */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-1">
              <button
                id="switch-to-updates-btn"
                onClick={() => navigate('/forum/updates')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold transition-all"
              >
                <Megaphone size={14} className="text-blue-400" />
                <span>Updates & Announcements</span>
              </button>

              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold shadow-sm"
              >
                <Sparkles size={14} />
                <span>Sneak Peeks</span>
              </button>
            </div>

            {isStaffOrOwner && (
              <button
                id="drop-sneak-peek-btn"
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <Plus size={16} />
                <span>Drop Sneak Peek</span>
              </button>
            )}
          </div>

        </div>

        {/* Hero Banner for Sneak Peeks */}
        <div className="relative rounded-3xl overflow-hidden p-6 md:p-8 bg-gradient-to-br from-pink-950/40 via-[#1e1f22] to-indigo-950/40 border border-pink-500/20 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-[11px] font-black uppercase tracking-widest text-pink-400">
              <Sparkles size={13} />
              <span>Unreleased & Experimental</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
              Exclusive Sneak Peeks
            </h1>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              Get an insider look at upcoming releases, interactive prototypes, and roadmap milestones. Vote on community hype and share feedback directly with developers.
            </p>
          </div>
        </div>

        {/* Search and Status Filter Pills */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search sneak peeks, feature names, tags (#LiveStreams, #BeatSync)..."
              className="w-full bg-[#1e1f22] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-all border ${
                statusFilter === 'all'
                  ? 'bg-white text-zinc-950 border-white shadow-sm'
                  : 'bg-[#1e1f22] text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              All Drops ({sneakPeeks.length})
            </button>

            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = sneakPeeks.filter(p => p.status === key).length;
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1.5 transition-all border ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'bg-[#1e1f22] text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                  }`}
                  style={isActive ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sneak Peeks Feed */}
        <div className="space-y-6">
          {filteredPeeks.map(peek => {
            const author = getAuthor(peek.authorId);
            const statusInfo = STATUS_CONFIG[peek.status] || STATUS_CONFIG.in_development;
            const hypeScore = calculateHype(peek);
            const commentsOpen = !!expandedComments[peek.id];
            const isAuthorOrStaff = isStaffOrOwner || currentUser?.id === peek.authorId;

            return (
              <div
                key={peek.id}
                id={`sneak-peek-card-${peek.id}`}
                className="bg-[#1e1f22] rounded-3xl border border-zinc-800 hover:border-zinc-700/80 p-5 md:p-7 shadow-xl transition-all space-y-5 relative overflow-hidden"
              >
                {/* Header info row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Badge */}
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border"
                      style={{
                        backgroundColor: statusInfo.bg,
                        borderColor: statusInfo.border,
                        color: statusInfo.color
                      }}
                    >
                      <span>{statusInfo.icon}</span>
                      <span>{statusInfo.label}</span>
                    </span>

                    {/* Target Version */}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                      🎯 {peek.targetVersion}
                    </span>

                    {/* Pinned Indicator */}
                    {peek.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/40 border border-amber-600/40 px-2 py-0.5 rounded-full">
                        <Pin size={12} /> Pinned
                      </span>
                    )}
                  </div>

                  {/* Actions for staff/owner */}
                  {isAuthorOrStaff && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(peek)}
                        className="p-1.5 text-zinc-400 hover:text-blue-400 rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Edit Sneak Peek"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteSneakPeek(peek.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Delete Sneak Peek"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar & Readiness Gauge */}
                <div className="bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-400 flex items-center gap-1.5">
                      <BarChart3 size={14} className="text-pink-500" />
                      <span>Development Progress</span>
                    </span>
                    <span className="font-black text-white">{peek.progressPercentage}% Complete</span>
                  </div>
                  
                  <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${peek.progressPercentage}%`,
                        backgroundColor: statusInfo.color
                      }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-xl md:text-2xl font-black text-white leading-snug">
                  {peek.title}
                </h2>

                {/* Author row */}
                <div className="flex items-center gap-3 text-xs text-zinc-400 pb-2 border-b border-zinc-800/60">
                  {author?.avatarUrl ? (
                    <img src={author.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-zinc-700" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs">
                      {author?.username?.charAt(0) || 'D'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{author?.username || 'Dev Team'}</span>
                      {author?.role === 'owner' ? (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-700/50">
                          Owner
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-700/50">
                          Staff
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(peek.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Community Hype Meter Pill */}
                  <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-indigo-500/20 border border-pink-500/30 text-pink-300 font-black text-xs">
                    <Flame size={14} className="text-pink-500 fill-current animate-bounce" />
                    <span>{hypeScore}% Community Hype</span>
                  </div>
                </div>

                {/* Media Preview (Image or Video) */}
                {peek.mediaUrl && (
                  <div
                    onClick={() => setLightboxMedia({ url: peek.mediaUrl!, type: peek.mediaType || 'image' })}
                    className="group/media relative rounded-2xl overflow-hidden bg-black/50 border border-zinc-800 max-h-[460px] flex items-center justify-center cursor-pointer hover:border-pink-500/50 transition-all"
                  >
                    {peek.mediaType === 'video' ? (
                      <video
                        src={peek.mediaUrl}
                        className="w-full max-h-[440px] object-contain"
                        controls
                      />
                    ) : (
                      <img
                        src={peek.mediaUrl}
                        alt={peek.title}
                        className="w-full max-h-[440px] object-contain transition-transform group-hover/media:scale-[1.01]"
                      />
                    )}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase text-white border border-white/10 flex items-center gap-1">
                      <Eye size={12} /> Click to Expand
                    </div>
                  </div>
                )}

                {/* Content description with preserved formatting */}
                <div className="text-zinc-200 text-sm md:text-base leading-relaxed whitespace-pre-line">
                  {peek.content}
                </div>

                {/* Tags */}
                {peek.tags && peek.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    {peek.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-pink-400 hover:border-pink-500/30 transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Hype Reaction Buttons & Comments Toggle */}
                <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { emoji: '🔥', label: 'HYPE' },
                      { emoji: '🚀', label: "CAN'T WAIT" },
                      { emoji: '👀', label: 'NEED THIS' },
                      { emoji: '💡', label: 'LOVE IT' }
                    ].map(({ emoji, label }) => {
                      const count = (peek.reactions?.[emoji] || []).length;
                      const hasReacted = currentUser && (peek.reactions?.[emoji] || []).includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReact(peek.id, emoji)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                            hasReacted
                              ? 'bg-pink-600/20 border-pink-500 text-pink-300 shadow-sm scale-105'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <span className="text-sm">{emoji}</span>
                          <span>{label}</span>
                          {count > 0 && <span className="font-black px-1.5 py-0.2 rounded-full bg-black/40 text-[11px]">{count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Comments toggle button */}
                  <button
                    onClick={() => setExpandedComments({ ...expandedComments, [peek.id]: !commentsOpen })}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors ml-auto"
                  >
                    <MessageSquare size={14} className="text-pink-500" />
                    <span>Feedback & Ideas ({peek.comments?.length || 0})</span>
                  </button>
                </div>

                {/* Comments & Feedback Section */}
                {commentsOpen && (
                  <div className="pt-4 border-t border-zinc-800/80 space-y-4 animate-in fade-in duration-150">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <MessageSquare size={14} /> Community Suggestions & Feedback
                    </h3>

                    {/* Comments List */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {peek.comments && peek.comments.length > 0 ? (
                        peek.comments.map(c => {
                          const commAuthor = getAuthor(c.userId);
                          const canDeleteComm = isStaffOrOwner || currentUser?.id === c.userId;
                          return (
                            <div key={c.id} className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 flex gap-3 text-xs">
                              {commAuthor?.avatarUrl ? (
                                <img src={commAuthor.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                                  {commAuthor?.username?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-white">@{commAuthor?.handle || commAuthor?.username || 'user'}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500">
                                      {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {canDeleteComm && (
                                      <button
                                        onClick={() => handleDeleteComment(peek.id, c.id)}
                                        className="text-zinc-500 hover:text-red-400"
                                        title="Delete comment"
                                      >
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-zinc-200 leading-relaxed">{c.content}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-zinc-500 italic py-2">
                          No suggestions yet. Share your feedback or ideas for this upcoming drop!
                        </p>
                      )}
                    </div>

                    {/* Comment composer */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentInputs[peek.id] || ''}
                        onChange={e => setCommentInputs({ ...commentInputs, [peek.id]: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(peek.id);
                          }
                        }}
                        placeholder="Give feedback or suggest an idea for this feature..."
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
                      />
                      <button
                        onClick={() => handleAddComment(peek.id)}
                        disabled={!(commentInputs[peek.id] || '').trim()}
                        className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5"
                      >
                        <Send size={12} />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}

          {filteredPeeks.length === 0 && (
            <div className="text-center py-16 bg-[#1e1f22] rounded-3xl border border-zinc-800 p-8 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto text-2xl">
                <Sparkles size={32} />
              </div>
              <h3 className="text-lg font-bold text-white">No sneak peeks found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                No feature drops match your search or filter. Try switching back to all drops or resetting your search.
              </p>
              <button
                onClick={() => { setStatusFilter('all'); setSearchQuery(''); }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Lightbox Modal */}
      {lightboxMedia && (
        <div
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxMedia(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-white hover:text-black transition-colors z-10"
            >
              <X size={20} />
            </button>
            {lightboxMedia.type === 'video' ? (
              <video src={lightboxMedia.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-2xl" />
            ) : (
              <img src={lightboxMedia.url} alt="Expanded preview" className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Sneak Peek Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1e1f22] border border-zinc-800 rounded-3xl w-full max-w-xl p-6 md:p-8 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-pink-600 flex items-center justify-center text-white">
                  <Sparkles size={18} />
                </div>
                <h3 className="text-lg font-black text-white">
                  {showCreateModal ? 'Drop New Sneak Peek' : 'Edit Sneak Peek'}
                </h3>
              </div>
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={showCreateModal ? handleCreateSneakPeek : handleSaveEdit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Title</label>
                <input
                  type="text"
                  required
                  value={peekTitle}
                  onChange={e => setPeekTitle(e.target.value)}
                  placeholder="e.g. 🎥 Multi-Guest Live Video Streams"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Status & Progress */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Status</label>
                  <select
                    value={peekStatus}
                    onChange={e => setPeekStatus(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                  >
                    <option value="rolling_out">🚀 Rolling Out Soon</option>
                    <option value="in_development">🔮 In Development</option>
                    <option value="testing">🧪 Testing Phase</option>
                    <option value="concept">💡 Concept Prototype</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Progress ({peekProgress}%)</label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={peekProgress}
                    onChange={e => setPeekProgress(Number(e.target.value))}
                    className="w-full accent-pink-500 mt-2"
                  />
                </div>
              </div>

              {/* Target Version & Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Target Version</label>
                  <input
                    type="text"
                    value={peekTargetVersion}
                    onChange={e => setPeekTargetVersion(e.target.value)}
                    placeholder="e.g. V1.0 Launch, Next Week"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={peekTags}
                    onChange={e => setPeekTags(e.target.value)}
                    placeholder="LiveStreams, DualCam, Video"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Media URL / Upload */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Teaser Image or Video</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={peekMediaUrl}
                    onChange={e => setPeekMediaUrl(e.target.value)}
                    placeholder="Paste image/video URL or upload below"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                  >
                    <ImageIcon size={14} /> Upload
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Content Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Teaser Description</label>
                <textarea
                  required
                  rows={5}
                  value={peekContent}
                  onChange={e => setPeekContent(e.target.value)}
                  placeholder="Describe this upcoming feature, why it's awesome, and what users can look forward to..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              {/* Pin Toggle */}
              <label className="flex items-center gap-2 text-xs text-zinc-300 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={peekPinned}
                  onChange={e => setPeekPinned(e.target.checked)}
                  className="rounded border-zinc-700 accent-pink-500 w-4 h-4"
                />
                <span>Pin this sneak peek to the top of the feed</span>
              </label>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white shadow-lg transition-all"
                >
                  {showCreateModal ? 'Publish Sneak Peek' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
