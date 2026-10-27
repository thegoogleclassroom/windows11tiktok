import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Compass, PlusSquare, MessageSquare, User, Moon, Sun, LogIn, ShieldAlert, X, HelpCircle, Bell, Gamepad2, ShieldCheck, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { AuthModal } from './AuthModal';
import { MiniPlayer } from './MiniPlayer';
import { saveReports, getMessages, getUsers, getNotifications, markNotificationAsRead, getFAQPosts, subscribeToNotifications, saveGameData, getGameData, subscribeToIncomingCalls, subscribeToMessages } from '../lib/db';
import { TradientInfoModal } from './TradientInfoModal';
import { HolographicBadge } from './UIPolish';
import * as Types from '../types';

import AnnouncementBanner from './AnnouncementBanner';
import { IncomingCallModal } from './IncomingCallModal';

import { VerificationModal } from './VerificationModal';
import { ForumChooserModal } from './ForumChooserModal';
import { GlobalMusicBubble } from './GlobalMusicBubble';

export function Layout({ children }: { children: React.ReactNode }) {
  const { 
    currentUser, 
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
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 overflow-hidden transition-colors">
      <AnnouncementBanner />
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
          className="hidden md:flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/80 p-4 shrink-0 h-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl z-50 overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
        >
          <Link to="/" className="flex flex-col gap-1 mb-6 px-2 group">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl leading-none transform transition-transform group-hover:rotate-6 group-hover:scale-110 shadow-lg shadow-pink-500/20">C</div>
              <div>
                <span className="text-2xl font-black tracking-tighter">Central<span className="text-pink-600">Tok</span></span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400">Social Experience</span>
              </div>
            </div>
          </Link>

          <div className="text-[11px] text-zinc-500 mb-6 bg-gradient-to-br from-zinc-100/80 to-zinc-200/40 dark:from-zinc-900/80 dark:to-zinc-900/40 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 leading-relaxed shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm">BETA v1.0</span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              {currentUser && !currentUser.isVerified && (
                <button 
                  onClick={() => setShowVerificationModal(true)}
                  className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-sm border border-blue-500/25"
                >
                  <ShieldCheck size={12} strokeWidth={3} /> Verify
                </button>
              )}
            </div>
            Bugs or feedback? Reach out to our <button onClick={() => setShowSupportModal(true)} className="text-blue-500 dark:text-blue-400 hover:underline font-bold inline">support desk</button>.
          </div>
        
          <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/forum' && location.pathname.startsWith('/forum'));
              const isMessages = item.label === 'Messages';
              return (
                <Link 
                  key={item.label} 
                  to={item.path}
                  onClick={(e) => handleNavClick(e, item.path)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all relative group ${isActive ? 'text-pink-600 dark:text-pink-500 font-black bg-pink-500/10 border border-pink-500/20 shadow-[0_4px_20px_rgba(236,72,153,0.15)]' : 'hover:bg-zinc-100 dark:hover:bg-white/5 font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                >
                  <item.icon className={`transition-all ${isActive ? 'fill-current scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]' : 'group-hover:scale-110'}`} size={22} strokeWidth={isActive ? 3 : 2} />
                  <span className="text-base tracking-tight">{item.label}</span>
                  {isMessages && unreadCount > 0 && (
                    <span className="ml-auto bg-pink-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(236,72,153,0.5)] animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                  {isActive && (
                    <motion.div layoutId="nav-active" className="absolute left-0 w-1.5 h-7 bg-pink-600 rounded-r-full shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        
          <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-3">
            <Link 
              to="/upload"
              onClick={(e) => handleNavClick(e, '/upload')}
              className="group relative flex items-center justify-center gap-2.5 w-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white py-3.5 rounded-2xl font-black tracking-widest shadow-[0_8px_25px_rgba(236,72,153,0.35)] transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <PlusSquare size={20} strokeWidth={3} />
              <span className="uppercase text-xs">Create Post</span>
            </Link>
            
            <button 
              onClick={toggleTheme}
              className="flex items-center justify-between w-full px-3.5 py-2.5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors font-semibold text-xs"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
                <span>Appearance</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{theme}</span>
            </button>
            
            {!currentUser ? (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="flex items-center justify-center gap-2 w-full bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-pink-600/20"
              >
                <LogIn size={18} />
                <span>Log in</span>
              </button>
            ) : (
              <div 
                onClick={() => navigate(`/@${currentUser.handle}`)}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50"
              >
                <img src={currentUser.avatarUrl} alt={currentUser.username} className="w-10 h-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate flex items-center gap-1">
                    {currentUser.username}
                    {currentUser.isVerified && <HolographicBadge />}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">@{currentUser.handle}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <main id="main-content" className={`flex-1 relative h-full overflow-hidden flex justify-center transition-all duration-500 ${isGameActive ? 'pl-0' : ''}`}>
        {children}
      </main>

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
