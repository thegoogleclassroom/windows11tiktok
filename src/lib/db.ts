import { collection, doc, getDocs, setDoc, updateDoc, writeBatch, arrayUnion, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
export { db, doc, updateDoc, getDoc };
import { User, Video, Message, AppNotification, Report, Appeal, AuditLog, Comment, Story, FAQCategory, FAQPost, ForumEditRequest, GroupChat, UserStatus, GameData, WatchParty, Announcement, Call, VerificationRequest, AppSuggestion, SneakPeek, CentralProRequest } from '../types';

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
    console.warn("Suggestions subscription permission denied or error:", err);
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
    console.warn("Verification requests subscription permission denied or error:", err);
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
    console.error("Announcement subscription error:", err);
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
let quotaBlockedUntil = 0;

export const isQuotaBlocked = () => Date.now() < quotaBlockedUntil;

export const isQuotaError = (err: any): boolean => {
  const code = err?.code || '';
  const msg = (err?.message || String(err || '')).toLowerCase();
  return code === 'resource-exhausted' || msg.includes('resource-exhausted') || msg.includes('quota exceeded') || msg.includes('quota limit');
};

export const handleWriteQuotaError = (err: any) => {
  if (isQuotaError(err)) {
    // Pause Firestore writes for 5 minutes to avoid SDK retry storms
    quotaBlockedUntil = Date.now() + 5 * 60 * 1000;
    console.warn('Firestore daily write quota reached — pausing remote writes and keeping local cache active.');
    return true;
  }
  return false;
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
  try {
    const snapshot = await getDocs(collection(db, collName));
    const items = snapshot.docs.map(doc => doc.data() as T);
    recordCollectionSnapshot(collName, items as any[]);
    try {
      localStorage.setItem(`ct_cache_${collName}`, JSON.stringify(items));
    } catch {}
    return items;
  } catch (err: any) {
    handleWriteQuotaError(err);
    const msg = err?.message || String(err);
    if (!msg.includes('Missing or insufficient permissions') && !msg.includes('permission-denied')) {
      console.warn(`Note on fetching ${collName}:`, msg);
    }
    try {
      const cached = localStorage.getItem(`ct_cache_${collName}`);
      if (cached) {
        return JSON.parse(cached) as T[];
      }
    } catch {}
    return [];
  }
};

const saveCollection = async <T extends { id: string }>(collName: string, items: T[]) => {
  if (!items || items.length === 0) return;
  try {
    localStorage.setItem(`ct_cache_${collName}`, JSON.stringify(items));
  } catch {}
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
  const docRef = doc(db, 'users', id);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() as User : null;
};
export const saveUsers = (users: User[]) => saveCollection('users', users);

export const updateUser = async (userId: string, data: Partial<User>) => {
  try {
    const cached = JSON.parse(localStorage.getItem('ct_cache_users') || '[]') as User[];
    if (cached.length > 0) {
      localStorage.setItem('ct_cache_users', JSON.stringify(cached.map(u => u.id === userId ? { ...u, ...data } : u)));
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
  if (!userId || isQuotaBlocked()) return;
  try {
    await updateDoc(doc(db, 'users', userId), {
      listeningState: listeningState ? deepClean(listeningState) : null
    });
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const subscribeToUserDoc = (userId: string, callback: (user: User | null) => void) => {
  if (!userId) return () => {};
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (snap.exists()) {
      callback(snap.data() as User);
    } else {
      callback(null);
    }
  }, () => {});
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

export const addMessage = async (msg: Message) => {
  try {
    const cached = JSON.parse(localStorage.getItem('ct_cache_messages') || '[]') as Message[];
    localStorage.setItem('ct_cache_messages', JSON.stringify([...cached, msg]));
  } catch {}
  if (isQuotaBlocked()) return;
  try {
    const cleaned = deepClean(msg);
    const docRef = doc(db, 'messages', msg.id);
    await setDoc(docRef, cleaned, { merge: true });
    let knownMap = lastSyncedDocs.get('messages');
    if (!knownMap) {
      knownMap = new Map<string, string>();
      lastSyncedDocs.set('messages', knownMap);
    }
    knownMap.set(msg.id, JSON.stringify(cleaned));
  } catch (err) {
    handleWriteQuotaError(err);
  }
};

export const markMessagesSeen = async (messageIds: string[], userId: string) => {
  if (!messageIds.length || !userId) return;
  try {
    const cached = JSON.parse(localStorage.getItem('ct_cache_messages') || '[]') as Message[];
    if (cached.length > 0) {
      const idSet = new Set(messageIds);
      const updated = cached.map(m =>
        idSet.has(m.id)
          ? { ...m, read: true, seenBy: Array.from(new Set([...(m.seenBy || []), userId])) }
          : m
      );
      localStorage.setItem('ct_cache_messages', JSON.stringify(updated));
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
    callback(msgs);
  }, (err) => {
    console.warn("Messages subscription error:", err);
  });
};
export const deleteMessage = async (messageId: string) => {
  try {
    const cached = JSON.parse(localStorage.getItem('ct_cache_messages') || '[]') as Message[];
    localStorage.setItem('ct_cache_messages', JSON.stringify(cached.filter(m => m.id !== messageId)));
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
    const cached = JSON.parse(localStorage.getItem('ct_cache_messages') || '[]') as Message[];
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
      localStorage.setItem('ct_cache_messages', JSON.stringify(cached.map(m => m.id === messageId ? { ...m, reactions: current } : m)));
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
    const cached = JSON.parse(localStorage.getItem('ct_cache_notifications') || '[]') as AppNotification[];
    localStorage.setItem('ct_cache_notifications', JSON.stringify([...cached, ...newNotifs]));
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
    const notifs = snapshot.docs
      .map(doc => doc.data() as AppNotification)
      .filter(n => n.userId === userId);
    callback(notifs);
  }, (err) => {
    console.warn("Notification subscription error:", err);
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
  try {
    const id = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'reports', id);
    await setDoc(docRef, { ...report, id });
    return id;
  } catch (err) {
    console.error("Error adding report:", err);
    throw err;
  }
};

export const resolveReport = async (reportId: string, adminId: string, adminUsername: string, notes?: string) => {
  try {
    const docRef = doc(db, 'reports', reportId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    
    const report = snap.data() as Report;
    await updateDoc(docRef, {
      status: 'resolved',
      resolvedBy: adminId,
      adminNotes: notes
    });

    // Create notification for reporter
    const notifId = `notif_resolved_${reportId}`;
    const notifRef = doc(db, 'notifications', notifId);
    const notification: AppNotification = {
      id: notifId,
      userId: report.reporterId,
      type: 'support_resolved',
      fromUserId: adminId,
      title: 'Support Resolved',
      message: `Your issue/support has been solved. Solved by: ${adminUsername}.${notes ? ` Moderator Note: ${notes}` : ''}`,
      read: false,
      timestamp: Date.now()
    };
    await setDoc(notifRef, notification);
  } catch (err) {
    console.error("Error resolving report:", err);
  }
};

export const getAppeals = () => fetchCollection<Appeal>('appeals');
export const saveAppeals = (appeals: Appeal[]) => saveCollection('appeals', appeals);

export const getAuditLogs = () => fetchCollection<AuditLog>('audit_logs');
export const saveAuditLogs = (logs: AuditLog[]) => saveCollection('audit_logs', logs);

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
    console.warn("Sneak peeks subscription warning:", err);
  });
};

export const getAppSettings = async () => {
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
    return { 
      useCache: true, 
      youtubeApiKeyIndex: 0, 
      serverCrashed: false, 
      gamesAppsCrashed: false 
    };
  } catch (err) {
    console.error("Error fetching app settings:", err);
    return { 
      useCache: true, 
      youtubeApiKeyIndex: 0, 
      serverCrashed: false, 
      gamesAppsCrashed: false 
    };
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
export const createCall = async (callId: string, callerId: string, receiverId: string, offer: any, extraData: Record<string, any> = {}) => {
  try {
    const docRef = doc(db, 'calls', callId);
    await setDoc(docRef, {
      id: callId,
      callerId,
      receiverId,
      status: 'initiating',
      offer,
      timestamp: Date.now(),
      ...extraData
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `calls/${callId}`);
  }
};

export const updateCall = async (callId: string, data: any) => {
  try {
    const docRef = doc(db, 'calls', callId);
    await updateDoc(docRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `calls/${callId}`);
  }
};

export const addIceCandidate = async (callId: string, side: 'caller' | 'receiver', candidate: any) => {
  try {
    const docRef = doc(db, 'calls', callId);
    await updateDoc(docRef, {
      [`${side}Candidates`]: arrayUnion(candidate)
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `calls/${callId}/ice`);
  }
};

export const deleteCall = async (callId: string) => {
  try {
    const docRef = doc(db, 'calls', callId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `calls/${callId}`);
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
