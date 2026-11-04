import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, PlusSquare, MessageSquare, User, Moon, Sun, LogIn, ShieldAlert, X, HelpCircle, Bell, Gamepad2, ShieldCheck, Info, Rocket, Sparkles, Check, Copy, Flame, AlertTriangle, Search, Users, Tv } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { AuthModal } from './AuthModal';
import { MiniPlayer } from './MiniPlayer';
import { saveReports, getMessages, getUsers, getNotifications, markNotificationAsRead, getFAQPosts, subscribeToNotifications, saveGameData, getGameData, subscribeToIncomingCalls, subscribeToMessages, updateUser, requestCentralProVerification } from '../lib/db';
import { TradientInfoModal } from './TradientInfoModal';
import { HolographicBadge, CentralProBadge } from './UIPolish';
import * as Types from '../types';

import AnnouncementBanner from './AnnouncementBanner';
import { IncomingCallModal } from './IncomingCallModal';

import { VerificationModal } from './VerificationModal';
import { ForumChooserModal } from './ForumChooserModal';
import { GlobalMusicBubble } from './GlobalMusicBubble';

export function Layout({ children }: { children: React.ReactNode }) {
  const { 
    currentUser, 
    setCurrentUser,
    theme, 
    toggleTheme, 
    introPhase, 
    showAuthModal, 
    setShowAuthModal, 
    isGameActive, 
    setIsGameActive,
    activeGameTitle,
    activeGameUrl,
    miniPlayerActive
  } = useAppStore();
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showForumChooser, setShowForumChooser] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showCentralProModal, setShowCentralProModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportType, setSupportType] = useState<'support' | 'bug' | null>(null);
  const [supportSent, setSupportSent] = useState(false);
  const [messageToast, setMessageToast] = useState<{username: string; avatarUrl: string; handle: string} | null>(null);
  const [forumToast, setForumToast] = useState<{
    id: string;
    title: string;
    authorName: string;
    authorAvatar?: string;
  } | null>(null);
  const [rewardToast, setRewardToast] = useState<{
    id: string;
    message: string;
    fromUserHandle: string;
    fromUserAvatar?: string;
    isImportant?: boolean;
    actionButton?: { text: string; action: string };
  } | null>(null);
  const [showTradientInfo, setShowTradientInfo] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeIncomingCall, setActiveIncomingCall] = useState<Types.Call | null>(null);
  const knownMessageIds = useRef<Set<string>>(new Set());
  const knownCallIds = useRef<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const isIntro = location.pathname === '/' && introPhase !== 'done';
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedUsers, setSuggestedUsers] = useState<Types.User[]>([]);

  useEffect(() => {
    getUsers().then(users => {
      setSuggestedUsers(users.slice(0, 4));
    }).catch(() => {});
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const unsubscribe = subscribeToMessages(async (messages) => {
      const users = await getUsers();
      const incoming = messages.filter(message => message.toUserId === currentUser.id);
      const unread = incoming.filter(m => !m.read).length;
      setUnreadCount(unread);

      const freshUnread = incoming.filter(m => !m.read && !knownMessageIds.current.has(m.id));
      freshUnread.forEach(m => {
        knownMessageIds.current.add(m.id);
        const sender = users.find(user => user.id === m.fromUserId);
        if (sender) {
          setMessageToast({username: sender.username, avatarUrl: sender.avatarUrl, handle: sender.handle});
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`${sender.username} sent you a message`, {
                body: m.content || 'New message received',
                icon: sender.avatarUrl,
                tag: `msg_${m.id}`
              });
            } catch (err) {}
          }
        }
      });
      incoming.forEach(message => knownMessageIds.current.add(message.id));
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      // Guest online arrival check
      // Guest online arrival check
      const checkGuestAnnouncements = async () => {
        try {
          const [allUsers, allPosts] = await Promise.all([getUsers(), getFAQPosts()]);
          if (allPosts.length > 0) {
            const latestPost = allPosts.sort((a, b) => b.timestamp - a.timestamp)[0];
            const isRecent = Date.now() - latestPost.timestamp < 1000 * 60 * 60 * 24;
            const seenKey = `ct_guest_seen_post_${latestPost.id}`;
            if (isRecent && !localStorage.getItem(seenKey) && !sessionStorage.getItem(seenKey)) {
              sessionStorage.setItem(seenKey, 'true');
              const author = allUsers.find(u => u.id === latestPost.authorId);
              setForumToast({
                id: latestPost.id,
                title: latestPost.title,
                authorName: author?.username || 'Staff Team',
                authorAvatar: author?.avatarUrl
              });
            }
          }
        } catch (err) {}
      };
      checkGuestAnnouncements();
      return;
    }

    const unsubscribe = subscribeToNotifications(currentUser.id, async (allUnreadNotifs) => {
      // Handle Forum Announcements
      const pendingForum = allUnreadNotifs.filter(n => n.type === 'forum_announcement' && !n.read);
      if (pendingForum.length > 0) {
        const latest = pendingForum.sort((a, b) => b.timestamp - a.timestamp)[0];
        const sessionKey = `ct_shown_forum_${latest.id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          const users = await getUsers();
          const author = users.find(u => u.id === latest.fromUserId);
          setForumToast({
            id: latest.id,
            title: latest.title || 'New Forum Announcement',
            authorName: author?.username || 'Staff Team',
            authorAvatar: author?.avatarUrl
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📢 CentralTok Announcement', {
              body: latest.title || 'New Forum announcement posted',
              icon: author?.avatarUrl
            });
          }
        }
      }

      // Handle Tradient Rewards
      const pendingRewards = allUnreadNotifs.filter(n => n.type === 'tradient_reward' && !n.read);
      if (pendingRewards.length > 0) {
        const latest = pendingRewards.sort((a, b) => b.timestamp - a.timestamp)[0];
        const sessionKey = `ct_shown_reward_${latest.id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');
          const users = await getUsers();
          const author = users.find(u => u.id === latest.fromUserId);
          setRewardToast({
            id: latest.id,
            message: latest.message || '',
            fromUserHandle: author?.handle || 'eyeshd',
            fromUserAvatar: author?.avatarUrl,
            isImportant: latest.isImportant,
            actionButton: latest.actionButton
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🎉 Tradient Reward!', {
              body: latest.message || 'You earned the Tradient Badge!',
              icon: author?.avatarUrl
            });
          }
        }
      }
    });

    const unsubCalls = currentUser ? subscribeToIncomingCalls(currentUser.id, async (calls) => {
      if (calls.length > 0) {
        const call = calls[0];
        setActiveIncomingCall(call);

        if (!knownCallIds.current.has(call.id) && call.status === 'offering') {
          knownCallIds.current.add(call.id);
          const users = await getUsers();
          const caller = users.find(u => u.id === call.callerId);
          const callerName = caller?.username || 'Someone';

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(`${callerName} is calling you!`, {
                body: 'Incoming call on CentralTok. Click to answer.',
                icon: caller?.avatarUrl,
                tag: `call_${call.id}`
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch (err) {}
          }
        }
      } else {
        setActiveIncomingCall(null);
      }
    }) : () => {};

    return () => {
      unsubscribe();
      unsubCalls();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Basic validation for type
      if (!event.data || typeof event.data !== 'object') return;
      const { type, gameId, data, requestId } = event.data;
      
      if (type === 'SAVE_GAME_DATA' && currentUser) {
        await saveGameData(currentUser.id, gameId, data);
      } else if (type === 'LOAD_GAME_DATA') {
        const savedData = currentUser ? await getGameData(currentUser.id, gameId) : {};
        event.source?.postMessage({
          type: 'LOAD_GAME_DATA_RESPONSE',
          requestId,
          data: savedData || {}
        }, { targetOrigin: '*' } as any);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentUser?.id]);

  const handleSupportSubmit = async () => {
    if (!supportMessage.trim()) return;
    const { getReports, saveReports } = await import('../lib/db');
    const reports = await getReports();
    reports.push({
      id: `support_${Date.now()}`,
      videoId: 'general_support',
      reporterId: currentUser?.id || 'anonymous',
      reason: `${supportType === 'bug' ? 'Bug/Issue' : 'Support'}: ${supportMessage}`,
      timestamp: Date.now(),
      status: 'pending',
      category: supportType || 'support'
    });
    await saveReports(reports);
    setSupportSent(true);
    setTimeout(() => {
      setShowSupportModal(false);
      setSupportSent(false);
      setSupportMessage('');
      setSupportType(null);
    }, 2000);
  };

  const navItems = [
    { icon: Home, label: 'For You', path: '/' },
    { icon: Compass, label: 'Explore', path: '/explore' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: User, label: 'Profile', path: currentUser ? `/profile/${currentUser.handle}` : '#' },
    { icon: HelpCircle, label: 'Forums', path: '/forum' },
    { icon: Gamepad2, label: 'Games & Apps', path: '/games-apps' },
  ];

  if (currentUser?.role === 'staff' || currentUser?.role === 'owner') {
    navItems.push({ icon: ShieldAlert, label: 'Moderation', path: '/admin' });
  }

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (path === '#' || (['/messages', '/upload'].includes(path) && !currentUser)) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
    if (path === '/forum') {
      e.preventDefault();
      setShowForumChooser(true);
      return;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-hidden transition-colors">
      <AnnouncementBanner />

      {/* TikTok Desktop Top Navigation Header */}
      {!isIntro && (
        <header className="hidden md:flex items-center justify-between px-6 py-2 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shrink-0 z-40 select-none">
          {/* Logo with TikTok Cyan/Red-Pink Chromatic Note */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <span className="absolute text-2xl font-black text-[#25F4EE] -translate-x-[2px] -translate-y-[1px] select-none opacity-90 transition-transform group-hover:-translate-x-[3px]">♪</span>
              <span className="absolute text-2xl font-black text-[#FE2C55] translate-x-[2px] translate-y-[1px] select-none opacity-90 transition-transform group-hover:translate-x-[3px]">♪</span>
              <span className="relative text-2xl font-black text-zinc-900 dark:text-white select-none">♪</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Central<span className="text-[#FE2C55]">Tok</span>
            </span>
          </Link>

          {/* TikTok Capsule Search Bar */}
          <div className="flex-1 max-w-md mx-8">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-full px-4 py-2 border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-600 transition-all">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts and videos" 
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 pr-2"
              />
              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 mr-1"
                >
                  <X size={14} />
                </button>
              )}
              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-2" />
              <button type="submit" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1">
                <Search size={17} />
              </button>
            </form>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-3">
            <Link 
              to="/upload"
              onClick={(e) => handleNavClick(e, '/upload')}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm font-bold text-xs uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-zinc-800 dark:text-zinc-200 shadow-sm"
            >
              <PlusSquare size={16} />
              <span>Upload</span>
            </Link>

            <button
              onClick={() => {
                if (!currentUser) setShowAuthModal(true);
                else navigate('/messages');
              }}
              className="relative p-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Messages"
            >
              <MessageSquare size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#FE2C55] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <button 
              onClick={toggleTheme}
              className="p-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              title="Appearance"
            >
              {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
            </button>

            {!currentUser ? (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-2 rounded-md bg-[#FE2C55] hover:bg-[#e0264a] text-white font-bold text-sm shadow-md transition-all active:scale-95"
              >
                Log in
              </button>
            ) : (
              <div 
                onClick={() => navigate(`/profile/${currentUser.handle}`)}
                className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.username} 
                  className="w-8 h-8 rounded-full object-cover border border-zinc-300 dark:border-zinc-700" 
                />
                {currentUser.isCentralPro && <CentralProBadge />}
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main Body: Desktop Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Desktop */}
        {!isIntro && (
          <motion.div 
            id="desktop-sidebar"
            animate={{ 
              x: isGameActive ? -256 : 0,
              width: isGameActive ? 0 : 256,
              opacity: isGameActive ? 0 : 1
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="hidden md:flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/80 p-3 shrink-0 h-full bg-white dark:bg-zinc-950 z-30 overflow-y-auto hide-scrollbar select-none"
          >
            {/* Primary Navigation (TikTok Style) */}
            <nav className="space-y-1 pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/forum' && location.pathname.startsWith('/forum'));
                const isMessages = item.label === 'Messages';
                return (
                  <Link 
                    key={item.label} 
                    to={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all relative group ${
                      isActive 
                        ? 'text-[#FE2C55] font-black bg-[#FE2C55]/10' 
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 font-bold text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <item.icon className={`transition-all ${isActive ? 'fill-current scale-105' : 'group-hover:scale-105'}`} size={22} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-base tracking-tight">{item.label}</span>
                    {isMessages && unreadCount > 0 && (
                      <span className="ml-auto bg-[#FE2C55] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                        {unreadCount}
                      </span>
                    )}
                    {isActive && (
                      <motion.div layoutId="nav-active" className="absolute left-0 w-1.5 h-6 bg-[#FE2C55] rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Suggested Creators Section (Classic TikTok Sidebar) */}
            {suggestedUsers.length > 0 && (
              <div className="py-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                  Suggested Creators
                </p>
                <div className="space-y-1">
                  {suggestedUsers.map(u => (
                    <Link
                      key={u.id}
                      to={`/profile/${u.handle}`}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
                    >
                      <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-zinc-800 dark:text-zinc-200 group-hover:text-[#FE2C55] flex items-center gap-1">
                          <span>{u.username}</span>
                          {u.isVerified && <HolographicBadge />}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">@{u.handle}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Frame & CentralPro Section */}
            <div className="py-3 space-y-3">
              {!currentUser ? (
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                  <p className="text-xs text-zinc-500">Log in to like videos, comment, and follow creators.</p>
                  <button 
                    onClick={() => setShowAuthModal(true)}
                    className="w-full py-2 bg-[#FE2C55] hover:bg-[#e0264a] text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Log in
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => navigate(`/profile/${currentUser.handle}`)}
                  className="flex items-center gap-3 p-2 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50"
                >
                  <img src={currentUser.avatarUrl} alt={currentUser.username} className="w-10 h-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate flex items-center gap-1">
                      <span className={currentUser.displayNameFont || ''}>{currentUser.username}</span>
                      {currentUser.isVerified && <HolographicBadge />}
                      {currentUser.isCentralPro && <CentralProBadge />}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">@{currentUser.handle}</p>
                  </div>
                </div>
              )}

              {/* CentralPro Section below person profile frame */}
              <div 
                onClick={() => setShowCentralProModal(true)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl p-2.5 bg-gradient-to-r from-blue-950/80 via-slate-900/80 to-indigo-950/80 border border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-110 group-hover:rotate-6 transition-transform shrink-0">
                      <Rocket size={16} className="animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-200">
                          CENTRALPRO
                        </span>
                        {currentUser?.isCentralPro ? (
                          <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 font-extrabold rounded-full border border-emerald-400/30">
                            PRO
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 font-extrabold rounded-full border border-cyan-400/30">
                            $0.50
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate group-hover:text-cyan-300 transition-colors">
                        {currentUser?.isCentralPro ? 'Cosmic Perks Active' : 'Banners, Fonts & Perks'}
                      </p>
                    </div>
                  </div>
                  <Sparkles size={14} className="text-cyan-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
              </div>
            </div>

            {/* TikTok Desktop Footer Links */}
            <div className="mt-auto pt-4 text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <span className="hover:underline cursor-pointer">About</span>
                <span className="hover:underline cursor-pointer">Newsroom</span>
                <span className="hover:underline cursor-pointer">Contact</span>
                <span className="hover:underline cursor-pointer">Careers</span>
                <span className="hover:underline cursor-pointer">Community</span>
                <span className="hover:underline cursor-pointer">Guidelines</span>
                <span className="hover:underline cursor-pointer">Terms</span>
                <span className="hover:underline cursor-pointer">Privacy</span>
              </div>
              <p className="text-[10px] text-zinc-500">© 2026 CentralTok</p>
            </div>
          </motion.div>
        )}

        {/* Main Content */}
        <main id="main-content" className={`flex-1 relative h-full overflow-hidden flex justify-center transition-all duration-500 ${isGameActive ? 'pl-0' : ''}`}>
          {children}
        </main>
      </div>

      <MiniPlayer />

      {/* Forum Announcement Toast (Triggered immediately when user comes online) */}
      {forumToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-[94%] max-w-md bg-[#1e1f22] text-white border border-[#5865F2] rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#5865F2] flex items-center justify-center shrink-0 text-white font-bold text-2xl shadow-lg animate-pulse">
            📢
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-[#5865F2] uppercase tracking-[0.2em]">Announcement</span>
              <span className="text-[10px] text-zinc-400 truncate font-bold">@{forumToast.authorName}</span>
            </div>
            <p className="text-sm font-black truncate text-white mt-0.5">{forumToast.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                if (currentUser && forumToast.id.startsWith('notif_')) {
                  await markNotificationAsRead(forumToast.id);
                } else {
                  localStorage.setItem(`seen_guest_forum_${forumToast.id}`, 'true');
                }
                setForumToast(null);
                navigate('/forum/updates');
              }}
              className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-[11px] font-black rounded-xl transition-all shadow-lg active:scale-95"
            >
              View
            </button>
            <button
              onClick={async () => {
                if (currentUser && forumToast.id.startsWith('notif_')) {
                  await markNotificationAsRead(forumToast.id);
                } else {
                  localStorage.setItem(`seen_guest_forum_${forumToast.id}`, 'true');
                }
                setForumToast(null);
              }}
              className="p-2 text-zinc-500 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {messageToast && (
        <button 
          onClick={() => { navigate(`/messages/${messageToast.handle}`); setMessageToast(null); }} 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 rounded-2xl bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-800 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in slide-in-from-top-10 transition-transform hover:scale-105 active:scale-95"
        >
          <div className="relative">
            <img src={messageToast.avatarUrl} alt="" className="w-12 h-12 rounded-full border-2 border-pink-500" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-pink-600 rounded-full border-2 border-white dark:border-zinc-900" />
          </div>
          <div className="text-left">
            <strong className="block text-zinc-900 dark:text-white font-black tracking-tight">{messageToast.username}</strong>
            <span className="text-xs font-bold text-zinc-500 flex items-center gap-1">
              <MessageSquare size={10} className="text-pink-600" /> New message received
            </span>
          </div>
        </button>
      )}

      {rewardToast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[1000] w-[94%] max-w-sm flex flex-col gap-3 rounded-2xl ${rewardToast.isImportant ? 'bg-indigo-700' : 'bg-indigo-600'} text-white p-4 shadow-[0_20px_50px_rgba(79,70,229,0.3)] animate-in slide-in-from-top-10 duration-500 border border-white/20`}>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
               <img src={rewardToast.fromUserAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=owner'} alt="" className="w-12 h-12 rounded-full border-2 border-white/30" />
               <div className="absolute -bottom-1 -right-1 bg-white text-indigo-600 rounded-full p-1 shadow-lg">
                  <ShieldCheck size={14} />
               </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-bold text-sm truncate">Message from @{rewardToast.fromUserHandle}</h4>
                {rewardToast.isImportant && (
                  <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest animate-pulse">Important</span>
                )}
              </div>
              <p className="text-[11px] leading-tight opacity-90 line-clamp-2">{rewardToast.message}</p>
            </div>
            <button 
              onClick={async () => {
                if (currentUser) await markNotificationAsRead(rewardToast.id);
                setRewardToast(null);
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {rewardToast.actionButton && (
            <button
              onClick={async () => {
                if (rewardToast.actionButton?.action === 'show_tradient_info') {
                  setShowTradientInfo(true);
                }
                if (currentUser) await markNotificationAsRead(rewardToast.id);
                setRewardToast(null);
              }}
              className="w-full py-2.5 bg-white text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-100 transition-colors shadow-lg"
            >
              {rewardToast.actionButton.text}
            </button>
          )}
        </div>
      )}

      <TradientInfoModal isOpen={showTradientInfo} onClose={() => setShowTradientInfo(false)} />
      
      {/* Mobile Bottom Nav */}
      {!isIntro && (
        <motion.div 
          id="mobile-bottom-nav"
          animate={{ y: isGameActive ? 100 : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 py-3 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
        >
          <Link to="/" onClick={(e) => handleNavClick(e, '/')} className="p-2.5 relative group">
            <Home size={26} className={location.pathname === '/' ? 'text-pink-600 fill-current drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'text-zinc-500'} />
            {location.pathname === '/' && <motion.div layoutId="mob-nav" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pink-600 rounded-full" />}
          </Link>
          <Link to="/explore" onClick={(e) => handleNavClick(e, '/explore')} className="p-2.5 relative">
            <Compass size={26} className={location.pathname === '/explore' ? 'text-pink-600 fill-current drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'text-zinc-500'} />
            {location.pathname === '/explore' && <motion.div layoutId="mob-nav" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pink-600 rounded-full" />}
          </Link>
          <Link to="/upload" onClick={(e) => handleNavClick(e, '/upload')} className="p-1 transform hover:scale-110 active:scale-95 transition-transform">
            <div className="w-12 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-pink-500 to-purple-600 p-[2px] shadow-lg shadow-pink-500/20">
              <div className="w-full h-full bg-black dark:bg-zinc-900 rounded-[10px] flex items-center justify-center">
                <PlusSquare size={20} className="text-white" />
              </div>
            </div>
          </Link>
          <Link to="/forum" onClick={(e) => handleNavClick(e, '/forum')} className="p-2.5 relative">
            <HelpCircle size={26} className={location.pathname.startsWith('/forum') ? 'text-pink-600 fill-current drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'text-zinc-500'} />
            {location.pathname.startsWith('/forum') && <motion.div layoutId="mob-nav" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pink-600 rounded-full" />}
          </Link>
          <Link to="/messages" onClick={(e) => handleNavClick(e, '/messages')} className="p-2.5 relative">
            <MessageSquare size={26} className={location.pathname === '/messages' ? 'text-pink-600 fill-current drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'text-zinc-500'} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-pink-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                {unreadCount}
              </span>
            )}
            {location.pathname === '/messages' && <motion.div layoutId="mob-nav" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pink-600 rounded-full" />}
          </Link>
          <Link to={currentUser ? `/profile/${currentUser.handle}` : '#'} onClick={(e) => handleNavClick(e, currentUser ? `/profile/${currentUser.handle}` : '#')} className="p-2.5 relative">
            {currentUser ? (
              <img src={currentUser.avatarUrl} className={`w-8 h-8 rounded-full border-2 transition-all ${location.pathname.includes('/profile') ? 'border-pink-600 scale-110 shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'border-zinc-300 dark:border-zinc-700'}`} alt="" />
            ) : (
              <User size={26} className="text-zinc-500" />
            )}
            {location.pathname.includes('/profile') && <motion.div layoutId="mob-nav" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pink-600 rounded-full" />}
          </Link>
        </motion.div>
      )}
      
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      
      <ForumChooserModal 
        isOpen={showForumChooser} 
        onClose={() => setShowForumChooser(false)} 
      />
      
      {showVerificationModal && currentUser && (
        <VerificationModal 
          user={currentUser} 
          onClose={() => setShowVerificationModal(false)} 
        />
      )}

      <AnimatePresence>
        {activeIncomingCall && (
          <IncomingCallModal 
            call={activeIncomingCall} 
            onClose={() => setActiveIncomingCall(null)} 
          />
        )}
      </AnimatePresence>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ShieldAlert size={24} className="text-pink-600" /> Support & Bug Report
              </h3>
              <button onClick={() => setShowSupportModal(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            {supportSent ? (
              <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-xl text-center font-medium">
                Your report has been sent to the staff. Thank you!
              </div>
            ) : !supportType ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Choose a request type.</p>
                <button onClick={() => setSupportType('support')} className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl">Support</button>
                <button onClick={() => setSupportType('bug')} className="w-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 font-bold py-3 rounded-xl">Bugs/Issues</button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">State your issue, and wait until a staff replies.</p>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="What happened?"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-xl p-4 min-h-[120px] focus:outline-none focus:border-pink-500 focus:bg-white dark:focus:bg-black transition-all resize-none"
                />
                <button
                  onClick={handleSupportSubmit}
                  disabled={!supportMessage.trim()}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
                >
                  Send to Staff
                </button>
                <button onClick={() => setSupportType(null)} className="w-full text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Back</button>
              </div>
            )}
          </div>
        </div>
      )}
      <GlobalMusicBubble />
      <IframeDomainNotice />
      <CentralProModal isOpen={showCentralProModal} onClose={() => setShowCentralProModal(false)} />
    </div>
  );
}

function IframeDomainNotice() {
  const [isTargetDomain, setIsTargetDomain] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const hostname = window.location.hostname || '';
      const href = window.location.href || '';
      const referrer = document.referrer || '';

      let matched =
        hostname.includes('windows11-unblocked.pages.dev') ||
        href.includes('windows11-unblocked.pages.dev') ||
        referrer.includes('windows11-unblocked.pages.dev');

      if (!matched && window.location.ancestorOrigins) {
        for (let i = 0; i < window.location.ancestorOrigins.length; i++) {
          if (window.location.ancestorOrigins[i].includes('windows11-unblocked.pages.dev')) {
            matched = true;
            break;
          }
        }
      }

      // Also support preview testing via query parameter ?iframe_notice=1
      if (!matched && (href.includes('iframe_notice') || window.location.search.includes('iframe_notice'))) {
        matched = true;
      }

      setIsTargetDomain(matched);
    } catch {
      // ignore
    }
  }, []);

  if (!isTargetDomain) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[99999]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsHovered((prev) => !prev)}
    >
      <motion.div
        layout
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: isHovered ? 1.05 : 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className={`relative flex items-center shadow-2xl backdrop-blur-xl border border-white/20 transition-all duration-300 cursor-pointer overflow-hidden ${
          isHovered
            ? 'bg-zinc-900/95 text-white rounded-2xl p-4 max-w-sm sm:max-w-md ring-2 ring-pink-500/50 shadow-pink-500/30'
            : 'bg-zinc-900/90 hover:bg-zinc-800 text-pink-500 rounded-full p-3 shadow-lg hover:scale-110 ring-1 ring-zinc-700/60'
        }`}
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 shadow-inner">
            <Info size={22} className={isHovered ? 'animate-pulse' : ''} />
          </div>
        </div>

        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            className="ml-3 pr-1 text-sm font-medium leading-relaxed"
          >
            <span>This is being ran in Iframe, enter </span>
            <a
              href="https://thegoogleclassroom.github.io/windows11tiktok/#/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-pink-400 hover:text-pink-300 underline font-semibold break-all inline-block"
            >
              https://thegoogleclassroom.github.io/windows11tiktok/#/
            </a>
            <span> for more features</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function CentralProModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { currentUser, setCurrentUser, setShowAuthModal } = useAppStore();
  const [selectedPlan, setSelectedPlan] = useState<'forever' | 'monthly'>('forever');
  const [selectedFont, setSelectedFont] = useState(currentUser?.displayNameFont || 'font-mono tracking-wider text-cyan-400 font-bold');
  const [selectedBanner, setSelectedBanner] = useState(currentUser?.profileBannerUrl || 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80');
  const [explosionKey, setExplosionKey] = useState(0);
  const [copiedCashApp, setCopiedCashApp] = useState(false);
  const [isCashAppHovered, setIsCashAppHovered] = useState(false);
  const [showCopyWarningModal, setShowCopyWarningModal] = useState(false);
  const [submittingConfirmation, setSubmittingConfirmation] = useState(false);

  const isPending = currentUser?.centralProStatus === 'pending';
  const isAlreadyActive = currentUser?.isCentralPro;

  useEffect(() => {
    if (isOpen) {
      setExplosionKey(prev => prev + 1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const FONTS = [
    { id: '', label: 'Default', style: 'font-sans font-bold' },
    { id: 'font-mono tracking-wider text-cyan-400 font-bold', label: 'Cyber Mono', style: 'font-mono tracking-wider text-cyan-400 font-bold' },
    { id: 'font-serif italic font-extrabold text-amber-300 tracking-wide', label: 'Royal Serif', style: 'font-serif italic font-extrabold text-amber-300 tracking-wide' },
    { id: 'font-mono uppercase font-black tracking-[0.2em] text-blue-400', label: 'Glitch Tech', style: 'font-mono uppercase font-black tracking-[0.2em] text-blue-400' },
    { id: 'italic font-bold tracking-wide text-pink-400', label: 'Neon Script', style: 'italic font-bold tracking-wide text-pink-400' }
  ];

  const BANNERS = [
    { name: 'Deep Space', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80' },
    { name: 'Cyber Matrix', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80' },
    { name: 'Synthwave', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80' },
    { name: 'Midnight Galaxy', url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?w=1200&q=80' }
  ];

  const handleCopyCashApp = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText('$ZaelLac');
    setCopiedCashApp(true);
    setShowCopyWarningModal(true);
    setTimeout(() => setCopiedCashApp(false), 2500);
  };

  const handleConfirmPayment = async () => {
    if (!currentUser) {
      onClose();
      setShowAuthModal(true);
      return;
    }
    setSubmittingConfirmation(true);
    try {
      await requestCentralProVerification(currentUser, selectedPlan);
      setCurrentUser({
        ...currentUser,
        centralProStatus: 'pending',
        centralProPlan: selectedPlan,
        displayNameFont: selectedFont,
        profileBannerUrl: selectedBanner
      });
    } catch (err) {
      console.error(err);
      alert('Failed to submit payment confirmation. Please try again.');
    } finally {
      setSubmittingConfirmation(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-gradient-to-b from-[#050b18] via-[#091124] to-[#030712] border-2 border-cyan-500/50 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.35)] text-white overflow-hidden my-auto max-h-[95vh] flex flex-col"
      >
        {/* Deep Space Background Canvas with Twinkling Stars */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          {Array.from({ length: 30 }).map((_, i) => (
            <div 
              key={i} 
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                top: `${(i * 17) % 95}%`,
                left: `${(i * 23) % 95}%`,
                animationDuration: `${2 + (i % 4)}s`,
                opacity: 0.3 + ((i % 5) * 0.15)
              }}
            />
          ))}
        </div>

        {/* Modal Top Bar */}
        <div className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-cyan-500/30 bg-[#050b18]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Rocket size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-200">
                  CENTRALPRO
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                  COSMIC PASS
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Exclusive Profiles, Banners & Verified Super-Powers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExplosionKey(k => k + 1)}
              className="px-2.5 py-1.5 text-xs font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
              title="Re-play CT Blast"
            >
              <Sparkles size={13} className="text-cyan-400" />
              <span>Blast CT</span>
            </button>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* 1. CT BLOWING UP ANIMATION (Blue Color) + SPACESHIP HOVERING WITH FIRE ANIMATION */}
          <div className="relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-blue-950/60 via-slate-950/90 to-black p-6 flex flex-col items-center justify-center min-h-[220px]">
            {/* Blue CT Shockwaves & Shard Explosions */}
            <AnimatePresence mode="wait">
              <div key={explosionKey} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Concentric Shockwave Rings */}
                <motion.div 
                  initial={{ scale: 0.2, opacity: 1 }}
                  animate={{ scale: [0.2, 1.8, 3.2], opacity: [1, 0.7, 0] }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  className="absolute w-44 h-44 rounded-full border-2 border-cyan-400 shadow-[0_0_50px_#00e5ff]"
                />
                <motion.div 
                  initial={{ scale: 0.2, opacity: 0.9 }}
                  animate={{ scale: [0.2, 2.2, 4], opacity: [0.9, 0.5, 0] }}
                  transition={{ duration: 1.6, delay: 0.1, ease: "easeOut" }}
                  className="absolute w-44 h-44 rounded-full border border-blue-500 shadow-[0_0_60px_#3b82f6]"
                />
                {/* 16 Radiating Blue Spark Shards */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i * 360) / 16;
                  const rad = (angle * Math.PI) / 180;
                  const dist = 140;
                  const x = Math.cos(rad) * dist;
                  const y = Math.sin(rad) * dist;
                  return (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, scale: 1.2, opacity: 1 }}
                      animate={{ x, y, scale: 0, opacity: 0 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="absolute w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_12px_#00f0ff]"
                    />
                  );
                })}
                {/* Flash of Blue Light */}
                <motion.div
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="absolute inset-0 bg-blue-500/25 pointer-events-none"
                />
              </div>
            </AnimatePresence>

            {/* CT Logo Detonation Display */}
            <div className="relative z-10 flex flex-col items-center mb-3">
              <motion.div 
                key={`ct-emblem-${explosionKey}`}
                initial={{ scale: 0.4, opacity: 0.6, rotate: -8 }}
                animate={{ scale: [0.4, 1.25, 1], opacity: 1, rotate: [0, 4, 0] }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative flex items-center justify-center"
              >
                <span className="text-4xl sm:text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 drop-shadow-[0_0_25px_rgba(6,182,212,0.9)]">
                  CT
                </span>
                <span className="absolute -top-1 -right-7 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50">
                  BLAST
                </span>
              </motion.div>
              <p className="text-[11px] font-mono tracking-widest text-cyan-300/80 uppercase mt-1">
                SYSTEM OVERLOAD • CENTRALTOK PRIME
              </p>
            </div>

            {/* SPACESHIP IN SPACE HOVERING WITH FIRE ANIMATIONS AT BOTTOM */}
            <div className="relative z-10 mt-2 flex flex-col items-center">
              <motion.div
                animate={{ 
                  y: [-6, 6, -6],
                  rotate: [-1.2, 1.2, -1.2]
                }}
                transition={{ 
                  duration: 3.6, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="relative flex flex-col items-center"
              >
                {/* Spaceship Vector Graphic */}
                <svg width="84" height="64" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_15px_rgba(6,182,212,0.7)]">
                  {/* Outer Wings */}
                  <path d="M10 65 L45 20 L55 20 L90 65 L75 65 L55 45 L45 45 L25 65 Z" fill="#0f172a" stroke="#06b6d4" strokeWidth="2" />
                  {/* Wing Cannons / Energy Conduits */}
                  <line x1="20" y1="65" x2="20" y2="40" stroke="#38bdf8" strokeWidth="2.5" />
                  <line x1="80" y1="65" x2="80" y2="40" stroke="#38bdf8" strokeWidth="2.5" />
                  {/* Cockpit Hull */}
                  <path d="M50 8 L64 45 L50 68 L36 45 Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  {/* Cockpit Canopy Glass Glow */}
                  <ellipse cx="50" cy="34" rx="8" ry="16" fill="#06b6d4" opacity="0.85" />
                  <ellipse cx="49" cy="30" rx="4" ry="9" fill="#ffffff" opacity="0.7" />
                  {/* Dual Thruster Nozzles at Bottom */}
                  <rect x="40" y="66" width="7" height="6" rx="1.5" fill="#334155" stroke="#06b6d4" strokeWidth="1" />
                  <rect x="53" y="66" width="7" height="6" rx="1.5" fill="#334155" stroke="#06b6d4" strokeWidth="1" />
                </svg>

                {/* ANIMATED FIRE THRUSTER FLAMES AT THE BOTTOM OF THE SHIP */}
                <div className="flex items-start justify-center gap-3.5 -mt-1">
                  {/* Left Thruster Flame */}
                  <div className="relative flex flex-col items-center">
                    {/* Outer Fiery Orange Flame */}
                    <motion.div
                      animate={{
                        scaleY: [1.1, 1.7, 0.95, 1.6, 1.1],
                        scaleX: [0.9, 1.15, 0.95, 1.1, 0.9],
                        opacity: [0.85, 1, 0.75, 1, 0.85]
                      }}
                      transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
                      className="w-3.5 h-7 bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 rounded-b-full filter blur-[1px] origin-top shadow-[0_0_15px_#f97316]"
                    />
                    {/* Inner Intense Cyan/White Plasma Core */}
                    <motion.div
                      animate={{
                        scaleY: [1, 1.45, 0.85, 1.35, 1],
                        opacity: [0.9, 1, 0.8, 1, 0.9]
                      }}
                      transition={{ duration: 0.25, repeat: Infinity, ease: "linear" }}
                      className="absolute top-0 w-1.5 h-4 bg-gradient-to-b from-white via-cyan-200 to-blue-400 rounded-b-full origin-top shadow-[0_0_8px_#00f0ff]"
                    />
                    {/* Dropping Fire Sparks */}
                    <motion.div
                      animate={{ y: [0, 16], opacity: [0.9, 0], scale: [1, 0.2] }}
                      transition={{ duration: 0.5, repeat: Infinity, ease: "easeIn" }}
                      className="absolute top-5 w-1 h-1 rounded-full bg-yellow-300"
                    />
                  </div>

                  {/* Right Thruster Flame */}
                  <div className="relative flex flex-col items-center">
                    {/* Outer Fiery Orange Flame */}
                    <motion.div
                      animate={{
                        scaleY: [1.15, 1.6, 1, 1.7, 1.15],
                        scaleX: [1, 0.9, 1.1, 0.95, 1],
                        opacity: [0.9, 0.8, 1, 0.85, 0.9]
                      }}
                      transition={{ duration: 0.38, repeat: Infinity, ease: "easeInOut", delay: 0.05 }}
                      className="w-3.5 h-7 bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 rounded-b-full filter blur-[1px] origin-top shadow-[0_0_15px_#f97316]"
                    />
                    {/* Inner Intense Cyan/White Plasma Core */}
                    <motion.div
                      animate={{
                        scaleY: [0.9, 1.4, 1, 1.3, 0.9],
                        opacity: [0.85, 1, 0.9, 1, 0.85]
                      }}
                      transition={{ duration: 0.28, repeat: Infinity, ease: "linear", delay: 0.05 }}
                      className="absolute top-0 w-1.5 h-4 bg-gradient-to-b from-white via-cyan-200 to-blue-400 rounded-b-full origin-top shadow-[0_0_8px_#00f0ff]"
                    />
                    {/* Dropping Fire Sparks */}
                    <motion.div
                      animate={{ y: [0, 16], opacity: [0.9, 0], scale: [1, 0.2] }}
                      transition={{ duration: 0.45, repeat: Infinity, ease: "easeIn", delay: 0.15 }}
                      className="absolute top-5 w-1 h-1 rounded-full bg-orange-300"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* 2. THE SCREEN: FULL PREVIEW OF THEIR PROFILE WITH NEW FEATURES */}
          <div className="rounded-2xl border-2 border-cyan-500/50 bg-[#070e1e]/90 p-5 shadow-2xl relative overflow-hidden">
            {/* Screen Cyber HUD Corner Accents */}
            <div className="absolute top-2 left-2 text-[9px] font-mono text-cyan-400 tracking-widest uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              LIVE SCREEN PREVIEW • CENTRALPRO ENGINE
            </div>
            <div className="absolute top-2 right-2 text-[9px] font-mono text-cyan-400 tracking-widest uppercase">
              FEED RESILIENT [VIP]
            </div>

            {/* Profile Banner Preview */}
            <div className="mt-6 relative h-28 rounded-xl overflow-hidden border border-cyan-400/30 group">
              <img 
                src={selectedBanner} 
                alt="Banner Preview" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute bottom-2 left-3 text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm border border-cyan-500/40">
                🌌 Background Profile Banner
              </div>
            </div>

            {/* Banner Quick Switcher Chips */}
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 items-center">
              <span className="text-[10px] text-zinc-400 font-bold shrink-0">Switch Banner:</span>
              {BANNERS.map(b => (
                <button
                  key={b.name}
                  onClick={() => setSelectedBanner(b.url)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                    selectedBanner === b.url 
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30 font-black' 
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>

            {/* Profile User Info Preview */}
            <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-start gap-4 p-3 bg-black/40 rounded-xl border border-white/10">
              <div className="relative shrink-0">
                <img 
                  src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                />
                <div className="absolute -bottom-1 -right-1">
                  <CentralProBadge />
                </div>
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h3 className={`text-xl truncate ${selectedFont}`}>
                    {currentUser?.username || 'CosmicPilot'}
                  </h3>
                  <CentralProBadge />
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  @{currentUser?.handle || 'pilot'} • CentralPro Member 🚀
                </p>
                <p className="text-xs text-zinc-300 mt-1 line-clamp-1">
                  {currentUser?.bio || 'Living in deep space. CentralPro gives me cosmic powers!'}
                </p>
              </div>
            </div>

            {/* Multiple Display Name Fonts Switcher Strip */}
            <div className="mt-4">
              <label className="block text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sparkles size={12} /> Choose Display Name Font Style:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FONTS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFont(f.id)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      selectedFont === f.id
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/30'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-[10px] text-zinc-500 font-bold">{f.label}</p>
                    <p className={`text-xs truncate mt-0.5 ${f.id || 'font-sans'}`}>
                      {currentUser?.username || 'CentralPilot'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* CentralPro Perks List Breakdown */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-4 border-t border-cyan-500/20">
              <div className="flex items-start gap-2 p-2 bg-white/5 rounded-xl">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Background Profile Banner</p>
                  <p className="text-[10px] text-zinc-400">Custom panoramic space art across your profile.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white/5 rounded-xl">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Multiple Display Name Fonts</p>
                  <p className="text-[10px] text-zinc-400">Cyber, Serif, Glitch, Script styling on profile & posts.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white/5 rounded-xl">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Everything In Verified Perks</p>
                  <p className="text-[10px] text-zinc-400">HD uploads, long captions, boost, VIP themes unlocked!</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-white/5 rounded-xl">
                <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-white">Exclusive CentralPro Badge</p>
                  <p className="text-[10px] text-zinc-400">Cooler cosmic rocket badge instead of standard checkmark.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. PRICING CARDS */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">Select Your Plan:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pay Forever Cost: $1 */}
              <div 
                onClick={() => setSelectedPlan('forever')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden ${
                  selectedPlan === 'forever' 
                    ? 'border-cyan-400 bg-gradient-to-br from-cyan-950/70 via-blue-950/60 to-indigo-950/80 shadow-lg shadow-cyan-500/25' 
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-[9px] font-black rounded-full uppercase tracking-wider">
                  BEST VALUE
                </div>
                <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Pay Forever</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-white">$1</span>
                  <span className="text-xs text-zinc-400 font-semibold">one-time / lifetime</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-2">
                  Pay once and keep CentralPro perks permanently. Never renews.
                </p>
              </div>

              {/* Monthly Cost: $0.50 */}
              <div 
                onClick={() => setSelectedPlan('monthly')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative overflow-hidden ${
                  selectedPlan === 'monthly' 
                    ? 'border-cyan-400 bg-gradient-to-br from-cyan-950/70 via-blue-950/60 to-indigo-950/80 shadow-lg shadow-cyan-500/25' 
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Monthly Pass</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-white">$0.50</span>
                  <span className="text-xs text-zinc-400 font-semibold">/ month</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-2">
                  Affordable monthly pass. Cancel or renew whenever you want.
                </p>
              </div>
            </div>
          </div>

          {/* 4. "Cash App: $ZaelLac" (Greyish block, hover mouse over to fade out and reveal censored stuff) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <span>Payment Destination:</span>
                <span className="text-[10px] text-zinc-500">(Hover grey block to uncover)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">Verified Cashtag</span>
            </div>

            {/* THE GREYISH CENSORED CASH APP BLOCK (Smooth Hover Fade + Copy on Click) */}
            <div 
              onMouseEnter={() => setIsCashAppHovered(true)}
              onMouseLeave={() => setIsCashAppHovered(false)}
              onClick={handleCopyCashApp}
              className="group relative overflow-hidden rounded-2xl bg-zinc-800/90 border border-zinc-700/80 p-4 transition-all duration-300 shadow-xl cursor-pointer hover:border-emerald-500/50"
              title="Click or hover to reveal & copy $ZaelLac"
            >
              {/* Uncensored Inner Content */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00D632] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#00D632]/30 shrink-0">
                    $
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white tracking-wide">
                        Cash App: <span className="text-[#00D632] font-black">$ZaelLac</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Send {selectedPlan === 'forever' ? '$1.00' : '$0.50'} • Include your username in the note
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCashApp}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-600/30 shrink-0 z-20"
                >
                  {copiedCashApp ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedCashApp ? 'Copied $ZaelLac' : 'Copy'}</span>
                </button>
              </div>

              {/* The Greyish Cover Block (Fades out when hovered or clicked) */}
              <div 
                className={`absolute inset-0 bg-zinc-700/95 dark:bg-zinc-800/95 backdrop-blur-sm flex items-center justify-center select-none z-10 border border-zinc-600 pointer-events-none transition-opacity duration-300 ease-out ${
                  isCashAppHovered ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'
                }`}
              >
                <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>🔒 Hover cursor here to reveal Cash App</span>
                </div>
              </div>
            </div>
          </div>

          {/* Copy Warning Modal: Username in Note Notice */}
          {showCopyWarningModal && (
            <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-zinc-950 border-2 border-amber-500/80 rounded-3xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(245,158,11,0.35)] text-center relative overflow-hidden">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/40">
                  <AlertTriangle size={32} className="animate-bounce" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                  CRITICAL CASH APP REQUIREMENT
                </span>
                <h3 className="text-lg font-black text-white mt-3 mb-2">
                  Payment Note Requirement
                </h3>
                <div className="p-4 bg-red-950/60 border-2 border-red-500/80 rounded-2xl my-3 text-red-200 text-sm font-black leading-relaxed shadow-lg shadow-red-950/50">
                  "Make a note saying your username in centraltok, to confirm your purchase, if not THERE ARE NO REFUNDS!!"
                </div>
                <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                  Cashtag <span className="text-emerald-400 font-bold">$ZaelLac</span> has been copied. In Cash App, make sure to write <span className="text-cyan-300 font-bold">@{currentUser?.handle || 'your_username'}</span> in the note field before sending payment.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCopyWarningModal(false)}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  I Understand & Will Include Note
                </button>
              </div>
            </div>
          )}

          {/* Purchase Confirmation Flow */}
          <div className="pt-2">
            {isAlreadyActive ? (
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-400/50 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 text-cyan-300 font-black text-sm">
                  <Sparkles size={16} className="text-cyan-400" />
                  <span>Your CentralPro Membership is Active!</span>
                </div>
                <p className="text-xs text-zinc-400">
                  You have all cosmic perks, banners, fonts, and the exclusive rocket badge unlocked.
                </p>
              </div>
            ) : isPending ? (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/40 to-zinc-950 border-2 border-amber-500/50 text-center space-y-2 shadow-xl shadow-amber-500/10 animate-in fade-in">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-black text-base">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                  <span>Confirming If you paid</span>
                </div>
                <p className="text-xs text-zinc-400 font-mono font-medium">
                  This might take an hour or even days
                </p>
                <div className="p-3 bg-black/40 rounded-xl border border-white/10 text-[11px] text-zinc-400 max-w-md mx-auto text-left space-y-1 mt-2">
                  <p className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span>🚨 Priority Support Verification Ticket</span>
                  </p>
                  <p>• Staff and owners have been notified for priority support to review your transaction.</p>
                  <p>• They are checking Cash App (<span className="text-emerald-400 font-bold">$ZaelLac</span>) for <span className="font-mono text-cyan-300">@{currentUser?.handle}</span> in the note.</p>
                  <p>• If confirmed, you will receive a welcome notification and your perks will unlock immediately!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={submittingConfirmation}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 text-white font-black text-sm tracking-wider uppercase rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  <Rocket size={18} />
                  <span>
                    {submittingConfirmation
                      ? 'Submitting Confirmation...'
                      : `I Paid / Confirm Purchase (${selectedPlan === 'forever' ? '$1 Forever' : '$0.50 Monthly'})`}
                  </span>
                </button>
                <p className="text-[11px] text-zinc-500 text-center">
                  Click after sending Cash App with your username in the note. Admins will verify your payment.
                </p>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
}

