import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { 
  getUsers, getUserByHandle, addMessage, addNotifications, markMessagesSeen,
  getGroupChatById, deleteMessage, updateTypingStatus, 
  createWatchParty, subscribeToWatchPartiesByGroup,
  joinWatchParty, removeGroupMember, toggleGroupAdmin, addGroupMember,
  toggleMessageReaction, subscribeToGroupChat, joinVoiceChannel, leaveVoiceChannel,
  toggleVoiceChannelMute, subscribeToGroupVoiceSignals, sendGroupVoiceOffer,
  sendGroupVoiceAnswer, addGroupVoiceCandidate, cleanupGroupVoiceSignals,
  getReportById, subscribeToReport, subscribeToChannelMessages, subscribeToDirectMessages,
  subscribeToUserStatus, subscribeToTypingIn,
  updateReportIntercom, subscribeToAppSettings, GlobalAppSettings, isFirebasePartShutDown, FIREBASE_OUTAGE_MESSAGE
} from '../lib/db';
import { Message, User, GroupChat, UserStatus, WatchParty, Report } from '../types';
import { 
  ArrowLeft, Send, Phone, PhoneOff, Paperclip, Camera, X, Loader2, 
  Mic, MicOff, Volume2, VolumeX, Square, Trash2, CheckCheck, Users, Info, Tv,
  ShieldCheck, UserPlus, UserMinus, Shield, Reply, SmilePlus, ShieldAlert, Lock, Unlock, Image as ImageIcon
} from 'lucide-react';
import { HolographicBadge } from '../components/UIPolish';
import { CameraDeviceSelector } from '../components/CameraDeviceSelector';
import { compressImage } from '../lib/imageUtils';

const QUICK_REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '😢'];
const VOICE_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {}
  }
  return '';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read media'));
    reader.readAsDataURL(blob);
  });
}

