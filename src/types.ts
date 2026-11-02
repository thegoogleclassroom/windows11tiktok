// Touch
export type User = {
  id: string;
  email: string;
  username: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  following: string[]; // User IDs
  followers: string[]; // User IDs
  favorites?: string[]; // Video IDs
  isPrivate: boolean;
  deviceId?: string;
  role?: 'user' | 'staff' | 'owner';
  interests?: string[];
  badges?: string[];
  currentGame?: string;
  showActivityStatus?: boolean;
  password?: string;
  isGhostMode?: boolean;
  isVerified?: boolean;
  isCentralPro?: boolean;
  centralProPlan?: 'monthly' | 'forever';
  centralProStatus?: 'pending' | 'active' | 'declined' | 'none';
  profileBannerUrl?: string;
  displayNameFont?: string;
  isSystemWiped?: boolean;
  themeStyle?: string;
  acceptedReportsCount?: number;
  banStatus?: {
    type: 'temp' | 'perm' | 'hwid';
    until?: number; // timestamp for temp ban
    linkedAccount?: string; // for hwid evasion links
    reason?: string;
    bannedBy?: string;
    bannedAt?: number;
    unbanReason?: string;
    stillBannedReason?: string;
  };
};

export type Report = {
  id: string;
  videoId?: string;
  reporterId: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected' | 'resolved';
  adminNotes?: string;
  timestamp: number;
  category?: 'video' | 'support' | 'bug';
  resolvedBy?: string; // Admin ID
};

export type Appeal = {
  id: string;
  userId: string;
  videoId?: string; // Optional: can be for a video or a ban
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  adminNotes?: string;
  timestamp: number;
};

export type AuditLog = {
  id: string;
  action: string;
  adminId: string;
  targetId: string; // userId or videoId
  details: string;
  timestamp: number;
  reverted?: boolean;
};

export type Video = {
  id: string;
  userId: string;
  videoUrl: string; // Object URL or external URL
  videoData?: File | Blob; // For IDB storage
  imageUrl?: string;
  mediaType?: 'video' | 'image';
  visibility?: 'everyone' | 'friends' | 'only_you';
  description: string;
  tags: string[];
  likes: string[]; // User IDs
  comments: Comment[];
  timestamp: number;
  views: number;
  viewedBy?: string[]; // User IDs or anonymous session IDs
  filter: string;
  musicId?: string;
  musicStartTime?: number;
  textOverlays?: {
    id: string;
    text: string;
    x: number;
    y: number;
    animation: string;
    fontSize: number;
    color: string;
  }[];
  isYouTube?: boolean;
  youtubeId?: string;
  feedId?: string;
  isRemoved?: boolean;
  removalReason?: string;
};

export type Story = {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  visibility?: 'everyone' | 'friends' | 'only_you';
  caption?: string;
  timestamp: number;
  expiresAt: number; // 24h expiration
  viewers?: string[]; // User IDs who viewed
  filter?: string;
  musicId?: string;
  musicStartTime?: number;
  textOverlays?: {
    id: string;
    text: string;
    x: number;
    y: number;
    animation: string;
    fontSize: number;
    color: string;
  }[];
};

export type FAQCategory = {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
};

export type FAQReply = {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
};

export type FAQPost = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  categoryId: string;
  pinned?: boolean;
  timestamp: number;
  updatedAt?: number;
  replies: FAQReply[];
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  allowReplies?: boolean; // enable comments/replies or not
  registeredOnly?: boolean; // registered users only to view
  mediaUrl?: string; // image or video attachment
  mediaType?: 'image' | 'video'; // attachment type
};

export type ForumEditRequest = {
  id: string;
  postId: string;
  staffId: string;
  proposedTitle: string;
  proposedContent: string;
  proposedCategoryId: string;
  proposedMediaUrl?: string;
  proposedMediaType?: 'image' | 'video';
  proposedPinned?: boolean;
  proposedAllowReplies?: boolean;
  proposedRegisteredOnly?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
};

