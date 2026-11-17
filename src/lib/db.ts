import { collection, doc, getDocs, setDoc, updateDoc, writeBatch, arrayUnion, arrayRemove, getDoc, onSnapshot, deleteDoc, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
export { db, doc, updateDoc, getDoc };
import { User, Video, Message, AppNotification, Report, Appeal, AuditLog, Comment, Story, FAQCategory, FAQPost, ForumEditRequest, GroupChat, UserStatus, GameData, WatchParty, Announcement, Call, VerificationRequest, AppSuggestion, SneakPeek, CentralProRequest, LiveStream, LiveRtcSignal } from '../types';

export const submitSuggestion = async (suggestion: AppSuggestion) => {
  try {
    const docRef = doc(db, 'app_suggestions', suggestion.id);
    await setDoc(docRef, suggestion);
  } catch (err) {
    console.error("Error submitting suggestion:", err);
  }
};

export const getSuggestions = () => fetchCollection<AppSuggestion>('app_suggestions');

export const subscribeToSuggestions = (callback: (suggestions: AppSuggestion[]) => void) => {
  return onSnapshot(collection(db, 'app_suggestions'), (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data() as AppSuggestion));
  }, (err) => {
    if (!isQuotaError(err)) {
      console.warn("Suggestions subscription permission denied or error:", err);
    }
  });
};

export const getAnnouncements = () => fetchCollection<Announcement>('announcements');

const deepClean = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (value === undefined) return null;
      if (value instanceof Blob || value instanceof File || typeof value === 'function') return undefined;
      return value;
    }));
  } catch (e) {
    return {};
  }
};

export const saveAnnouncement = async (announcement: Announcement) => {
  try {
    const cleanedData = deepClean(announcement);
    const docRef = doc(db, 'announcements', announcement.id);
    await setDoc(docRef, cleanedData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `announcements/${announcement.id}`);
  }
};

export const deleteAnnouncement = async (id: string) => {
  try {
    const docRef = doc(db, 'announcements', id);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
  }
};

export const voteInPoll = async (announcementId: string, userId: string, optionIndex: number) => {
  try {
    const ref = doc(db, 'announcements', announcementId);
    await updateDoc(ref, {
      [`pollVotes.${userId}`]: optionIndex
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `announcements/${announcementId}`);
  }
};

export const submitVerificationRequest = async (request: VerificationRequest) => {
  try {
    const cleanedData = deepClean(request);
    const docRef = doc(db, 'verification_requests', request.id);
    await setDoc(docRef, cleanedData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `verification_requests/${request.id}`);
  }
};

export const getVerificationRequests = () => fetchCollection<VerificationRequest>('verification_requests');

export const subscribeToVerificationRequests = (callback: (requests: VerificationRequest[]) => void) => {
  return onSnapshot(collection(db, 'verification_requests'), (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data() as VerificationRequest));
  }, (err) => {
    if (!handleWriteQuotaError(err)) {
      console.warn("Verification requests subscription permission denied or error:", err);
    }
  });
};

export const voteOnVerificationRequest = async (requestId: string, adminId: string, vote: 'approve' | 'reject') => {
  try {
    const ref = doc(db, 'verification_requests', requestId);
    await updateDoc(ref, {
      [`votes.${adminId}`]: vote
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `verification_requests/${requestId}`);
  }
};

export const updateVerificationRequestStatus = async (requestId: string, status: 'approved' | 'rejected' | 'pending') => {
  try {
    const ref = doc(db, 'verification_requests', requestId);
    await updateDoc(ref, { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `verification_requests/${requestId}`);
  }
};

export const updateUserVerificationStatus = async (userId: string, isVerified: boolean) => {
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { isVerified });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
  }
};

export const updateUserGhostMode = async (userId: string, isGhostMode: boolean) => {
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { isGhostMode });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
  }
};

export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
  return onSnapshot(collection(db, 'announcements'), (snapshot) => {
    const announcements = snapshot.docs.map(doc => doc.data() as Announcement);
    callback(announcements);
  }, (err) => {
    if (!isQuotaError(err)) {
      console.error("Announcement subscription error:", err);
    }
  });
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const initDb = async () => {};

// Track last known serialized docs per collection so saveCollection only writes changed/new items
const lastSyncedDocs = new Map<string, Map<string, string>>();
const readCache = new Map<string, { data: any[]; fetchedAt: number }>();
const inflightFetches = new Map<string, Promise<any[]>>();
let quotaBlockedUntil = 0;

const COLLECTION_TTL_MS: Record<string, number> = {
  users: 60_000,
  videos: 45_000,
  stories: 45_000,
  announcements: 45_000,
  faq_categories: 60_000,
  faq_posts: 45_000,
  sneak_peeks: 45_000,
  app_suggestions: 45_000,
  messages: 15_000,
  notifications: 20_000,
  group_chats: 25_000,
  user_statuses: 10_000,
};

const getCollectionTtl = (collName: string) => COLLECTION_TTL_MS[collName] ?? 30_000;

export const isQuotaBlocked = () => Date.now() < quotaBlockedUntil;

export const isQuotaError = (err: any): boolean => {
  const code = err?.code || '';
  const msg = (err?.message || String(err || '')).toLowerCase();
  return code === 'resource-exhausted' || msg.includes('resource-exhausted') || msg.includes('quota exceeded') || msg.includes('quota limit');
};

export const handleWriteQuotaError = (err: any) => {
  if (isQuotaError(err)) {
    const wasAlreadyBlocked = isQuotaBlocked();
    // Pause Firestore reads/writes for 5 minutes to avoid SDK retry storms & console spam
    quotaBlockedUntil = Date.now() + 5 * 60 * 1000;
    if (!wasAlreadyBlocked) {
      console.warn('Firestore free daily quota reached — pausing remote sync for 5 minutes and using local cache.');
    }
    return true;
  }
  return false;
};

const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Firestore request timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

const getCachedCollection = <T>(collName: string): T[] => {
  const mem = readCache.get(collName);
  if (mem?.data) return mem.data as T[];
  try {
    const cached = localStorage.getItem(`ct_cache_${collName}`);
    if (cached) {
      const parsed = JSON.parse(cached) as T[];
      readCache.set(collName, { data: parsed, fetchedAt: 0 });
      return parsed;
    }
  } catch {}
  return [];
};

const UNSYNCED_MSGS_KEY = 'ct_unsynced_messages';

