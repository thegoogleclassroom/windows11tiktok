import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Rocket, Stars, Sparkles, AlertCircle, Play, Square, LayoutGrid, Users, Lightbulb, X, Send, AlertTriangle, Search, Scale, Mail, Copy, Check, Clock, ShieldCheck, FileText, ArrowLeft, Trash2 } from 'lucide-react';
import { subscribeToAppSettings, getUsers, updateUserGame, submitSuggestion, updateUserListeningState } from '../lib/db';
import { useAppStore } from '../store';
import { User, AppSuggestion } from '../types';
import { GAMES, APPS, GameItem } from '../data/games';

// Preserved HTTPS link for later developer reference (iframe & redirect disabled)
export const SAVED_GTA_IFRAME_URL = 'https://gta5-87g.pages.dev/?low=1&fps=30&res=1280x720';

export function GamesApps() {
  const navigate = useNavigate();
  const { 
    currentUser,
    isGameActive, 
    setIsGameActive, 
    activeGameUrl, 
    setActiveGameUrl,
    activeGameTitle,
    setActiveGameTitle,
    miniPlayerActive,
    setMiniPlayerActive,
    miniPlayerUrl,
    setMiniPlayerUrl,
    miniPlayerTitle,
    setMiniPlayerTitle
  } = useAppStore();
  const [isCrashed, setIsCrashed] = useState(false);
  const [crashGraceSeconds, setCrashGraceSeconds] = useState<number | null>(null);
  const [crashEnforced, setCrashEnforced] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'games' | 'apps'>('games');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestionData, setSuggestionData] = useState({ name: '', type: 'game' as 'game' | 'app', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gtaFlowStep, setGtaFlowStep] = useState<'idle' | 'removed_notice'>('idle');
  const [gtaRedirectCountdown, setGtaRedirectCountdown] = useState(12);
  const [gtaModalSpinning, setGtaModalSpinning] = useState(false);
  const [gtaCardPhase, setGtaCardPhase] = useState<'visible' | 'spinning' | 'gone'>('visible');
  const [gameSearchQuery, setGameSearchQuery] = useState('');

  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      setIsCrashed(Boolean(settings.gamesAppsCrashed || settings.serverCrashed));
    });

    const fetchAllUsers = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const users = await getUsers();
      setAllUsers(users);
    };
    if (!isGameActive) {
      fetchAllUsers();
    }
    const userInterval = isGameActive ? null : setInterval(fetchAllUsers, 300_000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CINEMA_PLAYING') {
        setMiniPlayerTitle(event.data.title);
        setMiniPlayerUrl(event.data.url);
      } else if (event.data.type === 'CINEMA_MINIMIZE') {
        handleExit();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      unsub();
      window.removeEventListener('message', handleMessage);
      if (userInterval) clearInterval(userInterval);
    };
  }, [isGameActive]);

  const handleReturnToGamesMenu = () => {
    if (gtaModalSpinning) return;
    setGtaModalSpinning(true);
    setTimeout(() => {
      setGtaFlowStep('idle');
      setGtaModalSpinning(false);
      setIsGameActive(false);
      setActiveGameUrl('');
      setActiveGameTitle(null);
      navigate('/games-apps');
      setGtaCardPhase('spinning');
      setTimeout(() => {
        setGtaCardPhase('gone');
      }, 800);
    }, 650);
  };

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;
    if (gtaFlowStep === 'removed_notice' && !gtaModalSpinning) {
      setGtaRedirectCountdown(12);
      timerId = setInterval(() => {
        setGtaRedirectCountdown((prev) => {
          if (prev <= 1) {
            if (timerId) clearInterval(timerId);
            handleReturnToGamesMenu();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [gtaFlowStep, gtaModalSpinning]);

  const handleItemClick = (item: GameItem) => {
    if (item.id === 'gta-5-6' || item.title === 'GTA V|VI' || item.title === 'GTA 5/6') {
      if (gtaCardPhase !== 'visible') return;
      setGtaModalSpinning(false);
      setGtaFlowStep('removed_notice');
      setGtaRedirectCountdown(12);
      return;
    }
    launchItem(item.url, item.title);
  };

  const launchItem = async (url: string, title: string) => {
    setActiveGameUrl(url);
    setActiveGameTitle(title);
    setMiniPlayerTitle(title);
    setIsGameActive(true);
    setMiniPlayerActive(false);
    
    if (url.includes('CentralMusic.html')) {
      localStorage.setItem('aura_in_music_app', 'true');
    } else {
      localStorage.setItem('aura_in_music_app', 'false');
    }
    
    if (currentUser) {
      await updateUserGame(currentUser.id, title);
    }
  };

  const handleExit = async () => {
    const exitingMusic = activeGameUrl.includes('CentralMusic.html');
    localStorage.setItem('aura_in_music_app', 'false');
    if (exitingMusic) {
      localStorage.removeItem('aura_current_track');
    }
    if (activeGameUrl.includes('Cinema.html') && miniPlayerUrl) {
      setMiniPlayerActive(true);
    }
    setIsGameActive(false);
    setActiveGameUrl('');
    setActiveGameTitle(null);
    
    if (currentUser) {
      await updateUserGame(currentUser.id, null);
      if (exitingMusic) {
        await updateUserListeningState(currentUser.id, null);
      }
    }
  };

  const getPlayersForGame = (gameTitle: string) => {
    return allUsers.filter(u => u.currentGame === gameTitle && u.showActivityStatus !== false && u.id !== currentUser?.id);
  };

  const handleSuggest = async () => {
    if (!currentUser || !suggestionData.name || !suggestionData.description) return;
    setIsSubmitting(true);
    try {
      const suggestion: AppSuggestion = {
        id: `sugg_${Date.now()}`,
        userId: currentUser.id,
        name: suggestionData.name,
        type: suggestionData.type,
        description: suggestionData.description,
        status: 'pending',
        createdAt: Date.now()
      };
      await submitSuggestion(suggestion);
      setShowSuggestModal(false);
      setSuggestionData({ name: '', type: 'game', description: '' });
      alert("Thanks! Your suggestion has been sent to the admins.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 10-second save progress grace window if Games/Apps crashes while a game/app is actively open
  useEffect(() => {
    if (!isCrashed) {
      setCrashGraceSeconds(null);
      setCrashEnforced(false);
      return;
    }

    if (!isGameActive) {
      setCrashGraceSeconds(null);
      setCrashEnforced(true);
      return;
    }

    if (crashEnforced) return;

    setCrashGraceSeconds(10);
    const interval = setInterval(() => {
      setCrashGraceSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          setCrashEnforced(true);
          localStorage.setItem('aura_in_music_app', 'false');
          setIsGameActive(false);
          setActiveGameUrl('');
          setActiveGameTitle(null);
          if (currentUser) {
            updateUserGame(currentUser.id, null);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isCrashed, isGameActive, crashEnforced]);

  if (isCrashed && (!isGameActive || crashEnforced)) {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <AlertCircle size={40} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Games & Apps has crashed</h1>
        <p className="text-zinc-500 max-w-xs leading-relaxed">
          We are currently experiencing a technical issue with the games and applications service. Please wait shortly for a fix.
        </p>
      </div>
    );
  }

  if (isGameActive) {
    return (
      <div id="game-player-container" className="fixed inset-0 z-[1500] bg-black">
        <div className="absolute top-4 right-4 z-[2000] flex gap-2">
          <button 
            onClick={handleExit}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Square size={14} fill="currentColor" />
            Exit
          </button>
        </div>
        <iframe 
          id="game-iframe"
          src={activeGameUrl} 
          onLoad={() => {
            if (activeGameUrl.includes('CentralMusic.html')) {
              try {
                const raw = localStorage.getItem('aura_listen_along_target');
                if (raw) {
                  const target = JSON.parse(raw);
                  const iframe = document.getElementById('game-iframe') as HTMLIFrameElement | null;
                  if (iframe?.contentWindow && target && (!target.syncedAt || Date.now() - target.syncedAt < 180000)) {
                    iframe.contentWindow.postMessage({ type: 'CENTRALMUSIC_SYNC', payload: target }, '*');
                  }
                }
              } catch {}
            }
          }}
          className="w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title="Game Player"
        />

        {/* 10s Grace Period Translucent Black Screen (opacity 0.5) letting user keep saving/playing */}
        {isCrashed && crashGraceSeconds !== null && !crashEnforced && (
          <div
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            className="fixed inset-0 z-[1900] pointer-events-none flex flex-col items-center justify-start pt-16 sm:pt-20 px-4"
          >
            <div className="bg-black/85 border border-red-500/60 text-white rounded-2xl px-6 py-4 shadow-2xl max-w-lg w-full text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest mb-1.5">
                <AlertTriangle size={16} />
                <span>Service Interrupting in {crashGraceSeconds}s</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Save your Game/App Progress, Something went wrong.
              </h2>
              <p className="text-xs text-zinc-300 mt-1">
                You can continue using the {activeGameTitle || 'game/app'} right now to save your progress before closing.
              </p>
              <div className="mt-3 w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${(crashGraceSeconds / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentList = activeTab === 'games' ? GAMES : APPS;

  return (
    <>
      <div id="games-page" className="w-full h-full bg-zinc-50 dark:bg-zinc-950 p-6 transition-colors overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ y: [-10, 10, -10], rotate: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[5%] opacity-10 text-pink-500"
        >
          <Rocket size={120} />
        </motion.div>
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.15, 0.05] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-40 right-[10%] text-indigo-500"
        >
          <Stars size={160} />
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 pt-8 pb-24">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="text-center md:text-left">
            <h1 className="text-5xl font-black tracking-tighter mb-2 text-zinc-900 dark:text-white">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-indigo-500 uppercase">Playground</span>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold">Discover exclusive games and tools built for you.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Direct Game & App Search Bar */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={gameSearchQuery}
                onChange={(e) => setGameSearchQuery(e.target.value)}
                placeholder="Search games & apps..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-pink-500 shadow-sm transition-all select-text cursor-text"
              />
              {gameSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGameSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-xl">
              <button 
                onClick={() => setActiveTab('games')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'games' ? 'bg-white dark:bg-zinc-800 text-pink-600 shadow-xl' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <Gamepad2 size={18} />
                Games
              </button>
              <button 
                onClick={() => setActiveTab('apps')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'apps' ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-xl' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
              >
                <LayoutGrid size={18} />
                Apps
              </button>
            </div>

            <button 
              onClick={() => setShowSuggestModal(true)}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-orange-500/20"
            >
              <Lightbulb size={14} /> Suggest New
            </button>

            <Link
              to="/dmca"
              className="flex items-center gap-2 px-4 py-3 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-100 border border-zinc-700/80 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-sm"
            >
              <Scale size={14} className="text-pink-400" /> DMCA
            </Link>
          </div>
        </div>

        {/* Category Bubbles Bar */}
        {activeTab === 'games' && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
            {['All', 'Multiplayer', 'Building', 'Fighting', 'Action', 'Puzzle', 'Rhythm', 'Strategy', 'Sports', 'Idle', 'Racing', 'Horror', 'Sandbox'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all shadow-sm ${
                  selectedCategory === cat
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 scale-105'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-pink-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {(() => {
            const baseList = activeTab === 'games' ? GAMES : APPS;
            const currentList = baseList.filter(item => {
              if (item.id === 'gta-5-6' && gtaCardPhase === 'gone') return false;
              if (gameSearchQuery.trim()) {
                const q = gameSearchQuery.toLowerCase();
                const matchesTitle = item.title.toLowerCase().includes(q);
                const matchesCategory = item.category?.toLowerCase().includes(q);
                if (!matchesTitle && !matchesCategory) return false;
              }
              if (activeTab === 'apps') return true;
              if (selectedCategory === 'All') return true;
              return item.category?.toLowerCase() === selectedCategory.toLowerCase();
            });
            return currentList.map((item) => {
            const players = getPlayersForGame(item.title);
            const isGtaSpinningOut = item.id === 'gta-5-6' && gtaCardPhase === 'spinning';
            return (
              <motion.div
                key={item.id}
                layout={!isGtaSpinningOut}
                initial={{ opacity: 0, y: 20 }}
                animate={isGtaSpinningOut ? { rotate: 720, scale: 0, opacity: 0 } : { rotate: 0, scale: 1, opacity: 1, y: 0 }}
                transition={isGtaSpinningOut ? { duration: 0.75, ease: 'easeInOut' } : undefined}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => handleItemClick(item)}
                className={`group cursor-pointer relative wiggy-card ${isGtaSpinningOut ? 'pointer-events-none' : ''}`}
              >
                <div className={`relative z-10 aspect-[4/5] rounded-[2rem] bg-white dark:bg-zinc-900 shadow-lg overflow-hidden flex flex-col transition-all duration-300 group-hover:shadow-2xl ${
                  item.frameColor === 'yellow' || item.isNew
                    ? 'border-4 border-yellow-400 dark:border-yellow-400 ring-4 ring-yellow-400/40 shadow-xl shadow-yellow-500/25'
                    : 'border border-zinc-200 dark:border-zinc-800 group-hover:shadow-pink-500/10'
                } group-active:scale-95`}>
                  {item.badge && (
                    <div className="absolute top-3 left-3 z-30 px-3 py-1 bg-yellow-400 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg border-2 border-yellow-300 flex items-center gap-1.5 animate-pulse">
                      <Sparkles size={12} className="text-zinc-950 fill-zinc-950" />
                      <span>{item.badge}</span>
                    </div>
                  )}
                  <div className={`h-[54%] w-full bg-gradient-to-br flex items-center justify-center relative overflow-hidden ${
                    item.color === 'pink' ? 'from-pink-500 to-rose-600' :
                    item.color === 'purple' ? 'from-purple-500 to-indigo-600' :
                    item.color === 'green' ? 'from-green-500 to-emerald-600' :
                    item.color === 'orange' ? 'from-orange-500 to-amber-600' :
                    item.color === 'red' ? 'from-red-500 to-rose-600' :
                    item.color === 'blue' ? 'from-blue-500 to-cyan-600' :
                    item.color === 'amber' ? 'from-amber-500 to-orange-600' :
                    item.color === 'brown' ? 'from-stone-700 to-zinc-900' :
                    item.color === 'indigo' ? 'from-indigo-500 to-blue-600' :
                    item.color === 'emerald' ? 'from-emerald-500 to-teal-600' :
                    item.color === 'cyan' ? 'from-cyan-400 to-blue-500' :
                    item.color === 'yellow' ? 'from-yellow-400 to-orange-500' :
                    item.color === 'zinc' ? 'from-zinc-400 to-zinc-600' :
                    item.color === 'white' ? 'from-zinc-100 to-zinc-300' :
                    'from-zinc-500 to-zinc-700'
                  }`}>
                    {item.icon ? (
                      <img 
                        src={item.icon} 
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110" 
                      />
                    ) : null}
                    <div
                      style={{ display: item.icon ? 'none' : 'flex' }}
                      className="items-center justify-center w-full h-full relative"
                    >
                      <Gamepad2 size={48} className="text-white/20 absolute -bottom-4 -right-4 rotate-12 scale-150" />
                      <span className="text-white font-black text-4xl drop-shadow-lg">{item.title[0]}</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none" />
                  </div>

                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-lg text-zinc-900 dark:text-white leading-tight mb-1">{item.title}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.category}</p>
                    </div>

                    <div className="mt-4">
                      {players.length > 0 ? (
                        <div className="flex items-center gap-2">
                           <div className="flex -space-x-2">
                            {players.slice(0, 3).map(p => (
                              <img key={p.id} src={p.avatarUrl} className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm" alt="" />
                            ))}
                           </div>
                           <p className="text-[9px] font-bold text-zinc-500 truncate flex-1">
                             {players[0].username} {players.length > 1 ? `& ${players.length - 1} more` : 'is playing'}
                           </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Users size={12} />
                          <span className="text-[9px] font-bold">No one playing</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white text-black px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                      <Play size={14} fill="currentColor" />
                      Play Now
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          });
          })()}
        </div>

        {/* DMCA Copyright Removal Banner */}
        <div className="mt-14 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
              <Scale size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                DMCA &amp; Copyright Takedown Policy
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                If we copied any game or application, or if any title infringes your copyright, copyright holders can request immediate removal by reading our 40-paragraph DMCA policy and emailing{' '}
                <a
                  href="mailto:centraltok-developers@student.jths.org"
                  className="text-pink-600 dark:text-pink-400 font-bold hover:underline select-text"
                >
                  centraltok-developers@student.jths.org
                </a>.
              </p>
            </div>
          </div>
          <Link
            to="/dmca"
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-pink-600/20 shrink-0 flex items-center gap-2 transition-all hover:scale-105"
          >
            <FileText size={15} />
            <span>Open DMCA Page</span>
          </Link>
        </div>
      </div>
      </div>

      <AnimatePresence>
        {showSuggestModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-zinc-900 dark:text-white">
                  <Lightbulb className="text-amber-500" /> Suggest Game/App
                </h3>
                <button onClick={() => setShowSuggestModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full dark:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-2">What is it?</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <button 
                      onClick={() => setSuggestionData(prev => ({ ...prev, type: 'game' }))}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${suggestionData.type === 'game' ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600' : 'text-zinc-500'}`}
                    >
                      Game
                    </button>
                    <button 
                      onClick={() => setSuggestionData(prev => ({ ...prev, type: 'app' }))}
                      className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${suggestionData.type === 'app' ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-600' : 'text-zinc-500'}`}
                    >
                      App
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Name of the {suggestionData.type}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Minecraft, Discord..."
                    value={suggestionData.name}
                    onChange={e => setSuggestionData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 outline-none focus:border-amber-500 font-bold text-zinc-900 dark:text-white select-text cursor-text"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Brief Description</label>
                  <textarea 
                    placeholder="Tell us why we should add this..."
                    value={suggestionData.description}
                    onChange={e => setSuggestionData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 outline-none focus:border-amber-500 h-32 resize-none text-zinc-900 dark:text-white select-text cursor-text"
                  />
                </div>

                <button 
                  disabled={!suggestionData.name || !suggestionData.description || isSubmitting}
                  onClick={handleSuggest}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Sending...' : <><Send size={16} /> Submit Suggestion</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* GTA V|VI Safety Removal Notice Modal */}
        {gtaFlowStep === 'removed_notice' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: gtaModalSpinning ? 0 : 1 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              key="gta-removed-notice-modal"
              initial={{ scale: 0.85, opacity: 0, rotate: 0 }}
              animate={
                gtaModalSpinning
                  ? { rotate: 720, scale: 0, opacity: 0 }
                  : { rotate: 0, scale: 1, opacity: 1 }
              }
              transition={
                gtaModalSpinning
                  ? { duration: 0.65, ease: 'easeInOut' }
                  : { type: 'spring', damping: 24, stiffness: 260 }
              }
              className="w-full max-w-xl bg-zinc-950 border-2 border-red-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl shadow-red-600/30 relative my-auto text-center"
            >
              <button
                onClick={handleReturnToGamesMenu}
                className="absolute top-4 right-4 p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>

              <div className="w-20 h-20 rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-500 mx-auto mb-5 animate-pulse">
                <AlertTriangle size={44} />
              </div>

              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/30 mb-3 inline-block">
                GTA V|VI — Temporarily Removed
              </span>

              <p className="text-zinc-100 text-base sm:text-lg font-bold leading-relaxed mb-6">
                This game was not deleted because of the DMCA, it was actually removed because the warning was not enough to you guys, to not BOOKMARK THE LINK!!! and one of you did and got your computer taken, I&apos;m removing this for the safely for you guys. Be prepared for GTA 4, GTA 3, etc.
              </p>

              <button
                onClick={handleReturnToGamesMenu}
                disabled={gtaModalSpinning}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 cursor-pointer hover:scale-[1.01] active:scale-95 disabled:opacity-60"
              >
                <span>Back to Games &amp; Apps Menu ({gtaRedirectCountdown}s)</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const DMCA_EMAIL = 'centraltok-developers@student.jths.org';

const DMCA_POLICY_PARAGRAPHS: string[] = [
  '1. At CentralTok, we respect intellectual property rights, original game creators, indie developers, publishers, and trademark holders around the world. If you believe any game, embedded web experience, thumbnail image, or application listed on our platform copies your work or infringes your copyright, you have the full right to submit a DMCA takedown request and request removal.',
  '2. Every copyright takedown report and DMCA inquiry must be sent directly to our official developer compliance inbox at centraltok-developers@student.jths.org. Routing all copyright claims to this dedicated address ensures that our engineering and moderation team sees your message promptly instead of letting it get lost in general feedback.',
  '3. To process your takedown report accurately and without unnecessary delay, your email must clearly include four required details: the Date of your report, your Full Name, the exact Name of the Game (or app) involved, and an explicit explanation of How You Want It Removed for copyright compliance.',
  '4. Including the Date helps our compliance team establish a verifiable timeline under the Digital Millennium Copyright Act, track response deadlines against our internal service-level targets, and document when a claim was first filed and received by CentralTok.',
  '5. Providing your Full Name (along with your studio name, publisher organization, or authorized legal representative capacity if applicable) enables us to verify that the request comes from a real rights holder or someone legally authorized to act on the copyright owner’s behalf.',
  '6. Specifying the exact Name of the Game as shown inside The Playground (plus any alternate title, URL, or screenshot if helpful) allows our developers to pinpoint the precise catalog entry in our database and eliminate confusion between similarly named titles or fan-made mods.',
  '7. Describing How You Want It Removed for copyright lets you control the exact remedy you expect—for example, whether you want complete deletion of the game and its playable HTML file, removal of the external iframe link, stripping of promotional thumbnails, or replacement with non-infringing attribution.',
  '8. Once your email arrives at centraltok-developers@student.jths.org, an automated or manual intake check logs the timestamp and assigns your claim a unique internal review reference so every action taken on the reported game can be audited later.',
  '9. Initial intake triage begins immediately upon staff review, typically within 12 to 24 hours of receiving your message. During this first phase, a developer checks that the four essential elements—date, name, game title, and requested copyright removal method—are clearly stated.',
  '10. If your message is missing minor formatting details but unmistakably identifies your copyrighted game and demands removal, we will still place the game under preliminary review rather than discarding your notice on a technicality, while replying to confirm any missing identification details.',
  '11. After validating that the notice matches a live game or app on CentralTok, our team inspects the catalog configuration in our source data, static game archives, and public media folders to map every single reference linked to that reported game.',
  '12. When a game is determined to be a copied build, unauthorized mirror, or unapproved HTML wrapper of your copyrighted software, we immediately initiate temporary quarantine by disabling public launch access so users can no longer open or stream the game while final cleanup runs.',
  '13. Temporary quarantine usually takes effect within 24 hours of verification and can happen within just a few hours when a claim clearly shows direct unauthorized copying of commercial or indie software.',
  '14. Following quarantine, our developers permanently remove the game card from the active Games & Apps catalog array so the title, category entry, and player-count badge disappear completely from the Browse view and search results.',
  '15. In addition to removing the card from the storefront UI, we purge any hosted HTML wrapper files, local script bundles, or stored third-party embed URLs associated with that game so the underlying game cannot be loaded even via direct URL paths.',
  '16. If your copyright removal request also covers promotional artwork, store cover photos, or thumbnail icons displayed on CentralTok, we strip those image URLs and cached preview references alongside the game binary or HTML source.',
  '17. Sometimes a user-requested copyright notice specifies partial remediation—such as keeping a legitimate external credit link while removing a copied local file, or deleting only an unauthorized modified version rather than another licensed build. We carefully follow the exact removal method you specify in your email.',
  '18. We also scan our codebase and asset directories for duplicate filenames, alternate spellings, or earlier backup mirrors of the reported game so an infringing copy does not remain accessible under a slightly different slug or ID.',
  '19. For external embedded games where the code itself lives on an upstream third-party host rather than our own repository, we immediately delist the entry, break the iframe connection, and block the external endpoint from appearing anywhere inside CentralTok.',
  '20. When a reported game is connected to active user presence statuses (such as "Currently Playing" indicators on user profiles), those references are also cleared automatically once the game is disabled and removed from the live directory.',
  '21. While we execute permanent removal, our team records a cryptographic hash or internal identifier of the removed game file and its blocked source URLs in our private moderation blocklist to prevent future re-submissions.',
  '22. Maintaining that internal takedown blocklist guarantees that well-meaning community members who submit "Suggest New" game requests cannot accidentally persuade staff to re-add a title that was already taken down under your copyright claim.',
  '23. Every removal step—from catalog entry deletion to public asset purging and build regeneration—is tested against both desktop and mobile navigation routes to verify that no stale page, cached card, or broken iframe lingers on the site.',
  '24. After removing the files and updating the production bundle, we redeploy the updated build so CDN edges, static hosting servers, and browser entry bundles stop serving the removed game globally.',
  '25. For clients whose browsers still hold temporary local cache data, our updated application manifests force a fresh catalog load on their next visit so the taken-down game vanishes cleanly without manual browser resets.',
  '26. Across standard verified DMCA reports sent to centraltok-developers@student.jths.org, our target timeline is 12 to 24 hours for initial receipt acknowledgment and preliminary assessment.',
  '27. Immediate access restriction or temporary hiding of a clearly infringing copied game is completed within 24 to 48 hours of receiving a complete takedown notice.',
  '28. Full permanent takedown—including source catalog removal, hosted HTML deletion, thumbnail stripping, and live production deployment—is typically finished within 48 to 72 hours (2 to 3 days) from the time your complete email arrives.',
  '29. In more complex cases—such as disputes involving multiple co-developers, unclear ownership documentation, multi-part game series, or third-party licensing questions—final permanent resolution may take up to 3 to 5 business days while we complete thorough verification.',
  '30. During weekends, school holidays, or peak academic exam periods when our student-developer maintainers monitor the inbox in shifts, initial response times may stretch slightly toward the 48-hour mark, though urgent clear-cut piracy claims remain top priority.',
  '31. As soon as the game has been completely removed according to your instructions, we send a written confirmation reply back to the email address you used to contact centraltok-developers@student.jths.org.',
  '32. That completion email confirms the exact date the takedown finished, lists the removed game name and assets, verifies how the copyright material was handled, and provides a point of contact in case you ever spot residual copies.',
  '33. If we require clarification before acting—for example, if an email mentions a franchise broadly without specifying which title in the catalog was copied, or omits how you want the copyright removed—we will write back promptly asking only for the specific missing detail.',
  '34. We evaluate every copyright notice under good-faith standards and never charge any fee to file a DMCA takedown notice, verify ownership, or execute permanent removal of infringing software.',
  '35. If a developer or uploader believes a game was mistakenly identified or removed in error, they may submit a formal written explanation with proof of open-source licensing or written distribution permission to the same compliance address for manual review.',
  '36. Under standard DMCA counter-notification timelines, if a valid counter-notice backed by clear licensing proof is received, we notify the original complainant and wait 10 to 14 business days before considering any restoration—and never restore commercially copyrighted games without explicit owner consent.',
  '37. Users or submitters who repeatedly upload or request unauthorized copies of copyrighted games after warnings face restrictions on submitting new game suggestions or sharing links on CentralTok.',
  '38. Beyond reactive DMCA processing, CentralTok developers conduct periodic catalog reviews to replace unofficial assets, verify third-party embed permissions, and remove risky or unverified links before complaints ever arise.',
  '39. By maintaining transparent communication through centraltok-developers@student.jths.org and adhering strictly to clear 24-to-72-hour takedown workflows, we aim to protect creators’ hard work while keeping our educational community safe and compliant.',
  '40. Thank you for helping keep CentralTok respectful of original creators; whenever you need any copied game or copyrighted material removed, email centraltok-developers@student.jths.org with the Date, your Name, the Game Name, and How You Want It Removed for copyright, and our team will take swift, thorough action.',
];

export function DMCAPage() {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [claimDate, setClaimDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [claimName, setClaimName] = useState('');
  const [claimGame, setClaimGame] = useState('');
  const [claimRemovalMethod, setClaimRemovalMethod] = useState('');

  const handleCopyEmail = () => {
    try {
      navigator.clipboard.writeText(DMCA_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {}
  };

  const formattedBody = [
    'DMCA / Copyright Removal Request - CentralTok',
    '',
    `Date: ${claimDate || '[Insert Date]'}`,
    `Full Name / Rights Holder: ${claimName.trim() || '[Insert Your Full Name]'}`,
    `Game / App Name: ${claimGame.trim() || '[Insert Exact Game Name]'}`,
    `How You Want It Removed for Copyright: ${claimRemovalMethod.trim() || '[Explain how you want this game/copyright removed — e.g. complete deletion of game, iframe URL, and thumbnail]'}`,
    '',
    'I state in good faith that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law.',
  ].join('\n');

  const mailtoHref = `mailto:${DMCA_EMAIL}?subject=${encodeURIComponent(
    `DMCA Takedown Request${claimGame.trim() ? `: ${claimGame.trim()}` : ''}`
  )}&body=${encodeURIComponent(formattedBody)}`;

  const handleCopyTemplate = () => {
    try {
      navigator.clipboard.writeText(`To: ${DMCA_EMAIL}\nSubject: DMCA Takedown Request\n\n${formattedBody}`);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    } catch {}
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 overflow-y-auto p-4 sm:p-8 select-text">
      <div className="max-w-4xl mx-auto pb-24 space-y-8">
        {/* Back Nav */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/games-apps"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200 hover:border-pink-500 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Games &amp; Apps</span>
          </Link>
          <span className="px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 text-[11px] font-black uppercase tracking-widest">
            40-Paragraph DMCA Policy
          </span>
        </div>

        {/* Hero Notice */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-pink-600/25 shrink-0">
              <Scale size={32} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                DMCA &amp; Copyright Removal
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 font-medium mt-1">
                If we copied any game or application, copyright owners can request us to take it down immediately.
              </p>
            </div>
          </div>

          {/* Official Contact Email Box */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border-2 border-pink-500/40 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-pink-500/15 text-pink-500 flex items-center justify-center shrink-0">
                <Mail size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                  Send All DMCA Takedown Reports To
                </p>
                <a
                  href={`mailto:${DMCA_EMAIL}`}
                  className="text-base sm:text-xl font-black text-pink-600 dark:text-pink-400 hover:underline break-all"
                >
                  {DMCA_EMAIL}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              >
                {copiedEmail ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedEmail ? 'Copied' : 'Copy Email'}</span>
              </button>
              <a
                href={mailtoHref}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-pink-600/20 transition-all"
              >
                <Send size={14} />
                <span>Email Us</span>
              </a>
            </div>
          </div>

          {/* 4 Required Submission Details */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-1">1. Required</p>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">The Date</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Include the exact date you are sending your DMCA notice.</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-1">2. Required</p>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">Your Name</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Provide your full name (and studio or company if applicable).</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-1">3. Required</p>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">The Game</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Name the exact game or app that you believe was copied.</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-1">4. Required</p>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">How to Remove It</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">State clearly how you want it removed for copyright compliance.</p>
            </div>
          </div>

          {/* Quick Timeline & Action Highlights */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-start gap-3">
              <ShieldCheck size={20} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-zinc-900 dark:text-white">How We Handle Reports</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Verified reports emailed to {DMCA_EMAIL} are triaged immediately using your date, name, game, and removal terms.</p>
              </div>
            </div>
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-start gap-3">
              <Trash2 size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-zinc-900 dark:text-white">What We Do to the Game</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">We quarantine launch access, delete catalog cards, purge hosted HTML/embed URLs, strip thumbnails, and blocklist re-uploads.</p>
              </div>
            </div>
            <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 p-4 flex items-start gap-3">
              <Clock size={20} className="text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-zinc-900 dark:text-white">How Long Takedown Takes</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">24h initial reply, 24–48h temporary delisting, and 48–72h (up to 3–5 business days for complex claims) for full removal.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Takedown Notice Builder */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-lg">
          <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight mb-1">
            Prepare Your DMCA Removal Email
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-5">
            Fill in the Date, your Name, the Game name, and How you want it removed for copyright, then send directly to <span className="font-bold text-zinc-800 dark:text-zinc-200">{DMCA_EMAIL}</span>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Date</label>
              <input
                type="date"
                value={claimDate}
                onChange={(e) => setClaimDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Your Full Name</label>
              <input
                type="text"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="e.g. Alex Johnson / Studio"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Game Name</label>
              <input
                type="text"
                value={claimGame}
                onChange={(e) => setClaimGame(e.target.value)}
                placeholder="Exact game or app title"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-pink-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">
              How You Want It Removed for Copyright
            </label>
            <textarea
              rows={3}
              value={claimRemovalMethod}
              onChange={(e) => setClaimRemovalMethod(e.target.value)}
              placeholder="Tell us exactly how you want the game removed (e.g. completely remove the game card, hosted HTML file, embed link, and thumbnail image)..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-pink-500 resize-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={mailtoHref}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-pink-600/20"
            >
              <Send size={14} />
              <span>Send DMCA Email Now</span>
            </a>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="px-5 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              {copiedTemplate ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              <span>{copiedTemplate ? 'Copied Notice Template' : 'Copy Formatted Notice'}</span>
            </button>
          </div>
        </div>

        {/* Full 40-Paragraph Policy */}
        <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10 shadow-lg space-y-5">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                Complete DMCA Handling, Game Removal &amp; Timeline Policy
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                40 detailed paragraphs covering how we review DMCA reports, what we do to reported games, and exact takedown timeframes.
              </p>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-pink-500 shrink-0">
              {DMCA_POLICY_PARAGRAPHS.length} Paragraphs
            </span>
          </div>

          <div className="space-y-4">
            {DMCA_POLICY_PARAGRAPHS.map((paragraph, idx) => (
              <p
                key={idx}
                className="text-sm sm:text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl px-5 py-4"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

