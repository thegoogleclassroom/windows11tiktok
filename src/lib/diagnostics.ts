
export interface SystemStatus {
  backend: boolean;
  aiChat: boolean;
  aiSearch: boolean;
  youtube: boolean;
  firebase: boolean;
  latency: number;
  isStaticHost: boolean;
}

export async function checkSystemHealth(): Promise<SystemStatus> {
  const start = Date.now();
  const isStatic = typeof window !== 'undefined' && 
    (window.location.hostname.includes('github.io') || 
     window.location.hostname.includes('pages.dev') ||
     window.location.protocol === 'file:');

  const status: SystemStatus = {
    backend: false,
    aiChat: false,
    aiSearch: false,
    youtube: false,
    firebase: false,
    latency: 0,
    isStaticHost: isStatic
  };

  try {
    // 1. Check Backend Health
    try {
      const healthRes = await fetch('./api/health').catch(() => null);
      status.backend = Boolean(healthRes && healthRes.ok);
    } catch {
      status.backend = false;
    }

    // 2. Check Firebase (Simple check by fetching a known collection)
    try {
      const { db } = await import('./firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const testRef = doc(db, 'app_settings', 'global');
      await getDoc(testRef);
      status.firebase = true;
    } catch (e) {
      console.warn("Firebase check failed", e);
    }

    // 3. Check AI Chat API (GET request just checks if route exists)
    try {
      const chatRes = await fetch('./api/chat').catch(() => null);
      status.aiChat = Boolean(chatRes && chatRes.ok);
    } catch {
      status.aiChat = false;
    }

    // 4. Check AI Search API (Simple trending query)
    try {
      const searchRes = await fetch('./api/ai-search?q=test').catch(() => null);
      status.aiSearch = Boolean(searchRes && searchRes.ok);
    } catch {
      status.aiSearch = false;
    }

    // 5. Check YouTube API (Check if the proxy returns a response)
    try {
      const ytRes = await fetch('./api/youtube-shorts?maxResults=1').catch(() => null);
      status.youtube = Boolean(ytRes && ytRes.ok);
    } catch {
      status.youtube = false;
    }

  } catch (err) {
    console.error("Health check failed", err);
  }

  status.latency = Date.now() - start;
  return status;
}