const getUnsyncedMessages = (): Message[] => {
  try {
    const raw = localStorage.getItem(UNSYNCED_MSGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveUnsyncedMessages = (msgs: Message[]) => {
  try {
    // Keep at most the 30 most recent unsynced messages to fit comfortably within localStorage
    const trimmed = msgs.slice(-30);
    localStorage.setItem(UNSYNCED_MSGS_KEY, JSON.stringify(trimmed));
  } catch {
    // If localStorage is tight, keep fewer items
    try {
      localStorage.setItem(UNSYNCED_MSGS_KEY, JSON.stringify(msgs.slice(-8)));
    } catch {}
  }
};

const mergeWithUnsyncedMessages = <T,>(collName: string, items: T[]): T[] => {
  if (collName !== 'messages') return items;
  const unsynced = getUnsyncedMessages();
  if (unsynced.length === 0) return items;
  const remoteIds = new Set((items as any[]).map(i => i?.id).filter(Boolean));
  // Drop unsynced entries once confirmed in remote snapshot (if remote actually returned items)
  const stillMissing = items.length > 0
    ? unsynced.filter(u => !remoteIds.has(u.id))
    : unsynced;
  if (items.length > 0 && stillMissing.length !== unsynced.length) {
    saveUnsyncedMessages(stillMissing);
  }
  const map = new Map<string, any>();
  for (const item of items as any[]) {
    if (item?.id) map.set(item.id, item);
  }
  for (const u of stillMissing) {
    if (u?.id && !map.has(u.id)) {
      map.set(u.id, u);
    }
  }
  return Array.from(map.values()) as T[];
};

const setCachedCollection = <T>(collName: string, items: T[], updateTimestamp = true) => {
  const merged = mergeWithUnsyncedMessages(collName, items);
  const prev = readCache.get(collName);
  readCache.set(collName, { data: merged, fetchedAt: updateTimestamp ? Date.now() : (prev?.fetchedAt || 0) });
  try {
    localStorage.setItem(`ct_cache_${collName}`, JSON.stringify(merged));
  } catch {
    // Trim messages cache if oversized by base64 media
    if (collName === 'messages' && merged.length > 40) {
      try {
        localStorage.setItem(`ct_cache_${collName}`, JSON.stringify(merged.slice(-40)));
      } catch {}
    }
  }
};

const recordCollectionSnapshot = <T extends { id?: string }>(collName: string, items: T[]) => {
  let map = lastSyncedDocs.get(collName);
  if (!map) {
    map = new Map<string, string>();
    lastSyncedDocs.set(collName, map);
  }
  items.forEach(item => {
    if (item && typeof item === 'object' && item.id) {
      try {
        map!.set(item.id, JSON.stringify(deepClean(item)));
      } catch {}
    }
  });
};

const fetchCollection = async <T>(collName: string): Promise<T[]> => {
  const cachedMem = readCache.get(collName);
  if (cachedMem && Date.now() - cachedMem.fetchedAt < getCollectionTtl(collName)) {
    return mergeWithUnsyncedMessages(collName, cachedMem.data as T[]);
  }

  if (isQuotaBlocked()) {
    return mergeWithUnsyncedMessages(collName, getCachedCollection<T>(collName));
  }

  const pending = inflightFetches.get(collName);
  if (pending) {
    return pending as Promise<T[]>;
  }

  const req = (async (): Promise<T[]> => {
    try {
      const snapshot = await getDocs(collection(db, collName));
      const items = snapshot.docs.map(doc => doc.data() as T);
      recordCollectionSnapshot(collName, items as any[]);
      setCachedCollection(collName, items, true);
      return mergeWithUnsyncedMessages(collName, items);
    } catch (err: any) {
      const isQuota = handleWriteQuotaError(err);
      if (!isQuota) {
        const msg = err?.message || String(err);
        if (!msg.includes('Missing or insufficient permissions') && !msg.includes('permission-denied')) {
          console.warn(`Note on fetching ${collName}:`, msg);
        }
      }
      return mergeWithUnsyncedMessages(collName, getCachedCollection<T>(collName));
    } finally {
      inflightFetches.delete(collName);
    }
  })();

  inflightFetches.set(collName, req);
  return req;
};

const saveCollection = async <T extends { id: string }>(collName: string, items: T[]) => {
  if (!items || items.length === 0) return;
  setCachedCollection(collName, items, false);
  if (isQuotaBlocked()) return;

  try {
    let knownMap = lastSyncedDocs.get(collName);
    if (!knownMap) {
      knownMap = new Map<string, string>();
      lastSyncedDocs.set(collName, knownMap);
    }

    const dirtyEntries: Array<{ id: string; cleaned: any; serialized: string }> = [];
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item.id) continue;
      try {
        let dataToSave = deepClean(item);
        if (dataToSave && typeof dataToSave === 'object') {
          if ('videoData' in dataToSave) {
            delete (dataToSave as any).videoData;
          }
          const serialized = JSON.stringify(dataToSave);
          if (knownMap.get(item.id) !== serialized) {
            dirtyEntries.push({ id: item.id, cleaned: dataToSave, serialized });
          }
        }
      } catch {}
    }

    if (dirtyEntries.length === 0) return;

    // Firestore batch limit is 500 writes; chunk safely at 400
    for (let i = 0; i < dirtyEntries.length; i += 400) {
      const chunk = dirtyEntries.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const entry of chunk) {
        const docRef = doc(db, collName, entry.id);
        batch.set(docRef, entry.cleaned, { merge: true });
      }
      await batch.commit();
      for (const entry of chunk) {
        knownMap.set(entry.id, entry.serialized);
      }
    }
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const getUsers = () => fetchCollection<User>('users');

export const getUser = async (id: string): Promise<User | null> => {
  const cachedMem = readCache.get('users');
  if (cachedMem && (isQuotaBlocked() || Date.now() - cachedMem.fetchedAt < getCollectionTtl('users'))) {
    const found = (cachedMem.data as User[]).find(u => u.id === id);
    if (found || isQuotaBlocked()) return found || null;
  }
  if (isQuotaBlocked()) {
    return getCachedCollection<User>('users').find(u => u.id === id) || null;
  }
  try {
    const docRef = doc(db, 'users', id);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() as User : null;
  } catch (err) {
    handleWriteQuotaError(err);
    return getCachedCollection<User>('users').find(u => u.id === id) || null;
  }
};
export const saveUsers = (users: User[]) => saveCollection('users', users);

export const updateUser = async (userId: string, data: Partial<User>) => {
  try {
    const cached = getCachedCollection<User>('users');
    if (cached.length > 0) {
      setCachedCollection('users', cached.map(u => u.id === userId ? { ...u, ...data } : u), false);
    }
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'users', userId);
    const updateData = deepClean(data);
    await updateDoc(docRef, updateData);
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.error("Error updating user:", userId, err);
      throw err;
    }
  }
};

export const updateUserListeningState = async (userId: string, listeningState: User['listeningState']) => {
  if (!userId) return;
  const cleaned = listeningState ? deepClean(listeningState) : null;
  try {
    const cached = getCachedCollection<User>('users');
    if (cached.length > 0) {
      setCachedCollection('users', cached.map(u => u.id === userId ? { ...u, listeningState: cleaned || undefined } : u), false);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ct-user-listening-updated', { detail: { userId, listeningState: cleaned } }));
    }
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'users', userId), {
      listeningState: cleaned
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const subscribeToUserDoc = (userId: string, callback: (user: User | null) => void) => {
  if (!userId) return () => {};
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (snap.exists()) {
      const userData = snap.data() as User;
      try {
        const cached = getCachedCollection<User>('users');
        if (cached.length > 0) {
          setCachedCollection('users', cached.map(u => u.id === userId ? { ...u, ...userData } : u), false);
        }
      } catch {}
      callback(userData);
    } else {
      callback(null);
    }
  }, (err) => {
    handleWriteQuotaError(err);
  });
};

export const updateUserGame = async (userId: string, gameTitle: string | null) => {
  return updateUser(userId, { currentGame: gameTitle });
};

