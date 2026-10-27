import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { 
  getMessages, getUsers, saveMessages, getNotifications, 
  saveNotifications, getGroupChats, deleteMessage, updateTypingStatus, 
  getUserStatuses, createWatchParty, subscribeToWatchPartiesByGroup,
  joinWatchParty, removeGroupMember, toggleGroupAdmin, addGroupMember
} from '../lib/db';
import { Message, User, GroupChat, UserStatus, WatchParty } from '../types';
import { 
  ArrowLeft, Send, Phone, Paperclip, Camera, X, Loader2, 
  Mic, Square, Trash2, CheckCheck, Users, Info, Tv,
  ShieldCheck, UserPlus, UserMinus, Shield
} from 'lucide-react';
import { HolographicBadge } from '../components/UIPolish';
import { CameraDeviceSelector } from '../components/CameraDeviceSelector';

export function Chat() {
  const { handle, groupId } = useParams<{ handle?: string, groupId?: string }>();
  const { currentUser, setIsCalling, setCallData, selectedCameraId } = useAppStore();
  const navigate = useNavigate();
  
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFilter, setCameraFilter] = useState('');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [activeGroupParties, setActiveGroupParties] = useState<WatchParty[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    
    const loadChat = async () => {
      const users = await getUsers();
      setAllUsers(users);
      
      const currentHandle = handle;
      const currentGroupId = groupId;
      
      if (currentGroupId) {
        const groups = await getGroupChats();
        const g = groups.find(x => x.id === currentGroupId);
        if (!g) {
          navigate('/messages');
          return;
        }
        setGroup(g);
        setOtherUser(null);
      } else if (currentHandle) {
        const user = users.find(u => u.handle === currentHandle);
        if (!user) {
          navigate('/messages');
          return;
        }
        setOtherUser(user);
        setGroup(null);
      }
      
      const allMsgs = await getMessages();
      let chatMsgs: Message[] = [];
      
      if (groupId) {
        chatMsgs = allMsgs.filter(m => m.groupId === groupId);
      } else {
        const user = users.find(u => u.handle === handle);
        if (user) {
          chatMsgs = allMsgs.filter(m => 
            (m.fromUserId === currentUser.id && m.toUserId === user.id) || 
            (m.fromUserId === user.id && m.toUserId === currentUser.id)
          );
        }
      }
      
      chatMsgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(chatMsgs);

      // Read Receipts Logic
      let msgsToUpdate = false;
      const updatedAllMsgs = allMsgs.map(m => {
        const isCurrentChat = groupId ? m.groupId === groupId : (m.fromUserId === otherUser?.id && m.toUserId === currentUser.id);
        if (isCurrentChat && m.fromUserId !== currentUser.id) {
          if (!(m.seenBy || []).includes(currentUser.id)) {
            msgsToUpdate = true;
            return { 
              ...m, 
              read: true, 
              seenBy: [...(m.seenBy || []), currentUser.id] 
            };
          }
        }
        return m;
      });

      if (msgsToUpdate) {
        await saveMessages(updatedAllMsgs);
      }

      // Typing Status Logic
      const statuses = await getUserStatuses();
      const currentTypingIn = groupId || otherUser?.id;
      const activeTyping = statuses
        .filter(s => 
          s.userId !== currentUser.id && 
          s.isTyping && 
          s.typingIn === currentTypingIn && 
          Date.now() - s.lastActive < 4000
        )
        .map(s => users.find(u => u.id === s.userId)?.username || 'Someone');
      
      setTypingUsers(activeTyping);
    };
    
    loadChat();
    const interval = setInterval(loadChat, 2000);
    return () => clearInterval(interval);
  }, [handle, groupId, currentUser, navigate, otherUser?.id]);

  useEffect(() => {
    if (!groupId) {
      setActiveGroupParties([]);
      return;
    }
    const unsubscribe = subscribeToWatchPartiesByGroup(groupId, (parties) => {
      setActiveGroupParties(parties);
    });
    return () => unsubscribe();
  }, [groupId]);

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

  const sendMessage = async (content: string, imageUrl?: string, videoUrl?: string, audioUrl?: string, isSystem = false) => {
    if ((!content.trim() && !imageUrl && !videoUrl && !audioUrl) || !currentUser) return;
    if (!otherUser && !group) return;
    
    const msg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      fromUserId: isSystem ? 'system' : currentUser.id,
      toUserId: otherUser?.id,
      groupId: group?.id,
      content: content.trim(),
      imageUrl,
      videoUrl,
      audioUrl,
      timestamp: Date.now(),
      seenBy: [currentUser.id]
    };
    
    const allMsgs = await getMessages();
    await saveMessages([...allMsgs, msg]);
    
    if (!isSystem) {
      const notifications = await getNotifications();
      const targetUserIds = group ? (group.members || []).filter(id => id !== currentUser.id) : [otherUser!.id];
      
      const newNotifs = targetUserIds.map(id => ({
        id: `notif_${Date.now()}_${id}`,
        userId: id,
        type: 'message' as const,
        fromUserId: currentUser.id,
        read: false,
        timestamp: Date.now()
      }));
      
      await saveNotifications([...notifications, ...newNotifs]);
    }
    
    setMessages(prev => [...prev, msg]);
    setNewMessage('');
    updateTyping(false);
  };

  const updateTyping = (isTyping: boolean) => {
    if (!currentUser) return;
    const typingIn = groupId || otherUser?.id;
    updateTypingStatus(currentUser.id, isTyping, typingIn);
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
    await sendMessage(newMessage);
  };

  // Cloudinary / Camera / Audio logic with resilient fallback if Cloudinary is terminated or down
  const uploadToCloudinary = async (file: Blob | File): Promise<{url: string, type: string}> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'centraltok');
      const res = await fetch('https://api.cloudinary.com/v1_1/nmdsqhos/auto/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return { url: data.secure_url, type: data.resource_type };
      }
    } catch {
      // Graceful fallback to data URL
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fileType = file.type || '';
        resolve({
          url: reader.result as string,
          type: fileType.startsWith('video') ? 'video' : fileType.startsWith('audio') ? 'audio' : 'image'
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { url, type } = await uploadToCloudinary(file);
      await sendMessage('', type === 'image' ? url : undefined, type === 'video' ? url : undefined);
    } catch(err) { alert("Failed to upload file."); } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsUploading(true);
        try { const { url } = await uploadToCloudinary(audioBlob); await sendMessage('', undefined, undefined, url); }
        catch(err) { alert("Failed to send audio message."); } finally { setIsUploading(false); }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (err) { alert("Microphone access denied."); }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      setAudioStream(null);
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
          alert("Could not access camera.");
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
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.filter = getComputedStyle(videoRef.current).filter;
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        setIsUploading(true);
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
        setShowCamera(false);
        try { const { url } = await uploadToCloudinary(blob); await sendMessage('', url); }
        catch(err) { alert("Failed to send photo."); } finally { setIsUploading(false); }
      }, 'image/jpeg', 0.9);
    }
  };

  if (!currentUser || (!otherUser && !group)) return null;

  return (
    <div className="w-full max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800 h-[100dvh] flex flex-col bg-white dark:bg-zinc-950 relative">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/messages')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          {group ? (
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
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            onClick={() => {
              if (group) {
                import('../lib/db').then(({ joinVoiceChannel }) => {
                  joinVoiceChannel(group.id, currentUser.id).catch(err => {
                    console.error("Failed to sync voice channel state:", err);
                  });
                  setCallData({ user: { id: group.id, username: group.name, avatarUrl: group.avatarUrl } as any, type: 'voice' });
                  setIsCalling(true);
                });
              } else if (otherUser) {
                setCallData({ user: otherUser, type: 'voice' });
                setIsCalling(true);
              }
            }}
          >
            <Phone size={22} />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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

        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 my-auto">
            {group ? `Welcome to ${group.name}!` : `Say hi to ${otherUser!.username}!`}
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.fromUserId === currentUser.id;
            const isSystem = m.fromUserId === 'system';
            const sender = allUsers.find(u => u.id === m.fromUserId);
            const showSeen = isMe && m.seenBy && m.seenBy.filter(id => id !== currentUser.id).length > 0;
            const seenNames = m.seenBy?.filter(id => id !== currentUser.id).map(id => allUsers.find(u => u.id === id)?.username).filter(Boolean).join(', ');

            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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
                  <div className="relative group">
                    <div className={`rounded-2xl px-4 py-3 ${isMe ? 'bg-pink-600 text-white rounded-br-sm' : 'bg-zinc-100 dark:bg-zinc-800 rounded-bl-sm shadow-sm'}`}>
                      {m.imageUrl && (
                        <img src={m.imageUrl} alt="attachment" className="w-full rounded-lg mb-2 object-cover max-h-64" />
                      )}
                      {m.videoUrl && (
                        <video src={m.videoUrl} controls className="w-full rounded-lg mb-2 max-h-64 object-cover" />
                      )}
                      {m.audioUrl && (
                        <div className="space-y-1.5 min-w-[200px]">
                          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-pink-100' : 'text-zinc-500'}`}>
                            <Mic size={10} />
                            <span>Voice Message</span>
                          </div>
                          <audio src={m.audioUrl} controls className={`w-full h-8 rounded-lg ${isMe ? 'brightness-200 contrast-75' : ''}`} />
                        </div>
                      )}
                      {m.content && <p className="mt-1 leading-relaxed">{m.content}</p>}
                      {m.sharedVideoId && (
                        <Link to="/" className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 text-xs font-semibold hover:bg-black/30 transition-colors">
                          <span>🎬 View shared video</span>
                        </Link>
                      )}
                    </div>
                    
                    {isMe && (
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="absolute -left-10 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete message"
                      >
                        <Trash2 size={16} />
                      </button>
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
        
        <div ref={bottomRef} />
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 pb-8 md:pb-4 bg-white dark:bg-zinc-950">
        <form onSubmit={handleSend} className="flex items-center gap-2 relative">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
            <Paperclip size={20} />
          </button>
          <button type="button" onClick={() => setShowCamera(true)} className="p-2.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors mr-1">
            <Camera size={20} />
          </button>
          
          {isRecordingAudio ? (
            <button type="button" onClick={stopAudioRecording} className="p-2.5 text-red-500 hover:text-red-600 transition-colors mr-1 animate-pulse" title="Stop recording">
              <Square size={20} className="fill-current" />
            </button>
          ) : (
            <button type="button" onClick={startAudioRecording} className="p-2.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors mr-1" title="Record audio">
              <Mic size={20} />
            </button>
          )}

          {isRecordingAudio && audioStream ? (
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full px-4 py-2 flex items-center gap-3 overflow-hidden border border-pink-500/20">
              <div className="flex items-center gap-1.5 text-pink-500 animate-pulse shrink-0">
                <Mic size={16} /><span className="text-[10px] font-bold uppercase tracking-tighter">Live</span>
              </div>
              <VoiceVisualizer stream={audioStream} />
            </div>
          ) : (
            <input 
              type="text" 
              value={newMessage}
              onChange={e => handleInputChange(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-pink-500 transition-all"
              disabled={isUploading}
            />
          )}
          <button 
            type="submit"
            disabled={(!newMessage.trim() && !isUploading) || isUploading}
            className="p-2.5 bg-pink-600 text-white rounded-full hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 shrink-0"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
          </button>
        </form>
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
                {(group.ownerId === currentUser.id || (group.admins || []).includes(currentUser.id)) && (
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
                const canManage = (group.ownerId === currentUser.id || (group.admins || []).includes(currentUser.id)) && mid !== currentUser.id && !isOwner;

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
                      {mid === currentUser.id && <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-500 font-bold">YOU</span>}
                      {canManage && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                          {group.ownerId === currentUser.id && (
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
                .filter(u => u.id !== currentUser.id && !(group?.members || []).includes(u.id))
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