export type SneakPeekComment = {
  id: string;
  userId: string;
  content: string;
  timestamp: number;
};

export type SneakPeek = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  status: 'in_development' | 'rolling_out' | 'concept' | 'testing';
  progressPercentage: number; // 0 - 100
  targetVersion: string;
  tags: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  pinned?: boolean;
  timestamp: number;
  updatedAt?: number;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  comments: SneakPeekComment[];
};

export type Comment = {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
  replyToId?: string;
};

export type Message = {
  id: string;
  fromUserId: string;
  toUserId?: string; // Optional for 1:1
  groupId?: string; // Optional for Group Chats
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  timestamp: number;
  sharedVideoId?: string;
  read?: boolean; // unread indicator for DM sidebar counter
  seenBy?: string[]; // Array of user IDs who have seen the message
};

export type GroupChat = {
  id: string;
  name: string;
  ownerId: string; // The person who created the group
  admins: string[]; // List of user IDs with admin privileges
  members: string[]; // Array of user IDs
  avatarUrl?: string;
  createdAt: number;
  lastMessage?: Message;
  voiceChannel?: {
    active: boolean;
    participants: string[];
  };
};

export type UserStatus = {
  id: string; // Map to userId
  userId: string;
  isTyping: boolean;
  typingIn?: string; // userId or groupId
  lastActive: number;
};

export type AppNotification = {
  id: string;
  userId: string; // The user receiving the notification
  type: 'like' | 'mention' | 'message' | 'follow' | 'forum_announcement' | 'tradient_reward' | 'support_resolved' | 'call' | 'verification_update' | 'moderation' | 'centralpro_update';
  fromUserId: string;
  videoId?: string;
  forumPostId?: string;
  callId?: string;
  title?: string;
  message?: string;
  read: boolean;
  timestamp: number;
  isImportant?: boolean;
  actionButton?: {
    text: string;
    action: string;
  };
};

export type CentralProRequest = {
  id: string;
  userId: string;
  username: string;
  handle: string;
  userAvatar?: string;
  plan: 'monthly' | 'forever';
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
  reviewedBy?: string;
  reviewedAt?: number;
};

export type Call = {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'offering' | 'answered' | 'declined' | 'ended' | 'active';
  createdAt: number;
  updatedAt: number;
  offer?: any;
  answer?: any;
  callerCandidates?: any[];
  receiverCandidates?: any[];
};

export type GameData = {
  id: string;
  userId: string;
  gameId: string;
  data: string;
  updatedAt: number;
};

export type WatchParty = {
  id: string;
  hostId: string;
  groupId?: string; // Optional: link to a group chat
  currentVideoId: string;
  participants: string[];
  status: 'playing' | 'paused';
  createdAt: number;
  updatedAt: number;
};

export type Announcement = {
  id: string;
  text: string;
  type: 'global' | 'page' | 'game';
  targetPage?: string;
  targetGameIds?: string[];
  color: string;
  size: 'sm' | 'md' | 'lg';
  createdAt: number;
  expiresAt?: number;
  active: boolean;
  hideDuringGameplay?: boolean;
  displayDuration?: number; // in seconds, 0 for permanent
  allowDismiss?: boolean;
  isPoll?: boolean;
  pollOptions?: string[];
  pollVotes?: Record<string, number>; // User ID -> Option Index
  scheduledAt?: number;
  actionButtonText?: string;
  actionButtonLink?: string;
};

export type VerificationRequest = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  schoolIdUrl: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  votes: Record<string, 'approve' | 'reject'>; // Admin ID -> Vote
  createdAt: number;
};

export type AppSuggestion = {
  id: string;
  userId: string;
  name: string;
  type: 'game' | 'app';
  description: string;
  status: 'pending' | 'reviewed' | 'implemented';
  createdAt: number;
};
