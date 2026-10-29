import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { getNotifications, getMessages, getUsers, getGroupChats, saveGroupChats } from '../lib/db';
import { AppNotification, Message, User, GroupChat } from '../types';
import { Heart, MessageCircle, UserPlus, Bell, ShieldCheck, Users, Plus, X, Search, Check, LifeBuoy, Phone, Activity, Server, Database, Sparkles, Youtube, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addReport } from '../lib/db';
import { checkSystemHealth, SystemStatus } from '../lib/diagnostics';
import { HolographicBadge } from '../components/UIPolish';

export function Inbox() {
  const { 
    currentUser, 
    setCallData, 
    setIsCalling 
  } = useAppStore();
  const [notifications, setNotifications] = useState<(Notification & { fromUser: User })[]>([]);
  const [conversations, setConversations] = useState<{ user?: User, group?: GroupChat, lastMessage: Message }[]>([]);
  const [activeTab, setActiveTab] = useState<'activity' | 'messages' | 'groups'>('activity');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  
  // Support state
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportReason, setSupportReason] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  // Diagnostics state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<SystemStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  
  // Group creation state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    setShowNotificationPrompt(localStorage.getItem('notificationPromptDismissed') !== 'true');
    
    const loadInbox = async () => {
      const allUsers = await getUsers();
      const allNotifs = await getNotifications();
      const allMsgs = await getMessages();
      const allGroups = await getGroupChats();
      
      const userNotifs = allNotifs
        .filter(n => n.userId === currentUser.id)
        .map(n => ({ 
          ...n, 
          fromUser: allUsers.find(u => u.id === n.fromUserId) || {
            id: n.fromUserId || 'system',
            username: 'CentralTok Staff',
            handle: 'staff',
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=staff',
            email: 'staff@centraltok.local',
            bio: 'Official CentralTok Team',
            following: [],
            followers: [],
            isPrivate: false
          }
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      
      // Filter direct messages
      const dmMsgs = allMsgs.filter(m => !m.groupId && (m.fromUserId === currentUser.id || m.toUserId === currentUser.id));
      
      // Filter group messages
      const userGroups = allGroups.filter(g => (g.members || []).includes(currentUser.id));
      const groupIds = userGroups.map(g => g.id);
      const groupMsgs = allMsgs.filter(m => m.groupId && (groupIds || []).includes(m.groupId));
      
      const convosMap = new Map<string, { user?: User, group?: GroupChat, lastMessage: Message }>();
      
      // Add DMs to map
      dmMsgs.forEach(m => {
        const otherId = m.fromUserId === currentUser.id ? m.toUserId! : m.fromUserId;
        const existing = convosMap.get(`dm_${otherId}`);
        if (!existing || existing.lastMessage.timestamp < m.timestamp) {
          const otherUser = allUsers.find(u => u.id === otherId);
          if (otherUser) {
            convosMap.set(`dm_${otherId}`, { user: otherUser, lastMessage: m });
          }
        }
      });
      
      // Add Groups to map
      userGroups.forEach(g => {
        const lastMsg = groupMsgs.filter(m => m.groupId === g.id).sort((a, b) => b.timestamp - a.timestamp)[0];
        if (lastMsg) {
          convosMap.set(`group_${g.id}`, { group: g, lastMessage: lastMsg });
        } else {
          // Placeholder for empty groups
          convosMap.set(`group_${g.id}`, { 
            group: g, 
            lastMessage: { 
              id: 'initial', 
              fromUserId: 'system', 
              content: 'Group created', 
              timestamp: g.createdAt 
            } 
          });
        }
      });
      
      const convos = Array.from(convosMap.values())
        .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
      
      // Filter friends for group creation (following each other)
      const friends = allUsers.filter(u => 
        u.id !== currentUser.id && 
        (currentUser.following || []).includes(u.id) && 
        (u.following || []).includes(currentUser.id)
      );
      
      setNotifications(userNotifs);
      setConversations(convos);
      setFriendsList(friends);
    };
    
    loadInbox();
    const interval = setInterval(loadInbox, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const createGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0 || !currentUser) return;
    
    const newGroup: GroupChat = {
      id: `group_${Date.now()}`,
      name: groupName.trim(),
      ownerId: currentUser.id,
      admins: [currentUser.id], // Creator is default admin
      members: [currentUser.id, ...selectedFriends],
      createdAt: Date.now(),
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${groupName}`
    };
    
    const allGroups = await getGroupChats();
    await saveGroupChats([...allGroups, newGroup]);
    
    setShowCreateGroup(false);
    setGroupName('');
    setSelectedFriends([]);
  };

  const toggleFriendSelection = (id: string) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const chooseNotifications = async (enabled: boolean) => {
    localStorage.setItem('notificationPromptDismissed', 'true');
    setShowNotificationPrompt(false);
    if (enabled && 'Notification' in window) await window.Notification.requestPermission();
  };

  const submitSupport = async () => {
    if (!supportReason.trim() || !currentUser) return;
    await addReport({
      reporterId: currentUser.id,
      reason: supportReason.trim(),
      status: 'pending',
      timestamp: Date.now(),
      category: 'support'
    });
    setSupportSubmitted(true);
    setTimeout(() => {
      setShowSupportModal(false);
      setSupportSubmitted(false);
      setSupportReason('');
    }, 2000);
  };

  if (!currentUser) return <div className="p-8 text-center">Please log in to view your inbox.</div>;

  return (
    <div className="w-full max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800 h-full flex flex-col bg-white dark:bg-zinc-950 relative">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Inbox</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                setShowDiagnostics(true);
                setIsCheckingHealth(true);
                const status = await checkSystemHealth();
                setDiagnosticsStatus(status);
                setIsCheckingHealth(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <Activity size={12} className="text-emerald-500" />
              System Status
            </button>
            <button 
              onClick={() => setShowSupportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-xs font-bold"
            >
              <LifeBuoy size={14} className="text-pink-600" />
              Support
            </button>
          </div>
        </div>
        {activeTab === 'messages' && (
          <button 
            onClick={() => setShowCreateGroup(true)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-pink-600"
          >
            <Plus size={24} />
          </button>
        )}
      </div>
      
      {showNotificationPrompt && (
        <div className="m-4 p-4 rounded-xl border border-pink-200 dark:border-pink-900 bg-pink-50 dark:bg-pink-950/30 animate-in slide-in-from-top-4">
          <p className="font-semibold">Do you want real time notifications?</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">This will allow you to get notifications from others when you're not in the website.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => chooseNotifications(true)} className="px-4 py-2 rounded-lg bg-pink-600 text-white font-semibold">Yes</button>
            <button onClick={() => chooseNotifications(false)} className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-semibold">No</button>
          </div>
        </div>
      )}
      
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <button 
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-4 font-semibold ${activeTab === 'activity' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
        >
          Activity
        </button>
        <button 
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-4 font-semibold ${activeTab === 'messages' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
        >
          People
        </button>
        <button 
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-4 font-semibold ${activeTab === 'groups' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
        >
          Groups
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'activity' ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                <Bell size={48} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                <p>No new activity</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                  <div className="relative">
                    <img src={n.fromUser.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center text-white
                      ${n.type === 'like' ? 'bg-pink-600' : n.type === 'follow' ? 'bg-blue-500' : n.type === 'forum_announcement' ? 'bg-[#5865F2]' : n.type === 'tradient_reward' ? 'bg-indigo-600' : n.type === 'moderation' ? 'bg-amber-600' : 'bg-green-500'}`}>
                      {n.type === 'like' && <Heart size={12} className="fill-current" />}
                      {n.type === 'follow' && <UserPlus size={12} />}
                      {n.type === 'mention' && <span className="text-[10px] font-bold">@</span>}
                      {n.type === 'forum_announcement' && <span className="text-[10px]">📢</span>}
                      {n.type === 'tradient_reward' && <ShieldCheck size={12} />}
                      {n.type === 'moderation' && <ShieldAlert size={12} />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">
                      {n.type === 'forum_announcement' ? (
                        <>
                          <span className="font-bold text-[#5865F2]">📢 Forum Announcement:</span>{' '}
                          <Link to="/forum/updates" className="font-semibold hover:underline">{n.title || n.message}</Link>
                        </>
                      ) : n.type === 'tradient_reward' ? (
                        <>
                          <Link to={`/profile/${n.fromUser.handle}`} className="font-bold hover:underline">@{n.fromUser.handle}</Link>
                          {' '}
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">awarded you the Tradient Badge!</span>
                          <p className="mt-1 text-zinc-600 dark:text-zinc-300 italic">"{n.message}"</p>
                        </>
                      ) : n.type === 'support_resolved' ? (
                        <>
                          <span className="font-bold text-green-600 dark:text-green-400">✅ Support Resolved:</span>{' '}
                          <span className="text-zinc-800 dark:text-zinc-200">{n.message}</span>
                        </>
                      ) : n.type === 'moderation' ? (
                        <>
                          <span className="font-bold text-amber-600 dark:text-amber-400">⚠️ Moderator Action:</span>{' '}
                          <span className="text-zinc-800 dark:text-zinc-200">{n.message}</span>
                        </>
                      ) : (
                        <>
                          <Link to={`/profile/${n.fromUser.handle}`} className="font-bold hover:underline">{n.fromUser.username}</Link>
                          {' '}
                          {n.type === 'like' ? 'liked your video' : n.type === 'follow' ? 'started following you' : 'mentioned you'}
                        </>
                      )}
                    </p>
                    <span className="text-xs text-zinc-500">{new Date(n.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'messages' ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {conversations.filter(c => !c.group).length === 0 ? (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                <MessageCircle size={48} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                <p>Messages will appear here</p>
              </div>
            ) : (
              conversations.filter(c => !c.group).map(c => {
                const link = `/messages/${c.user!.handle}`;
                return (
                  <Link to={link} key={c.user!.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <img src={c.user!.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate flex items-center gap-1">
                        {c.user!.username}
                        {c.user!.isVerified && <HolographicBadge />}
                      </h3>
                      <p className="text-sm text-zinc-500 truncate flex items-center gap-1">
                        {c.lastMessage.fromUserId === currentUser.id ? 'You: ' : ''}
                        {c.lastMessage.content || (c.lastMessage.imageUrl ? '📷 Photo' : c.lastMessage.videoUrl ? '🎥 Video' : c.lastMessage.audioUrl ? '🎤 Voice' : '')}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {conversations.filter(c => c.group).length === 0 ? (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                <Users size={48} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                <p>No group chats yet</p>
              </div>
            ) : (
              conversations.filter(c => c.group).map(c => {
                const link = `/messages/group/${c.group!.id}`;
                return (
                  <div key={c.group!.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group">
                    <Link to={link} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative">
                        <img src={c.group!.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-pink-600 flex items-center justify-center text-white border-2 border-white dark:border-zinc-950">
                          <Users size={12} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{c.group!.name}</h3>
                        <p className="text-sm text-zinc-500 truncate flex items-center gap-1">
                          {c.lastMessage.fromUserId === currentUser.id ? 'You: ' : ''}
                          {c.lastMessage.content || (c.lastMessage.imageUrl ? '📷 Photo' : c.lastMessage.videoUrl ? '🎥 Video' : c.lastMessage.audioUrl ? '🎤 Voice' : '')}
                        </p>
                      </div>
                    </Link>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        import('../lib/db').then(({ joinVoiceChannel }) => {
                          joinVoiceChannel(c.group!.id, currentUser.id).catch(err => {
                            console.error("Failed to sync voice channel state:", err);
                          });
                          setCallData({ user: { id: c.group!.id, username: c.group!.name, avatarUrl: c.group!.avatarUrl } as any, type: 'voice' });
                          setIsCalling(true);
                        });
                      }}
                      className="p-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-pink-600 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Phone size={20} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-8">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <button onClick={() => setShowCreateGroup(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full">
              <X size={24} />
            </button>
            <h2 className="font-bold">New Group</h2>
            <button 
              onClick={createGroup}
              disabled={!groupName.trim() || selectedFriends.length === 0}
              className="px-4 py-1.5 bg-pink-600 text-white rounded-full font-bold disabled:opacity-50"
            >
              Create
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase px-1">Group Name</label>
              <input 
                type="text" 
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Ex: The Squad"
                className="w-full mt-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search friends..."
                className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {friendsList
              .filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase()) || f.handle.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(friend => (
              <div 
                key={friend.id} 
                onClick={() => toggleFriendSelection(friend.id)}
                className="py-3 flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <img src={friend.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
                  <div>
                    <p className="font-bold flex items-center gap-1">
                      {friend.username}
                      {friend.isVerified && <HolographicBadge />}
                    </p>
                    <p className="text-xs text-zinc-500">@{friend.handle}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedFriends.includes(friend.id) ? 'bg-pink-600 border-pink-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  {selectedFriends.includes(friend.id) && <Check size={14} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-8">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <button onClick={() => setShowSupportModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full">
              <X size={24} />
            </button>
            <h2 className="font-bold text-pink-600">Contact Support</h2>
            <div className="w-10" />
          </div>
          
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            {supportSubmitted ? (
              <div className="space-y-4 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={40} />
                </div>
                <h3 className="text-xl font-bold">Request Submitted!</h3>
                <p className="text-zinc-500 text-sm">Our staff will review your case. You'll receive a notification once it's resolved.</p>
              </div>
            ) : (
              <>
                <LifeBuoy size={64} className="text-pink-600 mb-6" />
                <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">How can we help?</h3>
                <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                  Describe your issue or what you need support with. Be as detailed as possible so our moderators can help you faster.
                </p>
                
                <textarea 
                  value={supportReason}
                  onChange={e => setSupportReason(e.target.value)}
                  placeholder="Tell us what's wrong..."
                  className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-4 min-h-[160px] focus:ring-2 focus:ring-pink-500 outline-none resize-none mb-6 text-sm"
                />
                
                <button 
                  onClick={submitSupport}
                  disabled={!supportReason.trim()}
                  className="w-full py-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-2xl shadow-xl shadow-pink-600/20 transition-all disabled:opacity-50 active:scale-95"
                >
                  Send Support Request
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Diagnostics Modal */}
      {showDiagnostics && (
        <div className="absolute inset-0 z-[60] bg-white dark:bg-zinc-950 flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-emerald-500" />
              <h2 className="font-bold">System Diagnostics</h2>
            </div>
            <button onClick={() => setShowDiagnostics(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Server size={32} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Backend Connectivity</h3>
                <p className="text-sm text-zinc-500 mt-1">Verifying cloud infrastructure and API services.</p>
              </div>

              {isCheckingHealth ? (
                <div className="flex flex-col items-center py-12">
                  <Activity size={40} className="text-emerald-500 animate-pulse mb-4" />
                  <p className="text-sm font-bold text-zinc-400">Running health checks...</p>
                </div>
              ) : diagnosticsStatus ? (
                <div className="space-y-3">
                  {diagnosticsStatus.isStaticHost && (
                    <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 mb-2">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check size={16} className="text-pink-500" />
                        <span>Hosting: GitHub Pages (Static Client Mode)</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        All videos, likes, chat messages, and Cloudinary uploads communicate directly with Firebase & Cloudinary from your browser.
                      </p>
                    </div>
                  )}

                  <HealthItem 
                    icon={<Database size={18} />} 
                    label="Firebase Infrastructure" 
                    status={diagnosticsStatus.firebase} 
                    desc="Cloud Firestore & Auth"
                  />
                  <HealthItem 
                    icon={<Server size={18} />} 
                    label={diagnosticsStatus.isStaticHost ? "Node Server (Not needed on GitHub Pages)" : "Core Backend"} 
                    status={diagnosticsStatus.backend || diagnosticsStatus.isStaticHost} 
                    desc={diagnosticsStatus.isStaticHost ? "Static client architecture active" : "Node.js Server & /api routes"}
                  />
                  <HealthItem 
                    icon={<Sparkles size={18} />} 
                    label="AI Services (Gemini)" 
                    status={diagnosticsStatus.aiChat && diagnosticsStatus.aiSearch} 
                    desc="Chat & Smart Search"
                  />
                  <HealthItem 
                    icon={<Youtube size={18} />} 
                    label="Media Streaming" 
                    status={true} 
                    desc="Direct Embed & Cloudinary Active"
                  />

                  <div className="mt-8 p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Latency</span>
                      <span className="text-xs font-mono font-bold text-emerald-500">{diagnosticsStatus.latency}ms</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${Math.max(5, 100 - (diagnosticsStatus.latency / 10))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                    <ShieldAlert size={20} className="shrink-0" />
                    <p className="text-xs leading-relaxed">
                      <strong>Host Note:</strong> You are hosted on GitHub Pages. Firebase database, Cloudinary media, and YouTube feeds run completely serverless in your browser!
                    </p>
                  </div>
                </div>
              ) : null}

              <button 
                onClick={async () => {
                  setIsCheckingHealth(true);
                  const status = await checkSystemHealth();
                  setDiagnosticsStatus(status);
                  setIsCheckingHealth(false);
                }}
                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-2xl transition-all active:scale-95 mt-4"
              >
                Refresh Check
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthItem({ icon, label, status, desc }: { icon: React.ReactNode, label: string, status: boolean, desc: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm">{label}</h4>
          {status ? (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500">
              <Check size={12} strokeWidth={4} /> Operational
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500">
              <X size={12} strokeWidth={4} /> Offline
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 font-medium">{desc}</p>
      </div>
    </div>
  );
}