export const wipeUserFromSystem = async (userId: string) => {
  try {
    // 1. Mark user as completely wiped in users collection so search & profile reflect deleted state
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      isSystemWiped: true,
      username: 'Account Deleted',
      handle: `deleted_${userId.slice(-6)}`,
      avatarUrl: '',
      bio: 'This account has been completely wiped from the system.',
      banStatus: {
        type: 'perm',
        reason: 'SYSTEM WIPE: Removed from the system permanently.',
        bannedAt: Date.now()
      }
    });

    // 2. Also remove their videos
    const videos = await getVideos();
    const userVideos = videos.filter(v => v.userId === userId);
    for (const v of userVideos) {
      try {
        await deleteDoc(doc(db, 'videos', v.id));
      } catch (e) {
        console.warn("Error deleting video during wipe:", e);
      }
    }
  } catch (err) {
    console.error("Error wiping user from system:", err);
    throw err;
  }
};

export const getVideos = () => fetchCollection<Video>('videos');
export const saveVideos = (videos: Video[]) => saveCollection('videos', videos);

export const subscribeToVideo = (videoId: string, callback: (video: Video) => void) => {
  return onSnapshot(doc(db, 'videos', videoId), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Video);
    }
  }, (err) => {
    // Ignore errors for non-existent documents or missing permissions gracefully
  });
};

export const ensureVideoInDB = async (video: Video) => {
  try {
    const docRef = doc(db, 'videos', video.id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      let dbVideo = { ...video };
      delete dbVideo.videoData;
      dbVideo = deepClean(dbVideo);
      await setDoc(docRef, dbVideo);
    }
  } catch (err) {
    console.error(err);
  }
};

export const incrementVideoView = async (id: string, viewerId: string | null) => {
  try {
    const docRef = doc(db, 'videos', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const video = snap.data() as Video;
      const viewedBy = video.viewedBy || [];
      if (viewerId && (viewedBy || []).includes(viewerId)) return;
      
      await updateDoc(docRef, {
        views: (video.views || 0) + 1,
        viewedBy: viewerId ? arrayUnion(viewerId) : (video.viewedBy || [])
      });
    }
  } catch(err) {
    console.error(err);
  }
};

export const addCommentToVideo = async (videoId: string, comment: Comment) => {
  try {
    const docRef = doc(db, 'videos', videoId);
    await updateDoc(docRef, {
      comments: arrayUnion(comment)
    });
  } catch(err) {
    console.error(err);
  }
};

export const updateVideo = async (videoId: string, update: (video: Video) => Video) => {
  try {
    const docRef = doc(db, 'videos', videoId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      let newVideo = update(snap.data() as Video);
      delete newVideo.videoData;
      newVideo = JSON.parse(JSON.stringify(newVideo));
      await setDoc(docRef, newVideo);
    }
  } catch(err) {
    console.error(err);
  }
};

export const getMessages = () => fetchCollection<Message>('messages');
export const saveMessages = (messages: Message[]) => saveCollection('messages', messages);

export const addMessage = async (msg: Message): Promise<{ synced: boolean; localOnly?: boolean }> => {
  // Always persist optimistically in unsynced queue + local cache so sent photos/audio NEVER disappear
  try {
    const unsynced = getUnsyncedMessages().filter(m => m.id !== msg.id);
    saveUnsyncedMessages([...unsynced, msg]);
    const cached = getCachedCollection<Message>('messages').filter(m => m.id !== msg.id);
    setCachedCollection('messages', [...cached, msg], false);
  } catch {}
  if (isQuotaBlocked()) return { synced: false, localOnly: true };
  try {
    const cleaned = deepClean(msg);
    const serialized = JSON.stringify(cleaned);
    // Firestore single document hard limit is ~1MB (1,048,576 bytes)
    if (serialized.length > 980_000) {
      console.warn('Message payload near/exceeding 1MB Firestore limit, keeping in local cache:', msg.id);
      return { synced: false, localOnly: true };
    }
    const docRef = doc(db, 'messages', msg.id);
    await setDoc(docRef, cleaned, { merge: true });
    let knownMap = lastSyncedDocs.get('messages');
    if (!knownMap) {
      knownMap = new Map<string, string>();
      lastSyncedDocs.set('messages', knownMap);
    }
    knownMap.set(msg.id, serialized);
    saveUnsyncedMessages(getUnsyncedMessages().filter(m => m.id !== msg.id));
    return { synced: true };
  } catch (err) {
    handleWriteQuotaError(err);
    return { synced: false, localOnly: true };
  }
};

