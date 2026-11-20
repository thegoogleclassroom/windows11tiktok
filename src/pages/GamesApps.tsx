import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Rocket, Stars, Sparkles, AlertCircle, Play, Info, Square, LayoutGrid, Users, Lightbulb, X, Send, AlertTriangle, Search } from 'lucide-react';
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
    setGtaFlowStep('idle');
    setIsGameActive(false);
    setActiveGameUrl('');
    setActiveGameTitle(null);
    navigate('/games-apps');
  };

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null;
    if (gtaFlowStep === 'removed_notice') {
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
  }, [gtaFlowStep]);

  const handleItemClick = (item: GameItem) => {
    if (item.id === 'gta-5-6' || item.title === 'GTA V|VI' || item.title === 'GTA 5/6') {
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
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => handleItemClick(item)}
                className="group cursor-pointer relative wiggy-card"
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
                  <div className={`h-1/2 w-full bg-gradient-to-br flex items-center justify-center relative overflow-hidden ${
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
                    <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                    {item.icon ? (
                      <img 
                        src={item.icon} 
                        alt="" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-2xl brightness-0 invert" 
                      />
                    ) : null}
                    <div
                      style={{ display: item.icon ? 'none' : 'flex' }}
                      className="items-center justify-center w-full h-full relative"
                    >
                      <Gamepad2 size={48} className="text-white/20 absolute -bottom-4 -right-4 rotate-12 scale-150" />
                      <span className="text-white font-black text-4xl drop-shadow-lg">{item.title[0]}</span>
                    </div>
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
          <div className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              key="gta-removed-notice-modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
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
                className="w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 cursor-pointer hover:scale-[1.01] active:scale-95"
              >
                <span>Back to Games &amp; Apps Menu ({gtaRedirectCountdown}s)</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
