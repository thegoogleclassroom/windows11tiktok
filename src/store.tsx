import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Video, AppNotification } from './types';
import { getUsers, getVideos, initDb, handleWriteQuotaError, getCachedUserById, upsertUserInCache, getUserFresh } from './lib/db';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

export type QualityMode = 'low' | 'high';

type AppState = {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  qualityMode: QualityMode | null;
  setQualityMode: (mode: QualityMode) => void;
  showQualityModal: boolean;
  setShowQualityModal: (val: boolean) => void;
  isLoading: boolean;
  introPhase: 'loading' | 'merging' | 'expanding' | 'done';
  setIntroPhase: (phase: 'loading' | 'merging' | 'expanding' | 'done') => void;
  showAuthModal: boolean;
  setShowAuthModal: (val: boolean) => void;
  isGameActive: boolean;
  setIsGameActive: (val: boolean) => void;
  activeGameUrl: string;
  setActiveGameUrl: (url: string) => void;
  activeGameTitle: string | null;
  setActiveGameTitle: (title: string | null) => void;
  miniPlayerActive: boolean;
  setMiniPlayerActive: (val: boolean) => void;
  miniPlayerUrl: string;
  setMiniPlayerUrl: (url: string) => void;
  miniPlayerTitle: string;
  setMiniPlayerTitle: (title: string) => void;
  activeStory: { userId: string; user: User } | null;
  setActiveStory: (story: { userId: string; user: User } | null) => void;
  isCalling: boolean;
  setIsCalling: (val: boolean) => void;
  callData: { user: User; type: 'voice' | 'video' } | null;
  setCallData: (data: { user: User; type: 'voice' | 'video' } | null) => void;
  selectedCameraId: string;
  setSelectedCameraId: (id: string) => void;
  listenAlongHostId: string | null;
  setListenAlongHostId: (id: string | null) => void;
};

const StoreContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [introPhase, setIntroPhase] = useState<'loading' | 'merging' | 'expanding' | 'done'>('loading');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isGameActive, setIsGameActive] = useState(false);
  const [activeGameUrl, setActiveGameUrl] = useState('');
  const [activeGameTitle, setActiveGameTitle] = useState<string | null>(null);
  const [miniPlayerActive, setMiniPlayerActive] = useState(false);
  const [miniPlayerUrl, setMiniPlayerUrl] = useState('');
  const [miniPlayerTitle, setMiniPlayerTitle] = useState('');
  const [activeStory, setActiveStory] = useState<{ userId: string; user: User } | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callData, setCallData] = useState<{ user: User; type: 'voice' | 'video' } | null>(null);
  const [listenAlongHostId, setListenAlongHostId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraIdState] = useState<string>(() => {
    return localStorage.getItem('preferredCameraId') || '';
  });
  const setSelectedCameraId = (id: string) => {
    setSelectedCameraIdState(id);
    localStorage.setItem('preferredCameraId', id);
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [qualityMode, setQualityModeState] = useState<QualityMode | null>(() => {
    const saved = localStorage.getItem('ct_quality_mode');
    return saved === 'low' || saved === 'high' ? saved : null;
  });
  const [showQualityModal, setShowQualityModal] = useState<boolean>(() => {
    const saved = localStorage.getItem('ct_quality_mode');
    return saved !== 'low' && saved !== 'high';
  });
  const [isLoading, setIsLoading] = useState(true);

  const setQualityMode = (mode: QualityMode) => {
    setQualityModeState(mode);
    setShowQualityModal(false);
    try {
      localStorage.setItem('ct_quality_mode', mode);
    } catch {}
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('low-quality', qualityMode === 'low');
    document.documentElement.classList.toggle('high-quality', qualityMode !== 'low');
  }, [qualityMode]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    let lastVerifyAt = 0;

    const verifyUserFromServer = async (uid: string, minGapMs = 0) => {
      if (!uid || cancelled) return;
      const now = Date.now();
      if (minGapMs > 0 && now - lastVerifyAt < minGapMs) return;
      lastVerifyAt = now;
      try {
        const fresh = await getUserFresh(uid);
        if (!cancelled && fresh) {
          upsertUserInCache(fresh);
          setCurrentUser(fresh);
          setIsLoading(false);
        }
      } catch {}
    };

    const loadData = async () => {
      await initDb();
      const rawUserId = localStorage.getItem('currentUserId');
      const currentUserId = rawUserId && rawUserId !== 'undefined' && rawUserId !== 'null' ? rawUserId.trim() : '';
      if (currentUserId.length > 0) {
        const cachedUser = getCachedUserById(currentUserId);
        if (cachedUser) {
          setCurrentUser(cachedUser);
          setIsLoading(false);
        }
        // Immediately verify against server so bans/role updates are never masked by stale local cache on home WiFi
        void verifyUserFromServer(currentUserId, 0);

        // Subscribe to user document in real-time
        try {
          const userDocRef = doc(db, 'users', currentUserId);
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            const isFromCache = docSnap.metadata?.fromCache;
            if (docSnap.exists()) {
              const userData = docSnap.data() as User;
              upsertUserInCache(userData);
              setCurrentUser(userData);
            } else if (!isFromCache) {
              setCurrentUser(null);
            }
            setIsLoading(false);
          }, (err) => {
            if (!handleWriteQuotaError(err, 'read')) {
              console.warn("User subscription warning:", err);
            }
            const fallback = getCachedUserById(currentUserId);
            if (fallback) {
              setCurrentUser(fallback);
            }
            setIsLoading(false);
          });
        } catch (e) {
          console.warn("Failed to subscribe to user doc:", e);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    loadData();

    const onReconnectOrFocus = () => {
      const rawUserId = localStorage.getItem('currentUserId');
      const uid = rawUserId && rawUserId !== 'undefined' && rawUserId !== 'null' ? rawUserId.trim() : '';
      if (!uid) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void verifyUserFromServer(uid, 30_000);
    };

    window.addEventListener('online', onReconnectOrFocus);
    document.addEventListener('visibilitychange', onReconnectOrFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onReconnectOrFocus);
      document.removeEventListener('visibilitychange', onReconnectOrFocus);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSetUser = (user: User | null) => {
    setCurrentUser(user);
    if (user && user.id && typeof user.id === 'string' && user.id.trim().length > 0 && user.id !== 'undefined') {
      upsertUserInCache(user);
      localStorage.setItem('currentUserId', user.id.trim());
    } else {
      localStorage.removeItem('currentUserId');
    }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <StoreContext.Provider value={{ 
      currentUser, 
      setCurrentUser: handleSetUser, 
      theme, 
      toggleTheme, 
      qualityMode,
      setQualityMode,
      showQualityModal,
      setShowQualityModal,
      isLoading, 
      introPhase, 
      setIntroPhase, 
      showAuthModal, 
      setShowAuthModal,
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
      setMiniPlayerTitle,
      activeStory,
      setActiveStory,
      isCalling,
      setIsCalling,
      callData,
      setCallData,
      selectedCameraId,
      setSelectedCameraId,
      listenAlongHostId,
      setListenAlongHostId
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useAppStore must be used within an AppProvider');
  return context;
}