export const markMessagesSeen = async (messageIds: string[], userId: string) => {
  if (!messageIds.length || !userId) return;
  try {
    const cached = getCachedCollection<Message>('messages');
    if (cached.length > 0) {
      const idSet = new Set(messageIds);
      const updated = cached.map(m =>
        idSet.has(m.id)
          ? { ...m, read: true, seenBy: Array.from(new Set([...(m.seenBy || []), userId])) }
          : m
      );
      setCachedCollection('messages', updated, false);
    }
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    for (let i = 0; i < messageIds.length; i += 400) {
      const chunk = messageIds.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.update(doc(db, 'messages', id), {
          read: true,
          seenBy: arrayUnion(userId)
        });
      }
      await batch.commit();
    }
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const subscribeToMessages = (callback: (messages: Message[]) => void) => {
  return onSnapshot(collection(db, 'messages'), (snapshot) => {
    const msgs = snapshot.docs.map(doc => doc.data() as Message);
    recordCollectionSnapshot('messages', msgs);
    setCachedCollection('messages', msgs, true);
    callback(mergeWithUnsyncedMessages('messages', msgs));
  }, (err) => {
    if (!handleWriteQuotaError(err)) {
      console.warn("Messages subscription error:", err);
    }
  });
};
export const deleteMessage = async (messageId: string) => {
  try {
    saveUnsyncedMessages(getUnsyncedMessages().filter(m => m.id !== messageId));
    const cached = getCachedCollection<Message>('messages');
    setCachedCollection('messages', cached.filter(m => m.id !== messageId), false);
    lastSyncedDocs.get('messages')?.delete(messageId);
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const toggleMessageReaction = async (messageId: string, emoji: string, userId: string): Promise<Record<string, string[]> | undefined> => {
  let nextReactions: Record<string, string[]> | undefined;
  try {
    const cached = getCachedCollection<Message>('messages');
    const target = cached.find(m => m.id === messageId);
    if (target) {
      const current = { ...(target.reactions || {}) };
      const list = [...(current[emoji] || [])];
      if (list.includes(userId)) {
        const filtered = list.filter(id => id !== userId);
        if (filtered.length === 0) delete current[emoji];
        else current[emoji] = filtered;
      } else {
        current[emoji] = [...list, userId];
      }
      nextReactions = current;
      setCachedCollection('messages', cached.map(m => m.id === messageId ? { ...m, reactions: current } : m), false);
    }
  } catch {}
  if (isQuotaBlocked()) return nextReactions;
  try {
    const docRef = doc(db, 'messages', messageId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const msg = snap.data() as Message;
      const current = { ...(msg.reactions || {}) };
      const list = [...(current[emoji] || [])];
      if (list.includes(userId)) {
        const filtered = list.filter(id => id !== userId);
        if (filtered.length === 0) delete current[emoji];
        else current[emoji] = filtered;
      } else {
        current[emoji] = [...list, userId];
      }
      nextReactions = current;
      await updateDoc(docRef, { reactions: current });
    }
  } catch (err) {
    handleWriteQuotaError(err);
  }
  return nextReactions;
};

export const getGroupChats = () => fetchCollection<GroupChat>('group_chats');
export const saveGroupChats = (groups: GroupChat[]) => saveCollection('group_chats', groups);

export const updateGroupChat = async (groupId: string, data: any) => {
  try {
    const docRef = doc(db, 'group_chats', groupId);
    await updateDoc(docRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `group_chats/${groupId}`);
  }
};

export const addGroupMember = async (groupId: string, userId: string) => {
  return updateGroupChat(groupId, {
    members: arrayUnion(userId)
  });
};

export const removeGroupMember = async (groupId: string, userId: string) => {
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    await updateDoc(docRef, {
      members: group.members.filter(id => id !== userId),
      admins: group.admins.filter(id => id !== userId)
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `group_chats/${groupId}`);
  }
};

export const toggleGroupAdmin = async (groupId: string, userId: string) => {
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    const isAdmin = (group.admins || []).includes(userId);
    await updateDoc(docRef, {
      admins: isAdmin ? group.admins.filter(id => id !== userId) : arrayUnion(userId)
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `group_chats/${groupId}`);
  }
};

export const subscribeToGroupChat = (groupId: string, callback: (group: GroupChat | null) => void) => {
  if (!groupId) return () => {};
  return onSnapshot(doc(db, 'group_chats', groupId), (snap) => {
    if (snap.exists()) {
      callback(snap.data() as GroupChat);
    } else {
      callback(null);
    }
  }, () => {});
};

export const joinVoiceChannel = async (groupId: string, userId: string) => {
  if (isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    const voiceChannel = group.voiceChannel || { active: true, participants: [], mutedUsers: [] };
    const participants = Array.from(new Set([...(voiceChannel.participants || []), userId]));
    const mutedUsers = (voiceChannel.mutedUsers || []).filter(id => id !== userId);
    await updateDoc(docRef, {
      voiceChannel: { active: true, participants, mutedUsers }
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const leaveVoiceChannel = async (groupId: string, userId: string) => {
  if (isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    if (group.voiceChannel) {
      const participants = (group.voiceChannel.participants || []).filter(id => id !== userId);
      const mutedUsers = (group.voiceChannel.mutedUsers || []).filter(id => id !== userId);
      await updateDoc(docRef, {
        voiceChannel: {
          active: participants.length > 0,
          participants,
          mutedUsers
        }
      });
    }
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const toggleVoiceChannelMute = async (groupId: string, userId: string, isMuted: boolean) => {
  if (isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    const voiceChannel = group.voiceChannel || { active: true, participants: [userId], mutedUsers: [] };
    const mutedUsers = isMuted
      ? Array.from(new Set([...(voiceChannel.mutedUsers || []), userId]))
      : (voiceChannel.mutedUsers || []).filter(id => id !== userId);
    await updateDoc(docRef, {
      voiceChannel: { ...voiceChannel, mutedUsers }
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

const getGroupVoiceDocId = (groupId: string, idA: string, idB: string) => {
  const [minId, maxId] = [idA, idB].sort();
  return `gv_${groupId}__${minId}__${maxId}`;
};

export const subscribeToGroupVoiceSignals = (groupId: string, userId: string, callback: (signals: any[]) => void) => {
  if (!groupId || !userId) return () => {};
  return onSnapshot(collection(db, 'calls'), (snap) => {
    const signals = snap.docs
      .map(d => d.data())
      .filter((d: any) => d.status === 'group_voice' && d.groupId === groupId && (d.offererId === userId || d.answererId === userId));
    callback(signals);
  }, () => {});
};

export const sendGroupVoiceOffer = async (groupId: string, offererId: string, answererId: string, offer: any) => {
  if (isQuotaBlocked()) return;
  try {
    const docId = getGroupVoiceDocId(groupId, offererId, answererId);
    await setDoc(doc(db, 'calls', docId), {
      id: docId,
      status: 'group_voice',
      groupId,
      offererId,
      answererId,
      offer,
      answer: null,
      callerCandidates: [],
      receiverCandidates: [],
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const sendGroupVoiceAnswer = async (groupId: string, offererId: string, answererId: string, answer: any) => {
  if (isQuotaBlocked()) return;
  try {
    const docId = getGroupVoiceDocId(groupId, offererId, answererId);
    await updateDoc(doc(db, 'calls', docId), {
      answer,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const addGroupVoiceCandidate = async (groupId: string, idA: string, idB: string, side: 'caller' | 'receiver', candidate: any) => {
  if (isQuotaBlocked()) return;
  try {
    const docId = getGroupVoiceDocId(groupId, idA, idB);
    await updateDoc(doc(db, 'calls', docId), {
      [`${side}Candidates`]: arrayUnion(candidate)
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const cleanupGroupVoiceSignals = async (groupId: string, userId: string) => {
  if (isQuotaBlocked()) return;
  try {
    const snap = await getDocs(collection(db, 'calls'));
    const toDelete = snap.docs.filter(d => {
      const data: any = d.data();
      return data.status === 'group_voice' && data.groupId === groupId && (data.offererId === userId || data.answererId === userId);
    });
    for (const d of toDelete) {
      await deleteDoc(doc(db, 'calls', d.id));
    }
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const getUserStatuses = () => fetchCollection<UserStatus>('user_statuses');
export const saveUserStatuses = (statuses: UserStatus[]) => saveCollection('user_statuses', statuses);

export const updateTypingStatus = async (userId: string, isTyping: boolean, typingIn?: string) => {
  if (isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'user_statuses', userId);
    await setDoc(docRef, {
      id: userId,
      userId,
      isTyping,
      typingIn: typingIn || null,
      lastActive: Date.now()
    }, { merge: true });
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.error("Error updating typing status:", err);
    }
  }
};

export const markMessagesFromUserAsRead = async (currentUserId: string, otherUserId: string) => {
  try {
    const allMsgs = await getMessages();
    const unreadIds = allMsgs
      .filter(m => m.fromUserId === otherUserId && m.toUserId === currentUserId && !m.read)
      .map(m => m.id);
    if (unreadIds.length > 0) {
      await markMessagesSeen(unreadIds, currentUserId);
    }
  } catch (err) {
    console.error("Error marking messages as read:", err);
  }
};

export const getNotifications = () => fetchCollection<AppNotification>('notifications');
export const saveNotifications = (notifications: AppNotification[]) => saveCollection('notifications', notifications);

export const addNotifications = async (newNotifs: AppNotification[]) => {
  if (!newNotifs.length) return;
  try {
    const cached = getCachedCollection<AppNotification>('notifications');
    setCachedCollection('notifications', [...cached, ...newNotifs], false);
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    let knownMap = lastSyncedDocs.get('notifications');
    if (!knownMap) {
      knownMap = new Map<string, string>();
      lastSyncedDocs.set('notifications', knownMap);
    }
    for (let i = 0; i < newNotifs.length; i += 400) {
      const chunk = newNotifs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const n of chunk) {
        const cleaned = deepClean(n);
        batch.set(doc(db, 'notifications', n.id), cleaned, { merge: true });
        knownMap.set(n.id, JSON.stringify(cleaned));
      }
      await batch.commit();
    }
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  if (isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.error("Error marking notification as read:", err);
    }
  }
};

export const subscribeToNotifications = (userId: string, callback: (notifications: AppNotification[]) => void) => {
  return onSnapshot(collection(db, 'notifications'), (snapshot) => {
    const allNotifs = snapshot.docs.map(doc => doc.data() as AppNotification);
    setCachedCollection('notifications', allNotifs, true);
    callback(allNotifs.filter(n => n.userId === userId));
  }, (err) => {
    if (!handleWriteQuotaError(err)) {
      console.warn("Notification subscription error:", err);
    }
  });
};

export const announceForumPostToEveryone = async (post: FAQPost, author: User) => {
  try {
    const allUsers = await getUsers();
    const existingNotifs = await getNotifications();
    const newNotifs: AppNotification[] = allUsers.map(user => ({
      id: `notif_forum_${post.id}_${user.id}`,
      userId: user.id,
      type: 'forum_announcement',
      fromUserId: author.id,
      forumPostId: post.id,
      title: post.title,
      message: `📢 New Forum Announcement: "${post.title}"`,
      read: false,
      timestamp: Date.now()
    }));
    await saveNotifications([...existingNotifs, ...newNotifs]);
  } catch (err) {
    console.error("Error announcing forum post to everyone:", err);
  }
};

export const getReports = () => fetchCollection<Report>('reports');
export const saveReports = (reports: Report[]) => saveCollection('reports', reports);

export const addReport = async (report: Omit<Report, 'id'>) => {
  const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fullReport: Report = { ...report, id };
  try {
    const cached = getCachedCollection<Report>('reports');
    setCachedCollection('reports', [...cached, fullReport], false);
  } catch {}
  if (isQuotaBlocked()) return id;
  try {
    const docRef = doc(db, 'reports', id);
    await withTimeout(setDoc(docRef, deepClean(fullReport)), 8000);
    recordCollectionSnapshot('reports', [fullReport]);
    return id;
  } catch (err) {
    handleWriteQuotaError(err);
    console.warn("Report saved locally; remote sync deferred:", err);
    return id;
  }
};

export const resolveReport = async (
  reportId: string,
  adminId: string,
  adminUsername: string,
  notes?: string,
  resolutionStatus: 'resolved' | 'accepted' | 'rejected' = 'resolved',
  reportFallback?: Report
) => {
  let targetReport: Report | undefined = reportFallback;
  try {
    const cached = getCachedCollection<Report>('reports');
    const found = cached.find(r => r.id === reportId);
    if (found) targetReport = { ...found, ...targetReport };
    if (targetReport) {
      const updatedReport: Report = {
        ...targetReport,
        status: resolutionStatus,
        resolvedBy: adminId,
        adminNotes: notes || ''
      };
      const nextList = cached.some(r => r.id === reportId)
        ? cached.map(r => (r.id === reportId ? updatedReport : r))
        : [...cached, updatedReport];
      setCachedCollection('reports', nextList, false);
      recordCollectionSnapshot('reports', [updatedReport]);
    }
  } catch {}

  if (isQuotaBlocked()) return;

  try {
    const docRef = doc(db, 'reports', reportId);
    let existingReport = targetReport;
    if (!existingReport) {
      try {
        const snap = await withTimeout(getDoc(docRef), 5000);
        if (snap && snap.exists()) existingReport = snap.data() as Report;
      } catch {}
    }

    const payload = deepClean({
      ...(existingReport || { id: reportId }),
      status: resolutionStatus,
      resolvedBy: adminId,
      adminNotes: notes || ''
    });

    await withTimeout(setDoc(docRef, payload, { merge: true }), 8000);
    if (payload?.id) {
      recordCollectionSnapshot('reports', [payload]);
    }

    const reporterId = existingReport?.reporterId;
    if (reporterId && reporterId !== 'anonymous') {
      const notifId = `notif_resolved_${reportId}`;
      const notification: AppNotification = {
        id: notifId,
        userId: reporterId,
        type: 'support_resolved',
        fromUserId: adminId,
        title: resolutionStatus === 'rejected' ? 'Report / Support Dismissed' : 'Support Resolved',
        message: resolutionStatus === 'rejected'
          ? `Your report was reviewed by ${adminUsername}.${notes ? ` Moderator Note: ${notes}` : ''}`
          : `Your issue/support has been solved. Solved by: ${adminUsername}.${notes ? ` Moderator Note: ${notes}` : ''}`,
        read: false,
        timestamp: Date.now()
      };
      await withTimeout(addNotifications([notification]), 6000);
    }
  } catch (err) {
    handleWriteQuotaError(err);
    console.warn("Report resolved in local cache; remote Firestore sync deferred:", err);
  }
};

export const getAppeals = () => fetchCollection<Appeal>('appeals');
export const saveAppeals = (appeals: Appeal[]) => saveCollection('appeals', appeals);

export const getAuditLogs = () => fetchCollection<AuditLog>('audit_logs');
export const saveAuditLogs = (logs: AuditLog[]) => saveCollection('audit_logs', logs);
export const addAuditLog = async (log: AuditLog) => {
  try {
    const cached = getCachedCollection<AuditLog>('audit_logs').filter(l => l.id !== log.id);
    setCachedCollection('audit_logs', [...cached, log], false);
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    const cleaned = deepClean(log);
    await withTimeout(setDoc(doc(db, 'audit_logs', log.id), cleaned, { merge: true }), 6000);
    recordCollectionSnapshot('audit_logs', [log]);
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const deleteVideoFromDB = async (videoId: string) => {
  try {
    const docRef = doc(db, 'videos', videoId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting video:", err);
  }
};

export const getStories = () => fetchCollection<Story>('stories');
export const saveStories = (stories: Story[]) => saveCollection('stories', stories);
export const markStoryViewed = async (storyId: string, userId: string) => {
  if (isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'stories', storyId), {
      viewers: arrayUnion(userId)
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};
export const deleteStoryFromDB = async (storyId: string) => {
  try {
    const docRef = doc(db, 'stories', storyId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting story:", err);
  }
};

export const getFAQCategories = () => fetchCollection<FAQCategory>('faq_categories');
export const saveFAQCategories = (cats: FAQCategory[]) => saveCollection('faq_categories', cats);

export const getFAQPosts = () => fetchCollection<FAQPost>('faq_posts');
export const saveFAQPosts = (posts: FAQPost[]) => saveCollection('faq_posts', posts);
export const deleteFAQPostFromDB = async (postId: string) => {
  try {
    const docRef = doc(db, 'faq_posts', postId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting FAQ post:", err);
  }
};

export const getForumEditRequests = () => fetchCollection<ForumEditRequest>('forum_edit_requests');
export const saveForumEditRequests = (reqs: ForumEditRequest[]) => saveCollection('forum_edit_requests', reqs);
export const deleteForumEditRequestFromDB = async (reqId: string) => {
  try {
    const docRef = doc(db, 'forum_edit_requests', reqId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting forum edit request:", err);
  }
};

export const getCentralProRequests = async (): Promise<CentralProRequest[]> => {
  let reqs: CentralProRequest[] = [];
  
  // 1. Fetch from Firestore
  try {
    const snapshot = await getDocs(collection(db, 'centralpro_requests'));
    reqs = snapshot.docs.map(doc => doc.data() as CentralProRequest);
    if (reqs.length > 0) {
      try {
        localStorage.setItem('centralpro_all_requests', JSON.stringify(reqs));
      } catch {}
    }
  } catch (err: any) {
    // Firestore might be restricted or offline
  }

  // 2. Load from localStorage cache
  try {
    const cached = localStorage.getItem('centralpro_all_requests');
    if (cached) {
      const parsed: CentralProRequest[] = JSON.parse(cached);
      parsed.forEach(p => {
        const idx = reqs.findIndex(r => r.id === p.id || r.userId === p.userId);
        if (idx === -1) {
          reqs.push(p);
        } else if (p.status !== 'pending' && reqs[idx].status === 'pending') {
          reqs[idx] = p;
        }
      });
    }
  } catch {}

  // 3. Cross-reference with ALL users from getUsers()!
  // If ANY user has centralProStatus === 'pending', they MUST appear in the CentralPro requests list
  try {
    const users = await getUsers();
    users.forEach(u => {
      if (u.centralProStatus === 'pending') {
        const existing = reqs.find(r => r.userId === u.id);
        if (!existing) {
          const synthesized: CentralProRequest = {
            id: `cp_req_sync_${u.id}`,
            userId: u.id,
            username: u.username,
            handle: u.handle,
            userAvatar: u.avatarUrl,
            plan: u.centralProPlan || 'forever',
            status: 'pending',
            timestamp: Date.now()
          };
          reqs.unshift(synthesized);
        }
      } else if (u.isCentralPro || u.centralProStatus === 'active') {
        const existing = reqs.find(r => r.userId === u.id);
        if (!existing) {
          reqs.push({
            id: `cp_req_sync_${u.id}`,
            userId: u.id,
            username: u.username,
            handle: u.handle,
            userAvatar: u.avatarUrl,
            plan: u.centralProPlan || 'forever',
            status: 'accepted',
            timestamp: Date.now() - 3600000
          });
        }
      }
    });
  } catch {}

  // Sort: pending first, then by timestamp descending
  return reqs.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
};

export const saveCentralProRequests = async (reqs: CentralProRequest[]) => {
  try {
    localStorage.setItem('centralpro_all_requests', JSON.stringify(reqs));
  } catch {}
  await saveCollection('centralpro_requests', reqs);
};

export const requestCentralProVerification = async (user: User, plan: 'monthly' | 'forever') => {
  try {
    const reqId = `cp_req_${Date.now()}_${user.id}`;
    const newReq: CentralProRequest = {
      id: reqId,
      userId: user.id,
      username: user.username,
      handle: user.handle,
      userAvatar: user.avatarUrl,
      plan,
      status: 'pending',
      timestamp: Date.now()
    };

    const existingReqs = await getCentralProRequests();
    const updatedReqs = [newReq, ...existingReqs.filter(r => r.userId !== user.id)];
    await saveCentralProRequests(updatedReqs);

    try {
      // Update user status in Firestore and locally
      await updateUser(user.id, {
        centralProStatus: 'pending',
        centralProPlan: plan
      });
    } catch (userErr) {
      console.warn("Note updating user centralProStatus in Firestore:", userErr);
    }

    try {
      // Notify all staff and owners for priority support
      const allUsers = await getUsers();
      const admins = allUsers.filter(u => u.role === 'owner' || u.role === 'staff');
      const notifs = await getNotifications();

      admins.forEach(admin => {
        notifs.push({
          id: `notif_cp_pri_${Date.now()}_${admin.id}`,
          userId: admin.id,
          type: 'centralpro_update',
          fromUserId: user.id,
          title: '🚨 Priority Support: CentralPro Payment Verification',
          message: `@${user.handle} submitted confirmation for ${plan === 'forever' ? '$1 Forever' : '$0.50 Monthly'}. Check Cash App $ZaelLac and verify note @${user.handle}.`,
          read: false,
          timestamp: Date.now(),
          isImportant: true,
          actionButton: {
            text: 'Review in Moderation',
            action: 'open_admin_centralpro'
          }
        });
      });

      await saveNotifications(notifs);
    } catch (notifErr) {
      console.warn("Note dispatching priority support notification:", notifErr);
    }

    return newReq;
  } catch (err) {
    console.error("Error requesting CentralPro verification:", err);
    throw err;
  }
};

export const approveCentralProPayment = async (requestId: string, adminUser: User) => {
  try {
    const reqs = await getCentralProRequests();
    const req = reqs.find(r => r.id === requestId);
    if (!req) return;

    req.status = 'accepted';
    req.reviewedBy = adminUser.id;
    req.reviewedAt = Date.now();
    await saveCentralProRequests(reqs);

    // Update user in Firestore
    await updateUser(req.userId, {
      isCentralPro: true,
      centralProStatus: 'active',
      centralProPlan: req.plan
    });

    // Notify user with welcome message and perks
    const notifs = await getNotifications();
    notifs.push({
      id: `notif_cp_welcome_${Date.now()}_${req.userId}`,
      userId: req.userId,
      type: 'centralpro_update',
      fromUserId: adminUser.id,
      title: '🚀 CentralPro Activated!',
      message: 'Your part of the CentralPro Community Welcome!!, Heres your perks: Custom Profile Banner, Multiple Display Name Fonts, All Verified Perks, and the Cosmic CentralPro Rocket Badge!',
      read: false,
      timestamp: Date.now(),
      isImportant: true
    });
    await saveNotifications(notifs);
  } catch (err) {
    console.error("Error approving CentralPro payment:", err);
    throw err;
  }
};

export const declineCentralProPayment = async (requestId: string, adminUser: User) => {
  try {
    const reqs = await getCentralProRequests();
    const req = reqs.find(r => r.id === requestId);
    if (!req) return;

    req.status = 'declined';
    req.reviewedBy = adminUser.id;
    req.reviewedAt = Date.now();
    await saveCentralProRequests(reqs);

    // Update user status
    await updateUser(req.userId, {
      centralProStatus: 'declined'
    });

    // Notify user that payment was declined
    const notifs = await getNotifications();
    notifs.push({
      id: `notif_cp_declined_${Date.now()}_${req.userId}`,
      userId: req.userId,
      type: 'centralpro_update',
      fromUserId: adminUser.id,
      title: '⚠️ CentralPro Payment Declined',
      message: 'Your CentralPro payment was declined. We could not verify your Cash App payment. Please ensure you put your username in the note or contact support.',
      read: false,
      timestamp: Date.now(),
      isImportant: true
    });
    await saveNotifications(notifs);
  } catch (err) {
    console.error("Error declining CentralPro payment:", err);
    throw err;
  }
};

export const getSneakPeeks = () => fetchCollection<SneakPeek>('sneak_peeks');

export const saveSneakPeek = async (peek: SneakPeek) => {
  try {
    const cleaned = deepClean(peek);
    const docRef = doc(db, 'sneak_peeks', peek.id);
    await setDoc(docRef, cleaned);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sneak_peeks/${peek.id}`);
  }
};

export const saveSneakPeeks = async (peeks: SneakPeek[]) => {
  if (peeks.length === 0) return;
  await saveCollection('sneak_peeks', peeks);
};

export const deleteSneakPeekFromDB = async (peekId: string) => {
  try {
    const docRef = doc(db, 'sneak_peeks', peekId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Error deleting sneak peek:", err);
    handleFirestoreError(err, OperationType.DELETE, `sneak_peeks/${peekId}`);
  }
};
export const subscribeToSneakPeeks = (callback: (peeks: SneakPeek[]) => void) => {
  return onSnapshot(collection(db, 'sneak_peeks'), (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data() as SneakPeek));
  }, (err) => {
    if (!handleWriteQuotaError(err)) {
      console.warn("Sneak peeks subscription warning:", err);
    }
  });
};

export const getAppSettings = async () => {
  const fallback = {
    useCache: true,
    youtubeApiKeyIndex: 0,
    serverCrashed: false,
    gamesAppsCrashed: false
  };
  if (isQuotaBlocked()) return fallback;
  try {
    const docRef = doc(db, 'app_settings', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as {
        useCache: boolean;
        youtubeApiKeyIndex: number;
        serverCrashed: boolean;
        gamesAppsCrashed: boolean;
      };
    }
    return fallback;
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.error("Error fetching app settings:", err);
    }
    return fallback;
  }
};

export const saveAppSettings = async (settings: { 
  useCache: boolean; 
  youtubeApiKeyIndex?: number; 
  serverCrashed?: boolean; 
  gamesAppsCrashed?: boolean; 
}) => {
  try {
    const docRef = doc(db, 'app_settings', 'global');
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.error("Error saving app settings:", err);
  }
};

export const subscribeToAppSettings = (callback: (settings: any) => void) => {
  return onSnapshot(doc(db, 'app_settings', 'global'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback({ 
        useCache: true, 
        youtubeApiKeyIndex: 0, 
        serverCrashed: false, 
        gamesAppsCrashed: false 
      });
    }
  }, (err) => {
    // Suppress connection warning
  });
};

export const clearDb = async () => {};

// WebRTC Signaling Helpers
export const createCall = async (callId: string, callerId: string, receiverId: string, offer: any, extraData: Record<string, any> = {}): Promise<boolean> => {
  if (isQuotaBlocked()) return false;
  try {
    const docRef = doc(db, 'calls', callId);
    await setDoc(docRef, deepClean({
      id: callId,
      callerId,
      receiverId,
      status: 'initiating',
      offer,
      timestamp: Date.now(),
      ...extraData
    }), { merge: true });
    return true;
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.warn('Error creating call:', err);
    }
    return false;
  }
};

export const updateCall = async (callId: string, data: any) => {
  if (!callId || isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'calls', callId);
    await setDoc(docRef, deepClean(data), { merge: true });
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.warn('Error updating call:', err);
    }
  }
};

export const addIceCandidate = async (callId: string, side: 'caller' | 'receiver', candidate: any) => {
  if (!callId || !candidate || isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'calls', callId);
    await setDoc(docRef, {
      [`${side}Candidates`]: arrayUnion(deepClean(candidate))
    }, { merge: true });
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.warn('Error adding ICE candidate:', err);
    }
  }
};

export const deleteCall = async (callId: string) => {
  if (!callId || isQuotaBlocked()) return;
  try {
    const docRef = doc(db, 'calls', callId);
    await deleteDoc(docRef);
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const getGameData = async (userId: string, gameId: string): Promise<string | null> => {
  try {
    const id = `${userId}_${gameId}`;
    const docRef = doc(db, 'game_data', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return (snap.data() as GameData).data;
    }
    return null;
  } catch (err) {
    console.error("Error fetching game data:", err);
    return null;
  }
};

export const saveGameData = async (userId: string, gameId: string, data: string) => {
  try {
    const id = `${userId}_${gameId}`;
    const docRef = doc(db, 'game_data', id);
    await setDoc(docRef, {
      id,
      userId,
      gameId,
      data,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error("Error saving game data:", err);
    handleFirestoreError(err, OperationType.WRITE, `game_data/${userId}_${gameId}`);
  }
};

export const createWatchParty = async (hostId: string, currentVideoId: string, groupId?: string): Promise<string> => {
  try {
    const partyId = Math.random().toString(36).substr(2, 9);
    const partyRef = doc(db, 'watch_parties', partyId);
    const partyData: WatchParty = {
      id: partyId,
      hostId,
      groupId,
      currentVideoId,
      participants: [hostId],
      status: 'playing',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await setDoc(partyRef, partyData);
    return partyId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'watch_parties');
    return '';
  }
};

export const updateWatchPartyState = async (partyId: string, updates: Partial<WatchParty>) => {
  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    await updateDoc(partyRef, {
      ...updates,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `watch_parties/${partyId}`);
  }
};

export const subscribeToWatchParty = (partyId: string, callback: (party: WatchParty | null) => void) => {
  const partyRef = doc(db, 'watch_parties', partyId);
  return onSnapshot(partyRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as WatchParty);
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `watch_parties/${partyId}`);
  });
};

export const subscribeToWatchPartiesByGroup = (groupId: string, callback: (parties: WatchParty[]) => void) => {
  const partiesRef = collection(db, 'watch_parties');
  // We'll use a snapshot and filter client-side for simplicity in the absence of complex indexes
  return onSnapshot(partiesRef, (snap) => {
    const parties = snap.docs
      .map(doc => doc.data() as WatchParty)
      .filter(p => p.groupId === groupId);
    callback(parties);
  }, (err) => {
    // Suppress connection warning
  });
};

export const joinWatchParty = async (partyId: string, userId: string) => {
  try {
    const partyRef = doc(db, 'watch_parties', partyId);
    await updateDoc(partyRef, {
      participants: arrayUnion(userId),
      updatedAt: Date.now()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `watch_parties/${partyId}`);
  }
};

// Call Management
export const initiateCall = async (callerId: string, receiverId: string, type: 'voice' | 'video' = 'voice') => {
  try {
    const callId = Math.random().toString(36).substr(2, 9);
    const callRef = doc(db, 'calls', callId);
    const callData: Call = {
      id: callId,
      callerId,
      receiverId,
      type,
      status: 'offering',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await setDoc(callRef, callData);

    // Create notification for receiver
    const notifId = `notif_call_${callId}`;
    const notif: AppNotification = {
      id: notifId,
      userId: receiverId,
      fromUserId: callerId,
      type: 'call',
      callId,
      title: 'Incoming Call',
      message: `You have an incoming ${type} call`,
      read: false,
      timestamp: Date.now()
    };
    await saveNotifications([notif]);

    return callId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'calls');
    return '';
  }
};

export const updateCallStatus = async (callId: string, status: Call['status'], extra?: Partial<Call>) => {
  try {
    const callRef = doc(db, 'calls', callId);
    await updateDoc(callRef, deepClean({
      ...extra,
      status,
      updatedAt: Date.now()
    }));

    // If answered or declined, mark call notification as read or delete it
    if (status === 'answered' || status === 'declined') {
      const notifId = `notif_call_${callId}`;
      const notifRef = doc(db, 'notifications', notifId);
      const snap = await getDoc(notifRef);
      if (snap.exists()) {
        await updateDoc(notifRef, { read: true });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `calls/${callId}`);
  }
};

export const subscribeToIncomingCalls = (userId: string, callback: (calls: Call[]) => void) => {
  const callsRef = collection(db, 'calls');
  return onSnapshot(callsRef, (snap) => {
    const calls = snap.docs
      .map(doc => doc.data() as Call)
      .filter(c => c.receiverId === userId && c.status === 'offering');
    callback(calls);
  }, (err) => {
    // Suppress connection warning
  });
};

export const subscribeToCall = (callId: string, callback: (call: Call | null) => void) => {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Call);
    } else {
      callback(null);
    }
  }, (err) => {
    // Suppress connection warning
  });
};

// ==========================================
// LIVE STREAMING & LIVE CHAT / WEBRTC
// Stored inside watch_parties / messages / calls to match active Firestore rules
// ==========================================

const LIVE_STREAM_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export const getLiveRtcDocId = (streamId: string, viewerId: string) => {
  return `live_rtc_${streamId}__${viewerId}`;
};

export const subscribeToLiveStreams = (callback: (streams: LiveStream[]) => void) => {
  return onSnapshot(collection(db, 'watch_parties'), (snap) => {
    const now = Date.now();
    const streams = snap.docs
      .map(d => d.data() as any)
      .filter((d): d is LiveStream => Boolean(d?.isLiveStream) && d.status === 'live' && (now - (d.updatedAt || d.startedAt || now) < LIVE_STREAM_MAX_AGE_MS))
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    try {
      localStorage.setItem('ct_cache_live_streams', JSON.stringify(streams));
    } catch {}
    callback(streams);
  }, () => {
    try {
      const cached = JSON.parse(localStorage.getItem('ct_cache_live_streams') || '[]') as LiveStream[];
      callback(cached.filter(s => s.status === 'live'));
    } catch {
      callback([]);
    }
  });
};

export const subscribeToLiveStream = (streamId: string, callback: (stream: LiveStream | null) => void) => {
  if (!streamId) return () => {};
  return onSnapshot(doc(db, 'watch_parties', streamId), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as any;
      if (data?.isLiveStream) {
        callback(data as LiveStream);
        return;
      }
    }
    callback(null);
  }, () => {});
};

export const createLiveStream = async (stream: LiveStream) => {
  if (isQuotaBlocked()) return;
  try {
    const cleaned = deepClean(stream);
    await setDoc(doc(db, 'watch_parties', stream.id), cleaned);
  } catch (err) {
    if (!handleWriteQuotaError(err)) {
      console.error('Error creating live stream:', err);
      throw err;
    }
  }
};

export const updateLiveStream = async (streamId: string, updates: Partial<LiveStream>) => {
  if (!streamId || isQuotaBlocked()) return;
  try {
    const cleaned = deepClean({ ...updates, updatedAt: Date.now() });
    await updateDoc(doc(db, 'watch_parties', streamId), cleaned);
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const joinLiveStream = async (streamId: string, viewerId: string) => {
  if (!streamId || !viewerId || isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'watch_parties', streamId), {
      viewers: arrayUnion(viewerId),
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const leaveLiveStream = async (streamId: string, viewerId: string) => {
  if (!streamId || !viewerId || isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'watch_parties', streamId), {
      viewers: arrayRemove(viewerId)
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const sendLiveReaction = async (streamId: string, emoji: string, senderName: string) => {
  if (!streamId || isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'watch_parties', streamId), {
      likes: increment(1),
      recentReaction: {
        id: `rx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        emoji,
        senderName,
        timestamp: Date.now()
      }
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const voteLivePoll = async (streamId: string, userId: string, optionIndex: number) => {
  if (!streamId || !userId || isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'watch_parties', streamId), {
      [`poll.votes.${userId}`]: optionIndex,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const cleanupLiveRtcForViewer = async (streamId: string, viewerId: string) => {
  if (!streamId || !viewerId || isQuotaBlocked()) return;
  try {
    await deleteDoc(doc(db, 'calls', getLiveRtcDocId(streamId, viewerId)));
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const endLiveStream = async (streamId: string) => {
  if (!streamId || isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'watch_parties', streamId), {
      status: 'ended',
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
  try {
    const snap = await getDocs(collection(db, 'calls'));
    const toDelete = snap.docs.filter(d => {
      const data = d.data() as any;
      return data?.status === 'live_rtc' && data?.streamId === streamId;
    });
    for (const d of toDelete) {
      await deleteDoc(doc(db, 'calls', d.id));
    }
  } catch {}
};

export const subscribeToLiveChat = (streamId: string, callback: (messages: Message[]) => void) => {
  const channelId = `live_chat_${streamId}`;
  return onSnapshot(collection(db, 'messages'), (snapshot) => {
    const msgs = snapshot.docs
      .map(d => d.data() as Message)
      .filter(m => m.groupId === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
    callback(msgs);
  }, () => {});
};

export const sendLiveChatMessage = async (streamId: string, msg: Message) => {
  return addMessage({
    ...msg,
    groupId: `live_chat_${streamId}`
  });
};

export const subscribeToLiveRtcHost = (streamId: string, callback: (signals: LiveRtcSignal[]) => void) => {
  if (!streamId) return () => {};
  return onSnapshot(collection(db, 'calls'), (snap) => {
    const signals = snap.docs
      .map(d => d.data() as any)
      .filter((d): d is LiveRtcSignal => d?.status === 'live_rtc' && d.streamId === streamId);
    callback(signals);
  }, () => {});
};

export const subscribeToLiveRtcViewer = (streamId: string, viewerId: string, callback: (signal: LiveRtcSignal | null) => void) => {
  if (!streamId || !viewerId) return () => {};
  return onSnapshot(doc(db, 'calls', getLiveRtcDocId(streamId, viewerId)), (snap) => {
    if (snap.exists()) {
      callback(snap.data() as LiveRtcSignal);
    } else {
      callback(null);
    }
  }, () => {});
};

export const sendLiveRtcOffer = async (streamId: string, hostId: string, viewerId: string, offer: any) => {
  if (isQuotaBlocked()) return;
  try {
    const docId = getLiveRtcDocId(streamId, viewerId);
    await setDoc(doc(db, 'calls', docId), {
      id: docId,
      status: 'live_rtc',
      streamId,
      hostId,
      viewerId,
      offer,
      answer: null,
      hostCandidates: [],
      viewerCandidates: [],
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const sendLiveRtcAnswer = async (streamId: string, viewerId: string, answer: any) => {
  if (isQuotaBlocked()) return;
  try {
    const docId = getLiveRtcDocId(streamId, viewerId);
    await updateDoc(doc(db, 'calls', docId), {
      answer,
      updatedAt: Date.now()
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const addLiveRtcCandidate = async (streamId: string, viewerId: string, side: 'host' | 'viewer', candidate: any) => {
  if (isQuotaBlocked()) return;
  try {
    const docId = getLiveRtcDocId(streamId, viewerId);
    await updateDoc(doc(db, 'calls', docId), {
      [`${side}Candidates`]: arrayUnion(candidate)
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

