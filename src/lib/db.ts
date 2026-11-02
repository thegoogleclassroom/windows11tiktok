import { collection, doc, getDocs, setDoc, updateDoc, writeBatch, arrayUnion, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
export { db, doc, updateDoc, getDoc };
import { User, Video, Message, AppNotification, Report, Appeal, AuditLog, Comment, Story, FAQCategory, FAQPost, ForumEditRequest, GroupChat, UserStatus, GameData, WatchParty, Announcement, Call, VerificationRequest, AppSuggestion, SneakPeek } from '../types';

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

const fetchCollection = async <T>(collName: string): Promise<T[]> => {
  try {
    const snapshot = await getDocs(collection(db, collName));
    return snapshot.docs.map(doc => doc.data() as T);
  } catch (err) {
    console.error("Error fetching collection:", collName, err);
    return [];
  }
};

const saveCollection = async <T extends { id: string }>(collName: string, items: T[]) => {
  if (!items || items.length === 0) return;
  try {
    const batch = writeBatch(db);
    items.forEach(item => {
      if (!item || typeof item !== 'object' || !item.id) return;
      try {
        const docRef = doc(db, collName, item.id);
        let dataToSave = deepClean(item);
        if (dataToSave && typeof dataToSave === 'object') {
          if ('videoData' in dataToSave) {
            delete (dataToSave as any).videoData;
          }
          batch.set(docRef, dataToSave, { merge: true });
        }
      } catch (itemErr) {
        // Silently ignore malformed items
      }
    });
    await batch.commit();
  } catch (err) {
    // Silently ignore batch commit errors to keep UI smooth
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
    const docRef = doc(db, 'users', userId);
    const updateData = deepClean(data);
    await updateDoc(docRef, updateData);
  } catch (err) {
    console.error("Error updating user:", userId, err);
    throw err;
  }
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
export const subscribeToMessages = (callback: (messages: Message[]) => void) => {
  return onSnapshot(collection(db, 'messages'), (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data() as Message));
  }, (err) => {
    console.warn("Messages subscription error:", err);
  });
};
export const deleteMessage = async (messageId: string) => {
  const msgs = await getMessages();
  await saveMessages(msgs.filter(m => m.id !== messageId));
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

export const joinVoiceChannel = async (groupId: string, userId: string) => {
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    const voiceChannel = group.voiceChannel || { active: true, participants: [] };
    if (!(voiceChannel.participants || []).includes(userId)) {
      voiceChannel.participants.push(userId);
      await updateDoc(docRef, { voiceChannel: { ...voiceChannel, active: true } });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `group_chats/${groupId}/join`);
  }
};

export const leaveVoiceChannel = async (groupId: string, userId: string) => {
  try {
    const docRef = doc(db, 'group_chats', groupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const group = snap.data() as GroupChat;
    if (group.voiceChannel) {
      group.voiceChannel.participants = group.voiceChannel.participants.filter(id => id !== userId);
      if (group.voiceChannel.participants.length === 0) {
        group.voiceChannel.active = false;
      }
      await updateDoc(docRef, { voiceChannel: group.voiceChannel });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `group_chats/${groupId}/leave`);
  }
};

export const getUserStatuses = () => fetchCollection<UserStatus>('user_statuses');
export const saveUserStatuses = (statuses: UserStatus[]) => saveCollection('user_statuses', statuses);

export const updateTypingStatus = async (userId: string, isTyping: boolean, typingIn?: string) => {
  try {
    const docRef = doc(db, 'user_statuses', userId);
    await setDoc(docRef, {
      id: userId,
      userId,
      isTyping,
      typingIn,
      lastActive: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error("Error updating typing status:", err);
  }
};

export const markMessagesFromUserAsRead = async (currentUserId: string, otherUserId: string) => {
  try {
    const allMsgs = await getMessages();
    let hasChanged = false;
    const updated = allMsgs.map(m => {
      if (m.fromUserId === otherUserId && m.toUserId === currentUserId && !m.read) {
        hasChanged = true;
        return { ...m, read: true };
      }
      return m;
    });
    if (hasChanged) {
      await saveMessages(updated);
    }
  } catch (err) {
    console.error("Error marking messages as read:", err);
  }
};

export const getNotifications = () => fetchCollection<AppNotification>('notifications');
export const saveNotifications = (notifications: AppNotification[]) => saveCollection('notifications', notifications);

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
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
  try {
    const batch = writeBatch(db);
    peeks.forEach(item => {
      const docRef = doc(db, 'sneak_peeks', item.id);
      const cleaned = deepClean(item);
      batch.set(docRef, cleaned);
    });
    await batch.commit();
  } catch (err) {
    console.error("Error saving sneak peeks:", err);
    handleFirestoreError(err, OperationType.WRITE, 'sneak_peeks');
  }
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
export const createCall = async (callId: string, callerId: string, receiverId: string, offer: any) => {
  try {
    const docRef = doc(db, 'calls', callId);
    await setDoc(docRef, {
      id: callId,
      callerId,
      receiverId,
      status: 'initiating',
      offer,
      timestamp: Date.now()
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