export function Chat() {
  const { handle, groupId, reportId } = useParams<{ handle?: string, groupId?: string, reportId?: string }>();
  const { currentUser, setIsCalling, setCallData, selectedCameraId, setShowAuthModal } = useAppStore();
  const navigate = useNavigate();
  
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [intercomReport, setIntercomReport] = useState<Report | null>(null);
  const [showIntercomMedia, setShowIntercomMedia] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFilter, setCameraFilter] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [chatErrorToast, setChatErrorToast] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<GlobalAppSettings | null>(null);
  const [localOutageMessages, setLocalOutageMessages] = useState<Array<{ id: string; timestamp: number }>>([]);
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [activeGroupParties, setActiveGroupParties] = useState<WatchParty[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // #1 Reactions & Reply state
  const [replyingTo, setReplyingTo] = useState<Message['replyTo'] | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // #6 Group Voice Room state
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<string[]>([]);
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<Record<string, MediaStream>>({});

  useEffect(() => {
    const unsub = subscribeToAppSettings(setAppSettings);
    return () => unsub();
  }, []);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const markedSeenIdsRef = useRef<Set<string>>(new Set());
  const isLoadingChatRef = useRef(false);
  const lastTypingSentAtRef = useRef<number>(0);
  const isTypingActiveRef = useRef(false);
  const localVoiceStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const appliedSignalsRef = useRef<Map<string, string>>(new Map());
  const appliedCandidatesRef = useRef<Set<string>>(new Set());
  const inVoiceRoomRef = useRef(false);

  const showNotice = (msg: string) => {
    setChatErrorToast(msg);
    setTimeout(() => setChatErrorToast(prev => prev === msg ? null : prev), 4000);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, localOutageMessages.length]);

  const mergeAndSetMessages = (chatMsgs: Message[], targetOtherId?: string) => {
    const sorted = [...chatMsgs].sort((a, b) => a.timestamp - b.timestamp);
    setMessages(prev => {
      const remoteIds = new Set(sorted.map(m => m.id));
      const recentLocal = prev.filter(m => !remoteIds.has(m.id) && Date.now() - m.timestamp < 120_000);
      const combined = recentLocal.length > 0
        ? [...sorted, ...recentLocal].sort((a, b) => a.timestamp - b.timestamp)
        : sorted;

      if (
        prev.length === combined.length &&
        prev.every((m, idx) =>
          m.id === combined[idx].id &&
          (m.seenBy?.length || 0) === (combined[idx].seenBy?.length || 0) &&
          JSON.stringify(m.reactions || {}) === JSON.stringify(combined[idx].reactions || {})
        )
      ) {
        return prev;
      }
      return combined;
    });

    if (currentUser) {
      const unreadIds: string[] = [];
      for (const m of sorted) {
        const isCurrentChat = reportId
          ? m.groupId === `intercom_${reportId}`
          : groupId
          ? m.groupId === groupId
          : (targetOtherId ? m.fromUserId === targetOtherId && m.toUserId === currentUser.id : true);
        if (
          isCurrentChat &&
          m.fromUserId !== currentUser.id &&
          !(m.seenBy || []).includes(currentUser.id) &&
          !markedSeenIdsRef.current.has(m.id)
        ) {
          unreadIds.push(m.id);
          markedSeenIdsRef.current.add(m.id);
        }
      }
      if (unreadIds.length > 0) {
        void markMessagesSeen(unreadIds, currentUser.id);
      }
    }
  };

  // Initial room metadata load (uses cached users + single-doc fetches, no polling loop)
  useEffect(() => {
    let cancelled = false;
    const initRoom = async () => {
      if (isLoadingChatRef.current) return;
      isLoadingChatRef.current = true;
      try {
        const users = await getUsers();
        if (cancelled) return;
        setAllUsers(prev => (prev.length === users.length ? prev : users));

        if (reportId) {
          const rep = await getReportById(reportId);
          if (cancelled) return;
          if (!rep) {
            navigate('/messages');
            return;
          }
          setIntercomReport(rep);
          setGroup(null);
          setOtherUser(null);
        } else if (groupId) {
          const g = await getGroupChatById(groupId);
          if (cancelled) return;
          if (!g) {
            navigate('/messages');
            return;
          }
          setGroup(g);
          setOtherUser(null);
          setIntercomReport(null);
        } else if (handle) {
          const user = users.find(u => u.handle === handle) || await getUserByHandle(handle);
          if (cancelled) return;
          if (!user) {
            navigate('/messages');
            return;
          }
          setOtherUser(user);
          setGroup(null);
          setIntercomReport(null);
        }
      } finally {
        isLoadingChatRef.current = false;
      }
    };
    initRoom();
    return () => {
      cancelled = true;
    };
  }, [handle, groupId, reportId, navigate]);

  // Real-time scoped message subscription for DMs and Group Chats
  useEffect(() => {
    if (reportId) return;
    if (groupId) {
      return subscribeToChannelMessages(groupId, (chanMsgs) => {
        mergeAndSetMessages(chanMsgs);
      });
    }
    if (otherUser?.id) {
      return subscribeToDirectMessages(currentUser?.id || '', otherUser.id, (dmMsgs) => {
        mergeAndSetMessages(dmMsgs, otherUser.id);
      });
    }
  }, [reportId, groupId, otherUser?.id, currentUser?.id]);

  // Scoped real-time typing status (single doc for DM, filtered query for group/intercom)
  useEffect(() => {
    if (!currentUser) {
      setTypingUsers([]);
      return;
    }
    if (otherUser?.id && !groupId && !reportId) {
      return subscribeToUserStatus(otherUser.id, (status) => {
        if (
          status &&
          status.isTyping &&
          (status.typingIn === currentUser.id || status.typingIn === otherUser.id) &&
          Date.now() - status.lastActive < 5000
        ) {
          setTypingUsers([otherUser.username || 'Someone']);
        } else {
          setTypingUsers([]);
        }
      });
    }
    const channelKey = reportId ? `intercom_${reportId}` : groupId;
    if (!channelKey) return;
    return subscribeToTypingIn(channelKey, (statuses) => {
      const activeTyping = statuses
        .filter(s => s.userId !== currentUser.id && s.isTyping && Date.now() - s.lastActive < 5000)
        .map(s => allUsers.find(u => u.id === s.userId)?.username || 'Someone');
      setTypingUsers(prev => (prev.join('|') === activeTyping.join('|') ? prev : activeTyping));
    });
  }, [reportId, groupId, otherUser?.id, otherUser?.username, currentUser?.id, allUsers]);

  // Real-time subscription for Intercom DM channel & report status (open/closed/muted)
  useEffect(() => {
    if (!reportId) return;
    const unsubReport = subscribeToReport(reportId, (rep) => {
      if (rep) setIntercomReport(rep);
    });
    const unsubMsgs = subscribeToChannelMessages(`intercom_${reportId}`, (chanMsgs) => {
      mergeAndSetMessages(chanMsgs);
    });
    return () => {
      unsubReport();
      unsubMsgs();
    };
  }, [reportId, currentUser?.id]);

  useEffect(() => {
    if (!groupId) {
      setActiveGroupParties([]);
      return;
    }
    const unsubParties = subscribeToWatchPartiesByGroup(groupId, (parties) => {
      setActiveGroupParties(parties);
    });
    const unsubGroup = subscribeToGroupChat(groupId, (updatedGroup) => {
      if (updatedGroup) setGroup(updatedGroup);
    });
    return () => {
      unsubParties();
      unsubGroup();
    };
  }, [groupId]);

  const handleLeaveVoiceRoom = async () => {
    inVoiceRoomRef.current = false;
    setInVoiceRoom(false);
    setIsMicMuted(false);
    setIsDeafened(false);
    setSpeakingUsers([]);
    setRemoteAudioStreams({});
    peerConnectionsRef.current.forEach(pc => {
      try { pc.close(); } catch {}
    });
    peerConnectionsRef.current.clear();
    appliedSignalsRef.current.clear();
    appliedCandidatesRef.current.clear();
    if (localVoiceStreamRef.current) {
      localVoiceStreamRef.current.getTracks().forEach(t => t.stop());
      localVoiceStreamRef.current = null;
    }
    if (groupId && currentUser) {
      await leaveVoiceChannel(groupId, currentUser.id);
      await cleanupGroupVoiceSignals(groupId, currentUser.id);
    }
  };

  const handleJoinVoiceRoom = async () => {
    if (!group || !currentUser) {
      if (!currentUser) setShowAuthModal(true);
      return;
    }
    if (isFirebasePartShutDown(appSettings, 'voice_video_calls')) {
      showNotice(FIREBASE_OUTAGE_MESSAGE);
      return;
    }
    if (inVoiceRoomRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localVoiceStreamRef.current = stream;
      inVoiceRoomRef.current = true;
      setInVoiceRoom(true);
      setIsMicMuted(false);
      await joinVoiceChannel(group.id, currentUser.id);
    } catch {
      alert('Microphone permission is required to join the Voice Room.');
    }
  };

  const handleToggleVoiceMic = async () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (localVoiceStreamRef.current) {
      localVoiceStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !nextMuted;
      });
    }
    if (groupId && currentUser) {
      await toggleVoiceChannelMute(groupId, currentUser.id, nextMuted);
    }
  };

  // Cleanup voice room on unmount or switching chats
  useEffect(() => {
    return () => {
      if (inVoiceRoomRef.current && groupId && currentUser) {
        inVoiceRoomRef.current = false;
        peerConnectionsRef.current.forEach(pc => { try { pc.close(); } catch {} });
        peerConnectionsRef.current.clear();
        if (localVoiceStreamRef.current) {
          localVoiceStreamRef.current.getTracks().forEach(t => t.stop());
          localVoiceStreamRef.current = null;
        }
        leaveVoiceChannel(groupId, currentUser.id);
        cleanupGroupVoiceSignals(groupId, currentUser.id);
      }
    };
  }, [groupId, currentUser?.id]);

  // Local microphone speaking ring detection
  useEffect(() => {
    if (!inVoiceRoom || !localVoiceStreamRef.current || !currentUser) return;
    let ctx: AudioContext | null = null;
    let rafId = 0;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(localVoiceStreamRef.current);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const checkLevel = () => {
        rafId = requestAnimationFrame(checkLevel);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const speaking = avg > 16 && !isMicMuted;
        setSpeakingUsers(prev => {
          const has = prev.includes(currentUser.id);
          if (speaking && !has) return [...prev, currentUser.id];
          if (!speaking && has) return prev.filter(id => id !== currentUser.id);
          return prev;
        });
      };
      checkLevel();
    } catch {}
    return () => {
      cancelAnimationFrame(rafId);
      if (ctx) { try { ctx.close(); } catch {} }
    };
  }, [inVoiceRoom, isMicMuted, currentUser?.id]);

  // Multi-person WebRTC mesh connections for active Voice Room participants
  useEffect(() => {
    if (!inVoiceRoom || !groupId || !currentUser || !localVoiceStreamRef.current) return;
    const myId = currentUser.id;
    const participants = (group?.voiceChannel?.participants || []).filter(id => id !== myId);

    const getOrCreatePeer = (peerId: string) => {
      let pc = peerConnectionsRef.current.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection(VOICE_ICE_SERVERS);
      localVoiceStreamRef.current?.getTracks().forEach(track => {
        pc!.addTrack(track, localVoiceStreamRef.current!);
      });
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          setRemoteAudioStreams(prev => ({ ...prev, [peerId]: remoteStream }));
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const isOfferer = myId < peerId;
          const offererId = isOfferer ? myId : peerId;
          const answererId = isOfferer ? peerId : myId;
          addGroupVoiceCandidate(groupId, offererId, answererId, isOfferer ? 'caller' : 'receiver', event.candidate.toJSON());
        }
      };
      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    };

    // Initiate offers to peers where myId < peerId
    participants.forEach(async (peerId) => {
      const pc = getOrCreatePeer(peerId);
      if (myId < peerId && pc.signalingState === 'stable' && !appliedSignalsRef.current.get(`offer_${peerId}`)) {
        appliedSignalsRef.current.set(`offer_${peerId}`, 'sent');
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendGroupVoiceOffer(groupId, myId, peerId, { type: offer.type, sdp: offer.sdp });
        } catch {}
      }
    });

    // Close peers who left
    (Array.from(peerConnectionsRef.current.keys()) as string[]).forEach((peerId: string) => {
      if (!participants.includes(peerId)) {
        try { peerConnectionsRef.current.get(peerId)?.close(); } catch {}
        peerConnectionsRef.current.delete(peerId);
        setRemoteAudioStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    });

    const unsubSignals = subscribeToGroupVoiceSignals(groupId, myId, async (signals) => {
      for (const sig of signals) {
        const peerId = sig.offererId === myId ? sig.answererId : sig.offererId;
        if (!peerId || peerId === myId) continue;
        const pc = getOrCreatePeer(peerId);

        if (sig.answererId === myId && sig.offer && !appliedSignalsRef.current.get(`remote_offer_${sig.id}`)) {
          appliedSignalsRef.current.set(`remote_offer_${sig.id}`, sig.offer.sdp || '1');
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendGroupVoiceAnswer(groupId, sig.offererId, myId, { type: answer.type, sdp: answer.sdp });
          } catch {}
        }

        if (sig.offererId === myId && sig.answer && !appliedSignalsRef.current.get(`remote_answer_${sig.id}`)) {
          appliedSignalsRef.current.set(`remote_answer_${sig.id}`, sig.answer.sdp || '1');
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.answer));
            }
          } catch {}
        }

        const incomingCandidates = sig.offererId === myId ? (sig.receiverCandidates || []) : (sig.callerCandidates || []);
        for (const cand of incomingCandidates) {
          const key = `${sig.id}_${JSON.stringify(cand)}`;
          if (!appliedCandidatesRef.current.has(key) && pc.remoteDescription) {
            appliedCandidatesRef.current.add(key);
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
          }
        }
      }
    });

    return () => unsubSignals();
  }, [inVoiceRoom, groupId, currentUser?.id, JSON.stringify(group?.voiceChannel?.participants || [])]);

  const handleStartParty = async () => {
    if (!groupId || !currentUser) return;
    const { getVideos } = await import('../lib/db');
    const videos = await getVideos();
    const latestVideo = videos[0];
    if (!latestVideo) return;

    const partyId = await createWatchParty(currentUser.id, latestVideo.id, groupId);
    if (partyId) {
      await sendMessage(`🎉 I've started a Watch Party! Click the button above to join.`, undefined, undefined, undefined, true);
      navigate(`/?partyId=${partyId}`);
    }
  };

  // Screenshot Detection (Simulation / Proxy)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Common screenshot keys (best effort)
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
        notifyScreenshot();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Many apps assume focus loss/hidden state as a potential screenshot point
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const notifyScreenshot = async () => {
    if (!currentUser || (!otherUser && !group)) return;
    const content = `${currentUser.username} has screenshotted the chat.`;
    await sendMessage(content, undefined, undefined, undefined, true);
  };

  const isStaffUser = currentUser?.role === 'staff' || currentUser?.role === 'owner';
  const isIntercomClosed = Boolean(intercomReport && intercomReport.intercomStatus === 'closed');
  const isIntercomMutedBlocked = Boolean(intercomReport && intercomReport.intercomMuted && !isStaffUser);

  const sendMessage = async (content: string, imageUrl?: string, videoUrl?: string, audioUrl?: string, isSystem = false) => {
    if ((!content.trim() && !imageUrl && !videoUrl && !audioUrl) || !currentUser) return;
    if (!otherUser && !group && !intercomReport) return;

    // Selective Firebase Shutdown for Chat: show red outage message ONLY to the sender locally without sending to Firestore/recipient
    if (!isSystem && isFirebasePartShutDown(appSettings, 'chat')) {
      setLocalOutageMessages(prev => [
        ...prev,
        { id: `outage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() }
      ]);
      setNewMessage('');
      setReplyingTo(null);
      updateTyping(false);
      return;
    }

    if (!isSystem && intercomReport) {
      if (intercomReport.intercomStatus === 'closed') {
        showNotice('This Intercom DM is closed.');
        return;
      }
      if (intercomReport.intercomMuted && !isStaffUser) {
        showNotice('You have been muted in this Intercom DM by staff.');
        return;
      }
    }
    
    const msg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fromUserId: isSystem ? 'system' : currentUser.id,
      toUserId: otherUser?.id,
      groupId: intercomReport ? `intercom_${intercomReport.id}` : group?.id,
      content: content.trim(),
      imageUrl,
      videoUrl,
      audioUrl,
      timestamp: Date.now(),
      seenBy: [currentUser.id],
      ...(replyingTo && !isSystem ? { replyTo: replyingTo } : {})
    };
    
    setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    setNewMessage('');
    setReplyingTo(null);
    updateTyping(false);

    await addMessage(msg);
    
    if (!isSystem) {
      if (intercomReport) {
        const targetId = isStaffUser ? intercomReport.reporterId : intercomReport.intercomStaffId;
        if (targetId && targetId !== currentUser.id && targetId !== 'anonymous') {
          await addNotifications([{
            id: `notif_ic_${Date.now()}_${targetId}`,
            userId: targetId,
            type: 'intercom',
            fromUserId: currentUser.id,
            reportId: intercomReport.id,
            title: 'Staff Intercom Message',
            message: content.trim() || 'Sent a media attachment in Intercom.',
            read: false,
            timestamp: Date.now()
          }]);
        }
      } else {
        const targetUserIds = group ? (group.members || []).filter(id => id !== currentUser.id) : [otherUser!.id];
        
        const newNotifs = targetUserIds.map(id => ({
          id: `notif_${Date.now()}_${id}`,
          userId: id,
          type: 'message' as const,
          fromUserId: currentUser.id,
          read: false,
          timestamp: Date.now()
        }));
        
        await addNotifications(newNotifs);
      }
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (isFirebasePartShutDown(appSettings, 'chat')) {
      showNotice(FIREBASE_OUTAGE_MESSAGE);
      setOpenReactionPickerId(null);
      return;
    }
    setOpenReactionPickerId(null);
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const current = { ...(m.reactions || {}) };
      const list = [...(current[emoji] || [])];
      if (list.includes(currentUser.id)) {
        const filtered = list.filter(id => id !== currentUser.id);
        if (filtered.length === 0) delete current[emoji];
        else current[emoji] = filtered;
      } else {
        current[emoji] = [...list, currentUser.id];
      }
      return { ...m, reactions: current };
    }));
    await toggleMessageReaction(messageId, emoji, currentUser.id);
  };

  const scrollToMessage = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => setHighlightedMsgId(null), 1600);
    }
  };

  const updateTyping = (isTyping: boolean) => {
    if (!currentUser) return;
    const typingIn = intercomReport ? `intercom_${intercomReport.id}` : (groupId || otherUser?.id);
    const now = Date.now();
    if (isTyping) {
      if (isTypingActiveRef.current && now - lastTypingSentAtRef.current < 3000) {
        return;
      }
      isTypingActiveRef.current = true;
      lastTypingSentAtRef.current = now;
      updateTypingStatus(currentUser.id, true, typingIn);
    } else if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      lastTypingSentAtRef.current = 0;
      updateTypingStatus(currentUser.id, false, typingIn);
    }
  };

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    updateTyping(true);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateTyping(false);
    }, 3000);
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm("Delete this message?")) return;
    await deleteMessage(msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    await sendMessage(newMessage);
  };

  // Compress images reliably under Firestore's 1MB limit & avoid broken uploads/disappearing photos
  const prepareMediaPayload = async (file: Blob | File, forcedKind?: 'image' | 'video' | 'audio'): Promise<{ url: string; type: 'image' | 'video' | 'audio' }> => {
    const mime = file.type || '';
    const kind: 'image' | 'video' | 'audio' = forcedKind || (mime.startsWith('video') ? 'video' : mime.startsWith('audio') ? 'audio' : 'image');

    let rawDataUrl = await blobToDataUrl(file);
    if (kind === 'image') {
      rawDataUrl = await compressImage(rawDataUrl, 900, 900, 0.65);
      if (rawDataUrl.length > 650_000) {
        rawDataUrl = await compressImage(rawDataUrl, 640, 640, 0.45);
      }
      return { url: rawDataUrl, type: 'image' };
    }

    // Try Cloudinary only for video clips that are too big for direct Firestore doc storage
    if (kind === 'video' && rawDataUrl.length > 700_000) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'centraltok');
        const res = await fetch('https://api.cloudinary.com/v1_1/dzpocbcl/auto/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data?.secure_url) return { url: data.secure_url, type: 'video' };
        }
      } catch {}
    }

    return { url: rawDataUrl, type: kind };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { url, type } = await prepareMediaPayload(file);
      if (!url) {
        showNotice('Could not read selected file.');
        return;
      }
      if (type === 'video' && url.startsWith('data:') && url.length > 900_000) {
        showNotice('Video clip is too large for chat. Please choose a shorter video.');
        return;
      }
      await sendMessage('', type === 'image' ? url : undefined, type === 'video' ? url : undefined);
    } catch {
      showNotice('Failed to send attachment. Try a smaller file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startAudioRecording = async () => {
    if (isRecordingAudio) return;
    try {
      if (typeof MediaRecorder === 'undefined') {
        showNotice('Voice recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenMime = getSupportedAudioMimeType();
      const options: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
      if (chosenMime) options.mimeType = chosenMime;

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
        setIsRecordingAudio(false);
        setRecordingSeconds(0);

        if (recordingCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const actualType = mediaRecorder.mimeType || chosenMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
        audioChunksRef.current = [];

        if (audioBlob.size < 100) {
          showNotice('Voice message was too short. Hold/speak a bit longer and try again.');
          return;
        }

        setIsUploading(true);
        try {
          const { url } = await prepareMediaPayload(audioBlob, 'audio');
          if (!url || !url.startsWith('data:audio')) {
            const fixedUrl = url.replace(/^data:[^;]*/, `data:${actualType.split(';')[0]}`);
            await sendMessage('', undefined, undefined, fixedUrl);
          } else {
            await sendMessage('', undefined, undefined, url);
          }
        } catch {
          showNotice('Failed to send voice message.');
        } finally {
          setIsUploading(false);
        }
      };

      setAudioStream(stream);
      setRecordingSeconds(0);
      setIsRecordingAudio(true);
      mediaRecorder.start(250);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch {
      showNotice('Microphone access denied. Enable mic permission in browser settings.');
    }
  };

  const stopAudioRecording = (cancel = false) => {
    recordingCancelledRef.current = cancel;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData?.();
      } catch {}
      mediaRecorderRef.current.stop();
    } else {
      setIsRecordingAudio(false);
      setAudioStream(null);
      setRecordingSeconds(0);
    }
  };

  useEffect(() => {
    if (showCamera && videoRef.current) {
      const videoConstraints = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true;
      navigator.mediaDevices.getUserMedia({ video: videoConstraints })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            (videoRef.current as any)._streamId = stream.id;
          }
        })
        .catch(err => {
          console.error("Camera error:", err);
          showNotice("Could not access camera.");
          setShowCamera(false);
        });
    }
    
    return () => {
      if (!showCamera && videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
        (videoRef.current as any)._streamId = null;
      }
    };
  }, [showCamera, selectedCameraId]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      (videoRef.current as any)._streamId = null;
    }
    setShowCamera(false);
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    const rawW = videoEl.videoWidth || 640;
    const rawH = videoEl.videoHeight || 480;
    const scale = Math.min(1, 900 / Math.max(rawW, rawH));
    canvas.width = Math.max(1, Math.round(rawW * scale));
    canvas.height = Math.max(1, Math.round(rawH * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.filter = getComputedStyle(videoEl).filter;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const stream = videoEl.srcObject as MediaStream | null;
    const snapshotUrl = canvas.toDataURL('image/jpeg', 0.68);
    stream?.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
    setShowCamera(false);

    setIsUploading(true);
    try {
      const compressed = await compressImage(snapshotUrl, 850, 850, 0.62);
      await sendMessage('', compressed);
    } catch {
      showNotice("Failed to send photo.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!otherUser && !group && !intercomReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
        <Loader2 className="animate-spin text-pink-600 mb-2" size={32} />
        <p className="text-sm font-semibold">Loading conversation...</p>
      </div>
    );
  }

  const intercomReporter = intercomReport ? allUsers.find(u => u.id === intercomReport.reporterId) : null;

  return (
    <div className="w-full max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800 h-full min-h-0 flex-1 flex flex-col bg-white dark:bg-zinc-950 relative overflow-hidden pb-16 md:pb-0">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(isStaffUser && intercomReport ? '/admin' : '/messages')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors shrink-0">
            <ArrowLeft size={24} />
          </button>
          {intercomReport ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow">
                <ShieldAlert size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold leading-tight truncate">Staff Intercom DM</h2>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    isIntercomClosed ? 'bg-red-500/20 text-red-500' : intercomReport.intercomMuted ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    {isIntercomClosed ? 'Closed' : intercomReport.intercomMuted ? 'Muted' : 'Open'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  {intercomReporter ? `@${intercomReporter.handle}` : 'Reporter'} • {intercomReport.reason}
                </p>
              </div>
            </div>
          ) : group ? (
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowGroupInfo(true)}>
              <div className="relative">
                <img src={group.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-pink-600 flex items-center justify-center text-white border-2 border-white dark:border-zinc-950">
                  <Users size={10} />
                </div>
              </div>
              <div>
                <h2 className="font-bold leading-tight">{group.name}</h2>
                <p className="text-xs text-zinc-500">{(group.members || []).length} members</p>
              </div>
            </div>
          ) : (
            <Link to={`/profile/${otherUser!.handle}`} className="flex items-center gap-3">
              <img src={otherUser!.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div>
                <h2 className="font-bold leading-tight flex items-center gap-1">
                  {otherUser!.username}
                  {otherUser!.isVerified && <HolographicBadge />}
                </h2>
                <p className="text-xs text-zinc-500">@{otherUser!.handle}</p>
              </div>
            </Link>
          )}
        </div>
        {intercomReport ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {intercomReport.mediaUrl && (
              <button
                type="button"
                onClick={() => setShowIntercomMedia(v => !v)}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-xs font-bold flex items-center gap-1"
                title="View Attached Proof"
              >
                <ImageIcon size={14} />
                <span className="hidden sm:inline">Media</span>
              </button>
            )}
            {isStaffUser && currentUser && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    const nextStatus = isIntercomClosed ? 'open' : 'closed';
                    const updated = await updateReportIntercom(
                      intercomReport,
                      currentUser,
                      { intercomStatus: nextStatus },
                      nextStatus === 'closed'
                        ? `Intercom DM closed by staff (@${currentUser.handle}).`
                        : `Intercom DM reopened by staff (@${currentUser.handle}).`
                    );
                    setIntercomReport(updated);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
                    isIntercomClosed ? 'bg-emerald-600 text-white' : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {isIntercomClosed ? <Unlock size={14} /> : <Lock size={14} />}
                  <span className="hidden sm:inline">{isIntercomClosed ? 'Reopen' : 'Close'}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const nextMuted = !intercomReport.intercomMuted;
                    const updated = await updateReportIntercom(
                      intercomReport,
                      currentUser,
                      { intercomMuted: nextMuted },
                      nextMuted
                        ? `Reporter muted in Intercom DM by staff (@${currentUser.handle}).`
                        : `Reporter unmuted in Intercom DM by staff (@${currentUser.handle}).`
                    );
                    setIntercomReport(updated);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
                    intercomReport.intercomMuted ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {intercomReport.intercomMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span className="hidden sm:inline">{intercomReport.intercomMuted ? 'Unmute' : 'Mute'}</span>
                </button>
              </>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-1">
          {group && (
            <button onClick={() => setShowGroupInfo(true)} className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full">
              <Info size={22} />
            </button>
          )}
          <button 
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            onClick={handleStartParty}
            title="Start Watch Party"
          >
            <Tv size={22} />
          </button>
          <button 
            className={`p-2 rounded-full transition-colors ${
              inVoiceRoom
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
            title={group ? (inVoiceRoom ? 'In Voice Room' : 'Join Group Voice Room') : 'Voice Call'}
            onClick={() => {
              if (isFirebasePartShutDown(appSettings, 'voice_video_calls')) {
                showNotice(FIREBASE_OUTAGE_MESSAGE);
                return;
              }
              if (group) {
                if (inVoiceRoom) handleLeaveVoiceRoom();
                else handleJoinVoiceRoom();
              } else if (otherUser) {
                setCallData({ user: otherUser, type: 'voice' });
                setIsCalling(true);
              }
            }}
          >
            {inVoiceRoom ? <PhoneOff size={20} /> : <Phone size={22} />}
          </button>
        </div>
        )}
      </div>

      {/* Collapsible Attached Issue Media Banner inside Intercom */}
      {intercomReport && showIntercomMedia && intercomReport.mediaUrl && (
        <div className="shrink-0 bg-zinc-950 border-b border-zinc-800 p-3 flex flex-col items-center gap-2">
          <div className="w-full flex items-center justify-between text-xs text-zinc-400">
            <span className="font-bold uppercase tracking-wider">Attached Issue Media</span>
            <button type="button" onClick={() => setShowIntercomMedia(false)} className="p-1 hover:text-white"><X size={16} /></button>
          </div>
          {intercomReport.mediaType === 'video' ? (
            <video src={intercomReport.mediaUrl} controls playsInline className="max-h-56 rounded-xl bg-black" />
          ) : (
            <img src={intercomReport.mediaUrl} alt="Report proof" className="max-h-56 rounded-xl object-contain" />
          )}
        </div>
      )}

      {/* Collapsible Group Voice Room Panel (#6) */}
      {group && inVoiceRoom && (
        <div className="shrink-0 bg-gradient-to-r from-emerald-950 via-zinc-900 to-teal-950 text-white px-4 py-3 border-b border-emerald-500/30 z-10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Voice Room Connected</p>
                <p className="text-[10px] text-zinc-400">
                  {(group.voiceChannel?.participants || []).length} in room
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleVoiceMic}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isMicMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMicMuted ? <MicOff size={15} /> : <Mic size={15} />}
                <span className="hidden sm:inline">{isMicMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDeafened(!isDeafened)}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDeafened ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
              >
                {isDeafened ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span className="hidden sm:inline">{isDeafened ? 'Deafened' : 'Audio On'}</span>
              </button>

              <button
                type="button"
                onClick={handleLeaveVoiceRoom}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PhoneOff size={14} />
                <span>Leave</span>
              </button>
            </div>
          </div>

          {/* Participant Avatars with Live Speaking Green Rings */}
          <div className="flex items-center gap-3 mt-3 overflow-x-auto pb-1">
            {(group.voiceChannel?.participants || []).map(pid => {
              const u = allUsers.find(x => x.id === pid) || (currentUser?.id === pid ? currentUser : null);
              const isSpeaking = speakingUsers.includes(pid);
              const isPeerMuted = (group.voiceChannel?.mutedUsers || []).includes(pid) || (pid === currentUser?.id && isMicMuted);
              return (
                <div key={pid} className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`relative w-10 h-10 rounded-full p-0.5 transition-all ${
                    isSpeaking
                      ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.75)] scale-105'
                      : 'ring-1 ring-white/20'
                  }`}>
                    <img src={u?.avatarUrl || ''} alt={u?.username || ''} className="w-full h-full rounded-full object-cover bg-zinc-800" />
                    {isPeerMuted && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-600 border border-zinc-900 flex items-center justify-center">
                        <MicOff size={9} className="text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-300 max-w-[60px] truncate">
                    {pid === currentUser?.id ? 'You' : (u?.username || 'Member')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Remote Peer Audio Elements */}
          {(Object.entries(remoteAudioStreams) as [string, MediaStream][]).map(([peerId, stream]) => (
            <RemoteVoiceAudio
              key={peerId}
              peerId={peerId}
              stream={stream}
              deafened={isDeafened}
              onSpeakingChange={(id, speaking) => {
                setSpeakingUsers(prev => {
                  const has = prev.includes(id);
                  if (speaking && !has) return [...prev, id];
                  if (!speaking && has) return prev.filter(x => x !== id);
                  return prev;
                });
              }}
            />
          ))}
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Active Voice Room Banner when not yet joined */}
        {group && !inVoiceRoom && group.voiceChannel?.active && (group.voiceChannel.participants || []).length > 0 && (
          <div className="sticky top-0 z-20 mb-2 bg-gradient-to-r from-emerald-600 to-teal-600 p-3.5 rounded-2xl text-white shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                {(group.voiceChannel.participants || []).slice(0, 4).map(pid => {
                  const u = allUsers.find(x => x.id === pid);
                  return (
                    <img
                      key={pid}
                      src={u?.avatarUrl || ''}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500 bg-zinc-900"
                    />
                  );
                })}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-tight flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Voice Room Live
                </p>
                <p className="text-[10px] font-bold opacity-90 truncate">
                  {(group.voiceChannel.participants || []).length} speaking now
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleJoinVoiceRoom}
              className="px-4 py-2 bg-white text-emerald-700 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shrink-0 cursor-pointer"
            >
              Join Voice
            </button>
          </div>
        )}

        {/* Active Watch Party Banner */}
        {activeGroupParties.length > 0 && (
          <div className="sticky top-0 z-20 mb-4">
            {activeGroupParties.map(party => (
              <div key={party.id} className="bg-gradient-to-r from-pink-600 to-indigo-600 p-4 rounded-2xl text-white shadow-xl flex items-center justify-between animate-in slide-in-from-top-10 duration-500 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Tv size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">Active Watch Party</p>
                    <p className="text-[10px] font-bold opacity-80">{(party.participants || []).length} watching now</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate(`/?partyId=${party.id}`)}
                  className="px-6 py-2 bg-white text-pink-600 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 && localOutageMessages.length === 0 ? (
          <div className="text-center text-zinc-500 my-auto">
            {intercomReport
              ? `Intercom DM open regarding: "${intercomReport.reason}". Staff and the reporter can communicate directly here.`
              : group
              ? `Welcome to ${group.name}!`
              : `Say hi to ${otherUser!.username}!`}
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.fromUserId === currentUser?.id;
            const isSystem = m.fromUserId === 'system';
            const sender = allUsers.find(u => u.id === m.fromUserId);
            const showSeen = isMe && currentUser && m.seenBy && m.seenBy.filter(id => id !== currentUser.id).length > 0;
            const seenNames = m.seenBy?.filter(id => id !== currentUser?.id).map(id => allUsers.find(u => u.id === id)?.username).filter(Boolean).join(', ');
            const reactionEntries = (Object.entries(m.reactions || {}) as [string, string[]][]).filter(([, ids]) => Array.isArray(ids) && ids.length > 0);

            if (isSystem) {
              return (
                <div key={m.id} id={`msg-${m.id}`} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                id={`msg-${m.id}`}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} transition-all duration-300 ${
                  highlightedMsgId === m.id ? 'bg-pink-500/10 rounded-2xl p-1 -m-1 ring-1 ring-pink-500/40' : ''
                }`}
              >
                {group && !isMe && sender && (
                  <span className="text-[10px] font-bold text-zinc-500 ml-10 mb-1 flex items-center gap-1">
                    {sender.username}
                    {sender.isVerified && <HolographicBadge />}
                  </span>
                )}
                <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                    <img src={sender?.avatarUrl} alt="" className="w-8 h-8 rounded-full mb-1 object-cover shrink-0" />
                  )}
                  <div className="relative group flex flex-col">
                    <div className={`relative rounded-2xl px-4 py-3 ${isMe ? 'bg-pink-600 text-white rounded-br-sm' : 'bg-zinc-100 dark:bg-zinc-800 rounded-bl-sm shadow-sm'}`}>
                      {/* Quoted Reply Block (#1) */}
                      {m.replyTo && (
                        <button
                          type="button"
                          onClick={() => scrollToMessage(m.replyTo!.id)}
                          className={`w-full text-left mb-2 px-2.5 py-1.5 rounded-xl border-l-4 text-xs transition-opacity hover:opacity-90 cursor-pointer ${
                            isMe
                              ? 'bg-black/20 border-white/80 text-pink-50'
                              : 'bg-zinc-200/80 dark:bg-zinc-900/80 border-pink-500 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <p className="font-bold text-[10px] opacity-90">{m.replyTo.senderName}</p>
                          <p className="truncate text-[11px] opacity-80">
                            {m.replyTo.content || (m.replyTo.hasMedia ? '📎 Media attachment' : 'Message')}
                          </p>
                        </button>
                      )}

                      {m.imageUrl && (
                        <img src={m.imageUrl} loading="lazy" alt="attachment" className="w-full rounded-lg mb-2 object-cover max-h-64 bg-black/10" />
                      )}
                      {m.videoUrl && (
                        <video src={m.videoUrl} controls playsInline preload="metadata" className="w-full rounded-lg mb-2 max-h-64 object-cover" />
                      )}
                      {m.audioUrl && (
                        <div className="space-y-1.5 min-w-[220px]">
                          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-pink-100' : 'text-zinc-500'}`}>
                            <Mic size={10} />
                            <span>Voice Message</span>
                          </div>
                          <div className="bg-white/95 dark:bg-zinc-900 rounded-xl p-1 shadow-sm">
                            <audio src={m.audioUrl} controls preload="metadata" playsInline className="w-full h-9" />
                          </div>
                        </div>
                      )}
                      {m.content && <p className="mt-0.5 leading-relaxed">{m.content}</p>}
                      {m.sharedVideoId && (
                        <Link to="/" className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 text-xs font-semibold hover:bg-black/30 transition-colors">
                          <span>🎬 View shared video</span>
                        </Link>
                      )}
                    </div>

                    {/* Reaction Pills beneath message (#1) */}
                    {reactionEntries.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {reactionEntries.map(([emoji, ids]) => {
                          const iReacted = currentUser ? ids.includes(currentUser.id) : false;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(m.id, emoji)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                                iReacted
                                  ? 'bg-pink-500/15 border-pink-500 text-pink-600 dark:text-pink-400'
                                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px]">{ids.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Hover Actions: React, Reply, Delete (#1) */}
                    <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 ${
                      isMe ? '-left-20 flex-row-reverse' : '-right-20 flex-row'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setOpenReactionPickerId(openReactionPickerId === m.id ? null : m.id)}
                        className="p-1.5 text-zinc-400 hover:text-amber-500 bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                        title="React"
                      >
                        <SmilePlus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingTo({
                          id: m.id,
                          senderName: isMe ? 'You' : (sender?.username || 'User'),
                          content: m.content,
                          hasMedia: Boolean(m.imageUrl || m.videoUrl || m.audioUrl)
                        })}
                        className="p-1.5 text-zinc-400 hover:text-pink-500 bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                      {isMe && (
                        <button 
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-900 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Quick Reaction Picker Bar */}
                    {openReactionPickerId === m.id && (
                      <div className={`absolute -top-11 z-30 flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-1 shadow-xl ${
                        isMe ? 'right-0' : 'left-0'
                      }`}>
                        {QUICK_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-125 transition-transform text-base cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {showSeen && idx === messages.length - 1 && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-400 font-medium mr-1">
                    <CheckCheck size={12} className="text-pink-500" />
                    <span>Seen {group ? `by ${seenNames}` : ''}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-zinc-500 ml-10">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"></span>
            </div>
            <span className="text-[10px] font-medium">
              {typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : 'Several people are typing...'}
            </span>
          </div>
        )}

        {/* Sender-only red outage messages (never persisted or sent to recipients) */}
        {localOutageMessages.map((om) => (
          <div key={om.id} className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-3 bg-red-600/15 border border-red-500 text-red-600 dark:text-red-400 shadow-sm">
              <p className="text-sm font-bold leading-relaxed">{FIREBASE_OUTAGE_MESSAGE}</p>
              <span className="block text-[10px] text-red-500/80 mt-1 font-semibold">
                Not delivered • Only visible to you
              </span>
            </div>
          </div>
        ))}
        
        <div ref={bottomRef} />
      </div>
      
      {/* Input */}
      <div className="shrink-0 p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-20 w-full shadow-lg">
        {chatErrorToast && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500 text-xs font-bold flex items-center justify-between gap-2">
            <span>{chatErrorToast}</span>
            <button type="button" onClick={() => setChatErrorToast(null)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
          </div>
        )}
        {/* Reply Preview Banner (#1) */}
        {replyingTo && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border-l-4 border-pink-600 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-pink-600 flex items-center gap-1">
                <Reply size={12} /> Replying to {replyingTo.senderName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {replyingTo.content || (replyingTo.hasMedia ? '📎 Media attachment' : 'Message')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full cursor-pointer"
              title="Cancel reply"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!currentUser && (
          <div className="mb-2 p-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-600 dark:text-pink-400 text-xs font-bold flex items-center justify-between">
            <span>You're browsing as a guest. Log in to send messages!</span>
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-black transition-colors cursor-pointer"
            >
              Log in
            </button>
          </div>
        )}
        {intercomReport && isIntercomClosed ? (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold flex items-center justify-between gap-2">
            <span>This Intercom DM has been closed by staff.</span>
            {isStaffUser && currentUser && (
              <button
                type="button"
                onClick={async () => {
                  const updated = await updateReportIntercom(intercomReport, currentUser, { intercomStatus: 'open' }, `Intercom DM reopened by staff (@${currentUser.handle}).`);
                  setIntercomReport(updated);
                }}
                className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-black uppercase text-[10px]"
              >
                Reopen DM
              </button>
            )}
          </div>
        ) : intercomReport && isIntercomMutedBlocked ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold text-center">
            You are currently muted in this Intercom DM by staff.
          </div>
        ) : (
        <form onSubmit={handleSend} className="flex items-center gap-2 relative">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
          {!isRecordingAudio && (
            <>
              <button 
                type="button" 
                onClick={() => currentUser ? fileInputRef.current?.click() : setShowAuthModal(true)} 
                className="p-2.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                title="Attach file"
              >
                <Paperclip size={20} />
              </button>
              <button 
                type="button" 
                onClick={() => currentUser ? setShowCamera(true) : setShowAuthModal(true)} 
                className="p-2.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors mr-1"
                title="Take photo"
              >
                <Camera size={20} />
              </button>
            </>
          )}
          
          {isRecordingAudio ? (
            <>
              <button type="button" onClick={() => stopAudioRecording(true)} className="p-2.5 text-zinc-400 hover:text-red-500 transition-colors" title="Cancel recording">
                <Trash2 size={20} />
              </button>
              <button type="button" onClick={() => stopAudioRecording(false)} className="px-3 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-md" title="Send voice message">
                <Square size={12} className="fill-current" />
                <span>Send {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
              </button>
            </>
          ) : (
            <button 
              type="button" 
              onClick={() => currentUser ? startAudioRecording() : setShowAuthModal(true)} 
              className="p-2.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors mr-1" 
              title="Record audio"
            >
              <Mic size={20} />
            </button>
          )}

          {isRecordingAudio && audioStream ? (
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full px-4 py-2 flex items-center gap-3 overflow-hidden border border-pink-500/20">
              <div className="flex items-center gap-1.5 text-pink-500 animate-pulse shrink-0">
                <Mic size={16} /><span className="text-[10px] font-bold uppercase tracking-tighter">Rec</span>
              </div>
              <VoiceVisualizer stream={audioStream} />
            </div>
          ) : (
            <input 
              type="text" 
              value={newMessage}
              onFocus={() => { if (!currentUser) setShowAuthModal(true); }}
              onChange={e => handleInputChange(e.target.value)}
              placeholder={currentUser ? "Send a message..." : "Click here to log in and chat..."}
              className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-pink-500 transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 select-text cursor-text"
              disabled={isUploading}
            />
          )}
          <button 
            type="submit"
            onClick={(e) => {
              if (!currentUser) {
                e.preventDefault();
                setShowAuthModal(true);
              }
            }}
            disabled={isUploading || (Boolean(currentUser) && !newMessage.trim())}
            className="p-2.5 bg-pink-600 text-white rounded-full hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 shrink-0 cursor-pointer"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
          </button>
        </form>
        )}
      </div>

      {/* Group Info Drawer */}
      {showGroupInfo && group && (
        <div className="absolute inset-0 z-[60] bg-black/60 flex items-end">
          <div className="w-full bg-white dark:bg-zinc-950 rounded-t-[2rem] p-6 animate-in slide-in-from-bottom-full duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowGroupInfo(false)} className="p-2 text-zinc-500"><X size={24} /></button>
            </div>
            <div className="flex flex-col items-center mb-6">
              <img src={group.avatarUrl} alt="" className="w-24 h-24 rounded-full mb-3 object-cover shadow-xl ring-4 ring-white dark:ring-zinc-900" />
              <h3 className="text-xl font-bold">{group.name}</h3>
              <p className="text-sm text-zinc-500">Group · {(group.members || []).length} members</p>
            </div>
            
            <div className="space-y-1 mb-8">
              <div className="flex items-center justify-between mb-3 px-2">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Members</h4>
                {(group.ownerId === currentUser?.id || (currentUser?.id && (group.admins || []).includes(currentUser.id))) && (
                  <button 
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1 text-pink-600 text-[10px] font-black uppercase tracking-widest"
                  >
                    <UserPlus size={14} /> Add
                  </button>
                )}
              </div>
              
              {/* Members List */}
              {(group.members || []).map(mid => {
                const u = allUsers.find(x => x.id === mid);
                if (!u) return null;
                const isOwner = group.ownerId === mid;
                const isAdmin = group.admins?.includes(mid);
                const canManage = (group.ownerId === currentUser?.id || (currentUser?.id && (group.admins || []).includes(currentUser.id))) && mid !== currentUser?.id && !isOwner;

                return (
                  <div key={mid} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group/member">
                    <div className="flex items-center gap-3">
                      <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm">{u.username}</p>
                          {isOwner && <ShieldCheck size={12} className="text-pink-600" title="Owner" />}
                          {!isOwner && isAdmin && <Shield size={12} className="text-indigo-500" title="Admin" />}
                        </div>
                        <p className="text-xs text-zinc-500">@{u.handle}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {mid === currentUser?.id && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-500 font-bold">YOU</span>}
                      {canManage && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                          {group.ownerId === currentUser?.id && (
                            <button 
                              onClick={() => toggleGroupAdmin(group.id, mid)}
                              className={`p-2 rounded-lg transition-colors ${isAdmin ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                              title={isAdmin ? "Remove Admin" : "Make Admin"}
                            >
                              <Shield size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => { if(confirm(`Remove ${u.username}?`)) removeGroupMember(group.id, mid); }}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                            title="Remove from group"
                          >
                            <UserMinus size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button onClick={() => setShowGroupInfo(false)} className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="absolute inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add Members</h3>
              <button onClick={() => { setShowAddMember(false); setSearchQuery(''); }} className="p-2 text-zinc-500"><X size={24} /></button>
            </div>
            <input 
              type="text" 
              placeholder="Search by name or handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-pink-500"
            />
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {allUsers
                .filter(u => u.id !== currentUser?.id && !(group?.members || []).includes(u.id))
                .filter(u => (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.handle || '').toLowerCase().includes(searchQuery.toLowerCase()))
                .map(u => (
                  <button 
                    key={u.id}
                    onClick={() => {
                      addGroupMember(group!.id, u.id);
                      setShowAddMember(false);
                      setSearchQuery('');
                      sendMessage(`${u.username} has joined the chat.`, undefined, undefined, undefined, true);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div className="text-left">
                      <p className="font-bold text-sm">{u.username}</p>
                      <p className="text-xs text-zinc-500">@{u.handle}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal remains similar */}
      {showCamera && (
        <div className="absolute inset-0 z-[70] bg-black flex flex-col">
          <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent absolute top-0 left-0 right-0 z-10">
            <button onClick={stopCamera} className="text-white p-2 bg-black/50 rounded-full"><X size={24} /></button>
            <div className="flex gap-2">
              <button onClick={() => setCameraFilter('')} className={`px-3 py-1 rounded-full text-xs font-bold ${cameraFilter === '' ? 'bg-pink-600 text-white' : 'bg-white/20 text-white'}`}>Normal</button>
              <button onClick={() => setCameraFilter('grayscale')} className={`px-3 py-1 rounded-full text-xs font-bold ${cameraFilter === 'grayscale' ? 'bg-pink-600 text-white' : 'bg-white/20 text-white'}`}>B&W</button>
              <button onClick={() => setCameraFilter('saturate-200')} className={`px-3 py-1 rounded-full text-xs font-bold ${cameraFilter === 'saturate-200' ? 'bg-pink-600 text-white' : 'bg-white/20 text-white'}`}>Vivid</button>
            </div>
          </div>
          <div className="absolute top-20 left-4 right-4 z-10 max-w-sm mx-auto">
            <CameraDeviceSelector className="bg-black/60 backdrop-blur-md text-white p-3 rounded-2xl border border-white/20 text-xs" />
          </div>
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${cameraFilter}`} />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="p-8 pb-12 flex justify-center bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 right-0">
            <button onClick={takePhoto} className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-colors focus:ring-4 ring-pink-500" />
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceVisualizer({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let animationId: number;
    const start = () => {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const draw = () => {
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const padding = 3;
        const barWidth = (canvas.width / (bufferLength / 2)) - padding;
        for (let i = 0; i < bufferLength / 2; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
          const x = i * (barWidth + padding);
          const y = (canvas.height - barHeight) / 2;
          ctx.fillStyle = '#ec4899';
          const radius = barWidth / 2;
          if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, barWidth, Math.max(barHeight, 4), radius); ctx.fill(); }
          else { ctx.fillRect(x, y, barWidth, Math.max(barHeight, 4)); }
        }
      };
      draw();
    };
    start();
    return () => { cancelAnimationFrame(animationId); if (audioContext) audioContext.close(); };
  }, [stream]);
  return <canvas ref={canvasRef} width={200} height={32} className="flex-1 h-8 opacity-80" />;
}

const RemoteVoiceAudio: React.FC<{
  peerId: string;
  stream: MediaStream;
  deafened: boolean;
  onSpeakingChange: (peerId: string, speaking: boolean) => void;
}> = ({
  peerId,
  stream,
  deafened,
  onSpeakingChange
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = deafened;
      audioRef.current.play().catch(() => {});
    }
  }, [stream, deafened]);

  useEffect(() => {
    let ctx: AudioContext | null = null;
    let rafId = 0;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const check = () => {
        rafId = requestAnimationFrame(check);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        onSpeakingChange(peerId, (sum / data.length) > 16);
      };
      check();
    } catch {}
    return () => {
      cancelAnimationFrame(rafId);
      onSpeakingChange(peerId, false);
      if (ctx) { try { ctx.close(); } catch {} }
    };
  }, [peerId, stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}


