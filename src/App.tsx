/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useAppStore } from './store';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Explore } from './pages/Explore';
import { Upload } from './pages/Upload';
import { Profile } from './pages/Profile';
import { Inbox } from './pages/Inbox';
import { Chat } from './pages/Chat';
import { BanScreen } from './components/BanScreen';
import { InterestsModal } from './components/InterestsModal';
import { MiniPlayer } from './components/MiniPlayer';
import { GlobalStoryViewer } from './components/StoriesBar';
import { CallOverlay } from './components/CallOverlay';
import { Admin } from './pages/Admin';
import { Forum } from './pages/Forum';
import { UpdatesAnnouncements } from './pages/UpdatesAnnouncements';
import { SneakPeeks } from './pages/SneakPeeks';
import { GamesApps } from './pages/GamesApps';

import { BookmarkBanner } from './components/BookmarkBanner';

function useIframeCheck() {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    try {
      const hostname = window.location.hostname || '';
      const href = window.location.href || '';
      const isTargetDomain =
        hostname.includes('windows11-unblocked.pages.dev') ||
        href.includes('windows11-unblocked.pages.dev');

      let inIframe = false;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }

      // Allow preview testing via ?test_iframe_only=true
      if (href.includes('test_iframe_only=true') || window.location.search.includes('test_iframe_only')) {
        setIsBlocked(true);
        return;
      }

      // If running on windows11-unblocked.pages.dev and NOT in iframe, block the site from appearing directly
      if (isTargetDomain && !inIframe) {
        setIsBlocked(true);
      } else {
        setIsBlocked(false);
      }
    } catch {
      setIsBlocked(false);
    }
  }, []);

  return isBlocked;
}

function IframeOnlyNoticeScreen() {
  const [copied, setCopied] = useState(false);
  const targetUrl = 'https://thegoogleclassroom.github.io/windows11tiktok/#/';

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-pink-600/30 mb-6">
          C
        </div>

        <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-pink-500/10 text-pink-400 border border-pink-500/20 mb-3">
          Iframe Required
        </span>

        <h1 className="text-2xl font-black tracking-tight mb-2">
          Site Only Available in Iframe
        </h1>

        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
          This site is not available to view directly. It can only appear when embedded inside an iframe.
        </p>

        <div className="w-full bg-black/50 border border-zinc-800/80 rounded-2xl p-4 mb-6 text-left">
          <p className="text-xs text-zinc-400 mb-1 font-medium">To access all features, visit:</p>
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-400 hover:text-pink-300 text-sm font-mono break-all hover:underline"
          >
            {targetUrl}
          </a>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-3.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-pink-600/25 transition-all text-sm"
          >
            <span>Open Full Site</span>
            <ExternalLink size={16} />
          </a>
          <button
            onClick={handleCopy}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm shrink-0"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAppStore();
  const isIframeBlocked = useIframeCheck();

  if (isIframeBlocked) {
    return <IframeOnlyNoticeScreen />;
  }

  if (currentUser?.banStatus) {
    const isTemp = currentUser.banStatus.type === 'temp';
    if (!isTemp || (isTemp && currentUser.banStatus.until && Date.now() < currentUser.banStatus.until)) {
      return <BanScreen />;
    }
  }

  return (
    <>
      <BookmarkBanner />
      {children}
      <InterestsModal />
      <GlobalStoryViewer />
      <CallOverlay />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AuthWrapper>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/videos/:videoId" element={<Home />} />
              <Route path="/video/:videoId" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/@:handle" element={<Profile />} />
              <Route path="/profile/:handle" element={<Profile />} />
              <Route path="/messages" element={<Inbox />} />
              <Route path="/messages/:handle" element={<Chat />} />
              <Route path="/messages/group/:groupId" element={<Chat />} />
              <Route path="/forum" element={<Forum />} />
              <Route path="/forum/updates" element={<UpdatesAnnouncements />} />
              <Route path="/forum/announcements" element={<UpdatesAnnouncements />} />
              <Route path="/forum/sneak-peeks" element={<SneakPeeks />} />
              <Route path="/forum/sneak-peaks" element={<SneakPeeks />} />
              <Route path="/sneak-peeks" element={<SneakPeeks />} />
              <Route path="/games-apps" element={<GamesApps />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </Layout>
        </AuthWrapper>
      </HashRouter>
    </AppProvider>
  );
}
