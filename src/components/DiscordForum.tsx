import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { 
  getFAQCategories, saveFAQCategories, getFAQPosts, saveFAQPosts, deleteFAQPostFromDB, 
  getUsers, announceForumPostToEveryone, getForumEditRequests, saveForumEditRequests, 
  deleteForumEditRequestFromDB, isQuotaBlocked
} from '../lib/db';
import { FAQCategory, FAQPost, FAQReply, User, ForumEditRequest } from '../types';
import { 
  Hash, Search, Pin, MessageSquare, Plus, Settings, Trash2, Send, 
  Smile, ShieldCheck, Crown, ChevronLeft, Tag, X, Check, Filter,
  Lock, Video as VideoIcon, Paperclip, Eye, Edit3
} from 'lucide-react';
import { ForumRichText, ForumToolbar } from './ForumRichText';

const DEFAULT_CATEGORIES: FAQCategory[] = [
  { id: 'announcements', name: 'Announcements', icon: '📢', color: '#5865F2', description: 'Official updates from the owner and staff team' },
  { id: 'general', name: 'General FAQ', icon: '❓', color: '#57F287', description: 'Frequently asked questions about CentralTok' },
  { id: 'friends_privacy', name: 'Friends & Privacy', icon: '👥', color: '#FEE75C', description: 'How mutual follows, friend posts, and private videos work' },
  { id: 'stories_media', name: 'Stories & Camera', icon: '⚡', color: '#EB459E', description: '24-hour stories, switching between recording and images' },
  { id: 'moderation_safety', name: 'Rules & Bans', icon: '🛡️', color: '#ED4245', description: 'Staff guidelines, ban reason requirements, and appeals' }
];

const PRESET_COLORS = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#3BA55D', '#FAA61A', '#00A8FC'];

export function DiscordForum() {
  const { currentUser, setShowAuthModal } = useAppStore();
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [posts, setPosts] = useState<FAQPost[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<FAQPost | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplyPreview, setIsReplyPreview] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<FAQPost | null>(null);
  const [isStaffEditing, setIsStaffEditing] = useState(false);
  const [editRequests, setEditRequests] = useState<ForumEditRequest[]>([]);
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  
  // Create/Edit Post Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [registeredOnly, setRegisteredOnly] = useState(false);
  const [announceToEveryone, setAnnounceToEveryone] = useState(true);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Formatting helper for textareas
  const insertFormatting = (
    ref: React.RefObject<HTMLTextAreaElement>,
    currentText: string,
    setText: (s: string) => void,
    prefix: string,
    suffix: string = '',
    defaultText: string = 'text'
  ) => {
    const textarea = ref.current;
    if (!textarea) {
      setText(currentText + prefix + defaultText + suffix);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = currentText.substring(start, end);
    const textToInsert = selected || defaultText;
    const newText = currentText.substring(0, start) + prefix + textToInsert + suffix + currentText.substring(end);
    
    setText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + textToInsert.length
      );
    }, 40);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video');
    const isImg = file.type.startsWith('image');
    if (!isVid && !isImg) {
      alert("Please upload an image or video file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setMediaUrl(ev.target.result as string);
        setMediaType(isVid ? 'video' : 'image');
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Create Category Form
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📌');
  const [catColor, setCatColor] = useState('#5865F2');
  const [catDesc, setCatDesc] = useState('');

  const isOwner = currentUser?.role === 'owner';
  const isStaff = currentUser?.role === 'staff';
  const isStaffOrOwner = isOwner || isStaff;

  // Load data
  const loadForumData = async () => {
    const allUsers = await getUsers();
    setUsers(allUsers);
    
    let cats = await getFAQCategories();
    if (cats.length === 0) {
      cats = DEFAULT_CATEGORIES;
      if (!isQuotaBlocked()) {
        await saveFAQCategories(cats);
      }
    }
    setCategories(cats);
    if (!newCategory && cats.length > 0) {
      setNewCategory(cats[0].id);
    }

    let [allPosts, allRequests] = await Promise.all([getFAQPosts(), getForumEditRequests()]);
    setEditRequests(allRequests);
    
    if (allPosts.length === 0) {
      // Seed initial helpful FAQs
      const initialPosts: FAQPost[] = [
        {
          id: 'announcement_v0.9_final',
          authorId: currentUser?.id || 'system_staff',
          title: '🚀 CentralTok V0.9 BETA: Be Verified & New Creative Tools!',
          categoryId: 'announcements',
          pinned: true,
          timestamp: Date.now(),
          content: `Welcome to the V0.9 BETA update! We've added several highly requested features:\n\n**✨ Be Verified**\nYou can now find the "Be Verified" option directly in the **BETA V0.9 Modal** in your sidebar. Verification now requires:\n- First & Last Name\n- **School ID Photo** (showing your name and student picture)\n- Selfie (Optional)\n\nOnce verified, you'll sport the new **Holographic Badge** across the entire app, including your profile, messages, and the people tab!\n\n**🎵 New Video Editor Features**\nExpress yourself with our enhanced upload tools:\n- **Music Library**: Add songs directly to your videos.\n- **Animated Text**: Add text layers with high-energy animations like 'Float', 'Glitch', and 'Pop'.\n- **Live Camera Fixes**: We've resolved issues with live camera previews for a smoother recording experience.\n\n**🎮 New Games & Apps**\nCheck out the "Suggest Game/App" feature on the Games page to let us know what we should add next!\n\nStay tuned for more updates as we approach V1.0!`,
          replies: [],
          reactions: { '🔥': [currentUser?.id || 'system'], '🚀': [currentUser?.id || 'system'], '✅': [currentUser?.id || 'system'] }
        },
        {
          id: 'faq_1',
          authorId: currentUser?.id || 'system_staff',
          title: '👥 How do Friends and Post Privacy (Friends / Only You / Everyone) work?',
          categoryId: 'friends_privacy',
          pinned: true,
          timestamp: Date.now() - 3600000 * 5,
          content: `On CentralTok, friendship is built on mutual connection!\n\n**Mutual Follows = Friends:**\nWhen you and another user both follow each other, you automatically become **Friends**. You will see a special Friends badge on their profile and in your interactions.\n\n**Post Privacy Options:**\nWhen uploading or recording a post, you can choose who can view it:\n- 🌐 **Everyone**: Your video or image is public and appears on the For You feed.\n- 👥 **Friends Only**: Only people who mutually follow you can view this post. Hidden from everyone else.\n- 🔒 **Only You**: Private post visible only to you on your profile.\n\n**Deleting Posts:**\nYou can delete any of your posts at any time from your profile grid or directly from the video player options!`,
          replies: [
            {
              id: 'rep_1',
              authorId: currentUser?.id || 'system_staff',
              content: 'If you unfollow someone, you will no longer be mutual friends and friend-only posts will be hidden automatically.',
              timestamp: Date.now() - 3600000 * 4
            }
          ],
          reactions: { '👍': ['user_1', 'user_2'], '❤️': ['user_1'] }
        },
        {
          id: 'faq_2',
          authorId: currentUser?.id || 'system_staff',
          title: '⚡ Stories Feature & Switching between Camera, Video, and Image',
          categoryId: 'stories_media',
          pinned: true,
          timestamp: Date.now() - 3600000 * 3,
          content: `You can now share **24-Hour Stories** as well as standard Feed posts!\n\n**Switching Media Types:**\n- 🔴 **Record**: Switch to your live camera to record video with a live timer, or tap the photo shutter to snap an instant photo!\n- 🖼️ **Image**: Upload photos, memes, or pictures directly from your device.\n- 🎥 **Video**: Upload pre-recorded MP4/WebM videos.\n- 💻 **Screen**: Capture your screen.\n\n**Stories Bar:**\nYour stories appear in the top Stories Bar on the Home feed with a glowing gradient ring and automatically disappear after 24 hours. You can view who seen your story!`,
          replies: [],
          reactions: { '⚡': ['user_1'], '🔥': ['user_2'] }
        },
        {
          id: 'faq_3',
          authorId: currentUser?.id || 'system_staff',
          title: '🛡️ Mandatory Ban Reasons & Unban Transparency Policy',
          categoryId: 'moderation_safety',
          pinned: false,
          timestamp: Date.now() - 3600000 * 2,
          content: `All moderation actions on CentralTok are held to strict accountability standards.\n\n**Staff Reason Requirements:**\n- When staff or owner bans any user (temporary, permanent, or hardware enforcement), a specific, documented reason MUST be provided.\n- When a user is unbanned (either directly or via appeal), staff MUST provide a detailed explanation why they are getting unbanned.\n- If an appeal is rejected, staff MUST provide a mandatory reason explaining why the user remains banned.\n\nAll reasons are displayed transparently to the user on their ban screen and logged in the immutable moderation audit log.`,
          replies: [],
          reactions: { '🛡️': ['user_1', 'user_2'] }
        }
      ];
      allPosts = initialPosts;
      if (!isQuotaBlocked()) {
        await saveFAQPosts(initialPosts);
      }
    }
    setPosts(allPosts);
  };

  useEffect(() => {
    loadForumData();
  }, []);

  // Filtered posts
  const filteredPosts = posts.filter(post => {
    const matchesCategory = !activeCategoryId || post.categoryId === activeCategoryId;
    const matchesSearch = !searchQuery || 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });

  const getCategory = (catId: string) => categories.find(c => c.id === catId);
  const getAuthor = (authorId: string) => users.find(u => u.id === authorId);

  // Handle creating post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffOrOwner || !currentUser) return;
    if (!newTitle.trim() || !newContent.trim() || !newCategory) return;

    let detectedMediaType = mediaType;
    if (mediaUrl.trim() && !detectedMediaType) {
      detectedMediaType = mediaUrl.match(/\.(mp4|webm|mov|m4v)($|\?)/i) ? 'video' : 'image';
    }

    const newPost: FAQPost = {
      id: `faq_${Date.now()}`,
      authorId: currentUser.id,
      title: newTitle.trim(),
      categoryId: newCategory,
      content: newContent.trim(),
      pinned: isPinned,
      timestamp: Date.now(),
      replies: [],
      reactions: {},
      allowReplies,
      registeredOnly,
      mediaUrl: mediaUrl.trim() || undefined,
      mediaType: detectedMediaType || undefined
    };

    const updated = [newPost, ...posts];
    setPosts(updated);
    await saveFAQPosts(updated);

    // Announce to all users only if the toggle is enabled
    if (announceToEveryone) {
      await announceForumPostToEveryone(newPost, currentUser);
    }

    setNewTitle('');
    setNewContent('');
    setIsPinned(false);
    setAllowReplies(true);
    setRegisteredOnly(false);
    setAnnounceToEveryone(true);
    setMediaUrl('');
    setMediaType(null);
    setIsPreviewMode(false);
    setShowCreateModal(false);
  };

  // Handle adding category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStaffOrOwner) return;
    if (!catName.trim()) return;

    const id = catName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newCat: FAQCategory = {
      id: `${id}_${Date.now()}`,
      name: catName.trim(),
      icon: catIcon.trim() || '📌',
      color: catColor,
      description: catDesc.trim()
    };

    const updated = [...categories, newCat];
    setCategories(updated);
    await saveFAQCategories(updated);

    setCatName('');
    setCatDesc('');
  };

  // Handle deleting category
  const handleDeleteCategory = async (catId: string) => {
    if (!isStaffOrOwner) return;
    if (categories.length <= 1) {
      alert("At least one category is required.");
      return;
    }
    const updated = categories.filter(c => c.id !== catId);
    setCategories(updated);
    await saveFAQCategories(updated);
    if (activeCategoryId === catId) setActiveCategoryId(null);
  };

  // Handle deleting post
  const handleDeletePost = async (postId: string) => {
    if (!isStaffOrOwner) return;
    if (!window.confirm("Are you sure you want to delete this FAQ thread?")) return;
    
    await deleteFAQPostFromDB(postId);
    const updated = posts.filter(p => p.id !== postId);
    setPosts(updated);
    if (selectedPost?.id === postId) setSelectedPost(null);
  };

  const handleEditPost = (post: FAQPost) => {
    setEditingPost(post);
    setNewTitle(post.title);
    setNewContent(post.content);
    setNewCategory(post.categoryId);
    setIsPinned(!!post.pinned);
    setAllowReplies(post.allowReplies !== false);
    setRegisteredOnly(!!post.registeredOnly);
    setMediaUrl(post.mediaUrl || '');
    setMediaType(post.mediaType || null);
    
    const isPostAuthor = currentUser?.id === post.authorId;
    // Staff needs approval if they aren't the author and not the owner
    setIsStaffEditing(isStaff && !isPostAuthor && !isOwner);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost || !currentUser) return;

    let detectedMediaType = mediaType;
    if (mediaUrl.trim() && !detectedMediaType) {
      detectedMediaType = mediaUrl.match(/\.(mp4|webm|mov|m4v)($|\?)/i) ? 'video' : 'image';
    }

    if (isStaffEditing) {
      // Staff needs approval from owner
      const editReq: ForumEditRequest = {
        id: `edit_req_${Date.now()}`,
        postId: editingPost.id,
        staffId: currentUser.id,
        proposedTitle: newTitle.trim(),
        proposedContent: newContent.trim(),
        proposedCategoryId: newCategory,
        proposedMediaUrl: mediaUrl.trim() || undefined,
        proposedMediaType: detectedMediaType || undefined,
        proposedPinned: isPinned,
        proposedAllowReplies: allowReplies,
        proposedRegisteredOnly: registeredOnly,
        status: 'pending',
        timestamp: Date.now()
      };
      
      const updatedReqs = [editReq, ...editRequests];
      setEditRequests(updatedReqs);
      await saveForumEditRequests(updatedReqs);
      alert("Edit request submitted to owner for approval.");
    } else {
      // Owner or Author can edit directly
      const updatedPosts = posts.map(p => {
        if (p.id === editingPost.id) {
          return {
            ...p,
            title: newTitle.trim(),
            content: newContent.trim(),
            categoryId: newCategory,
            pinned: isPinned,
            allowReplies,
            registeredOnly,
            mediaUrl: mediaUrl.trim() || undefined,
            mediaType: detectedMediaType || undefined,
            updatedAt: Date.now()
          };
        }
        return p;
      });
      
      setPosts(updatedPosts);
      await saveFAQPosts(updatedPosts);
      if (selectedPost?.id === editingPost.id) {
        setSelectedPost(updatedPosts.find(p => p.id === editingPost.id) || null);
      }
    }

    setShowEditModal(false);
    setEditingPost(null);
    setNewTitle('');
    setNewContent('');
    setMediaUrl('');
    setMediaType(null);
  };

  const handleApproveEdit = async (req: ForumEditRequest) => {
    if (!isOwner) return;

    const updatedPosts = posts.map(p => {
      if (p.id === req.postId) {
        return {
          ...p,
          title: req.proposedTitle,
          content: req.proposedContent,
          categoryId: req.proposedCategoryId,
          pinned: req.proposedPinned,
          allowReplies: req.proposedAllowReplies,
          registeredOnly: req.proposedRegisteredOnly,
          mediaUrl: req.proposedMediaUrl,
          mediaType: req.proposedMediaType,
          updatedAt: Date.now()
        };
      }
      return p;
    });

    setPosts(updatedPosts);
    await saveFAQPosts(updatedPosts);

    const updatedReqs = editRequests.filter(r => r.id !== req.id);
    setEditRequests(updatedReqs);
    await saveForumEditRequests(updatedReqs);
    await deleteForumEditRequestFromDB(req.id);
    
    if (selectedPost?.id === req.postId) {
      setSelectedPost(updatedPosts.find(p => p.id === req.postId) || null);
    }
  };

  const handleRejectEdit = async (reqId: string) => {
    if (!isOwner) return;
    const updatedReqs = editRequests.filter(r => r.id !== reqId);
    setEditRequests(updatedReqs);
    await saveForumEditRequests(updatedReqs);
    await deleteForumEditRequestFromDB(reqId);
  };

  // Handle adding reply
  const handleAddReply = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (!replyText.trim() || !selectedPost) return;

    const newReply: FAQReply = {
      id: `rep_${Date.now()}`,
      authorId: currentUser.id,
      content: replyText.trim(),
      timestamp: Date.now()
    };

    const updatedPost: FAQPost = {
      ...selectedPost,
      replies: [...(selectedPost.replies || []), newReply]
    };

    const updatedAll = posts.map(p => p.id === updatedPost.id ? updatedPost : p);
    setPosts(updatedAll);
    setSelectedPost(updatedPost);
    await saveFAQPosts(updatedAll);
    setReplyText('');
  };

  // Handle emoji reaction
  const handleReact = async (postId: string, emoji: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const target = posts.find(p => p.id === postId);
    if (!target) return;

    const reactions = { ...(target.reactions || {}) };
    const currentList = reactions[emoji] || [];
    const hasReacted = (currentList || []).includes(currentUser.id);

    if (hasReacted) {
      reactions[emoji] = currentList.filter(uid => uid !== currentUser.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...currentList, currentUser.id];
    }

    const updatedPost = { ...target, reactions };
    const updatedAll = posts.map(p => p.id === postId ? updatedPost : p);
    setPosts(updatedAll);
    if (selectedPost?.id === postId) setSelectedPost(updatedPost);
    await saveFAQPosts(updatedAll);
  };

  return (
    <div className="w-full bg-[#1e1f22] text-zinc-100 rounded-2xl overflow-hidden shadow-2xl border border-[#2b2d31] font-sans">
      
      {/* Discord-style Forum Header */}
      <div className="bg-[#2b2d31] border-b border-[#1f2023] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center text-white font-bold text-xl shadow-md">
            <Hash size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">faq-and-announcements</h2>
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-[#35373c] text-zinc-400 border border-zinc-700">Forum</span>
            </div>
            <p className="text-xs text-zinc-400">Official answers, guides, and feature updates from staff & owner</p>
          </div>
        </div>

        {/* Action Controls for Staff/Owner */}
        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && editRequests.length > 0 && (
            <button
              onClick={() => setShowRequestsPanel(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg relative"
            >
              <ShieldCheck size={14} /> Requests ({editRequests.length})
            </button>
          )}
          {isStaffOrOwner && (
            <>
              <button
                onClick={() => setShowCategoriesModal(true)}
                className="px-3.5 py-2 bg-[#35373c] hover:bg-[#404249] text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-zinc-700/60"
                title="Customize Forum Categories"
              >
                <Settings size={14} /> Manage Categories
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow transition-all hover:scale-[1.02]"
              >
                <Plus size={16} /> New FAQ Post
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Forum Content */}
      <div className="p-4 md:p-6 space-y-6">

        {/* If viewing a single thread */}
        {selectedPost ? (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Back button */}
            <button
              onClick={() => setSelectedPost(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] transition-colors w-max"
            >
              <ChevronLeft size={16} /> Back to all discussions
            </button>

            {/* Check Registered Only View Constraint */}
            {selectedPost.registeredOnly && !currentUser ? (
              <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto my-6 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-2xl">
                  <Lock size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Registered Members Only</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    This forum discussion has been restricted to registered members. Please log in or create an account to view and participate.
                  </p>
                </div>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold rounded-xl transition-colors shadow-md"
                >
                  Log In or Register
                </button>
              </div>
            ) : (
              <>
                {/* Thread Original Post */}
                <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 shadow-md relative">
                  {/* Category tag, Pin badge, Members-only badge */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {selectedPost.pinned && (
                      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/40 border border-amber-600/40 px-2.5 py-0.5 rounded-full">
                        <Pin size={12} /> Pinned
                      </span>
                    )}
                    {selectedPost.registeredOnly && (
                      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/40 border border-purple-600/40 px-2.5 py-0.5 rounded-full">
                        <Lock size={12} /> Registered Only
                      </span>
                    )}
                    {selectedPost.allowReplies === false && (
                      <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-800/80 border border-zinc-700 px-2.5 py-0.5 rounded-full">
                        <Lock size={12} /> Comments Disabled
                      </span>
                    )}
                    {(() => {
                      const cat = getCategory(selectedPost.categoryId);
                      return cat ? (
                        <span 
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 border"
                          style={{ backgroundColor: `${cat.color}20`, borderColor: `${cat.color}60`, color: cat.color }}
                        >
                          <span>{cat.icon || '🏷️'}</span> {cat.name}
                        </span>
                      ) : null;
                    })()}

                    {isStaffOrOwner && (
                      <button
                        onClick={() => handleDeletePost(selectedPost.id)}
                        className="ml-auto text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#35373c] transition-colors"
                        title="Delete Thread"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {(isOwner || isStaff || (currentUser && selectedPost.authorId === currentUser.id)) && (
                      <button
                        onClick={() => handleEditPost(selectedPost)}
                        className={`text-zinc-500 hover:text-blue-400 p-1.5 rounded-lg hover:bg-[#35373c] transition-colors ${!isStaffOrOwner && currentUser?.id === selectedPost.authorId ? 'ml-auto' : ''}`}
                        title="Edit Thread"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="text-xl md:text-2xl font-extrabold text-white mb-4 leading-snug">
                    {selectedPost.title}
                  </h1>

                  {/* Author Row */}
                  <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#35373c]/70">
                    {(() => {
                      const author = getAuthor(selectedPost.authorId);
                      const isOwnerPost = author?.role === 'owner';
                      const isStaffPost = author?.role === 'staff';
                      return (
                        <>
                          {author?.avatarUrl ? (
                            <img src={author.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-zinc-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white">
                              {author?.username?.charAt(0) || 'S'}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">{author?.username || 'Staff Team'}</span>
                              {isOwnerPost ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700/50">
                                  <Crown size={11} /> Owner
                                </span>
                              ) : isStaffPost ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                                  <ShieldCheck size={11} /> Staff
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#35373c] text-zinc-400">
                                  Member
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400">
                              {new Date(selectedPost.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(selectedPost.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Attached Media (Image or Video) */}
                  {selectedPost.mediaUrl && (
                    <div className="mb-6 rounded-xl overflow-hidden bg-black/40 border border-[#35373c] flex items-center justify-center max-h-[460px]">
                      {selectedPost.mediaType === 'video' || selectedPost.mediaUrl.match(/\.(mp4|webm|mov|m4v)($|\?)/i) ? (
                        <video controls src={selectedPost.mediaUrl} className="w-full max-h-[460px] object-contain rounded-xl" />
                      ) : (
                        <img src={selectedPost.mediaUrl} alt="Post attachment" className="w-full max-h-[460px] object-contain rounded-xl" />
                      )}
                    </div>
                  )}

                  {/* Rich Body Content (Bold, Italic, Strikethrough, Code, Lists, Preserved Newlines) */}
                  <ForumRichText content={selectedPost.content} className="text-zinc-200 text-sm md:text-base leading-relaxed mb-6" />

                  {/* Reactions Bar */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#35373c]/50">
                    {['👍', '❤️', '💡', '🔥', '🎉'].map(emoji => {
                      const count = (selectedPost.reactions?.[emoji] || []).length;
                      const active = currentUser && (selectedPost.reactions?.[emoji] || []).includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReact(selectedPost.id, emoji)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                            active 
                              ? 'bg-[#5865F2]/20 border-[#5865F2] text-white' 
                              : 'bg-[#232428] border-zinc-800 text-zinc-300 hover:bg-[#35373c]'
                          }`}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className="font-bold">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Replies Section */}
                <div className="bg-[#2b2d31] border border-[#35373c] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare size={16} /> Discussion & Comments ({selectedPost.replies?.length || 0})
                    </h3>
                    {selectedPost.allowReplies === false && (
                      <span className="text-xs text-amber-400 font-semibold flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-700/50">
                        <Lock size={12} /> Comments Disabled
                      </span>
                    )}
                  </div>

                  {/* Replies List */}
                  <div className="space-y-3">
                    {selectedPost.replies?.map(reply => {
                      const repAuthor = getAuthor(reply.authorId);
                      const isRepOwner = repAuthor?.role === 'owner';
                      const isRepStaff = repAuthor?.role === 'staff';
                      return (
                        <div key={reply.id} className="p-3.5 bg-[#232428] border border-[#35373c]/60 rounded-xl flex gap-3">
                          {repAuthor?.avatarUrl ? (
                            <img src={repAuthor.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border border-zinc-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#5865F2] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {repAuthor?.username?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-xs text-white">@{repAuthor?.handle || 'user'}</span>
                              {isRepOwner && (
                                <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-red-900/60 text-red-300 border border-red-700/50">
                                  Owner
                                </span>
                              )}
                              {isRepStaff && (
                                <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                                  Staff
                                </span>
                              )}
                              <span className="text-[11px] text-zinc-500">
                                {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <ForumRichText content={reply.content} className="text-sm text-zinc-200" />
                          </div>
                        </div>
                      );
                    })}
                    {(!selectedPost.replies || selectedPost.replies.length === 0) && (
                      <p className="text-xs text-zinc-500 py-3 italic">No comments yet.</p>
                    )}
                  </div>

                  {/* Reply Composer or Locked Notice */}
                  {selectedPost.allowReplies === false ? (
                    <div className="p-4 bg-[#232428] border border-[#35373c] rounded-xl text-zinc-400 text-xs flex items-center gap-2.5">
                      <Lock size={16} className="text-amber-400 shrink-0" />
                      <span>Comments have been disabled for this thread by the author.</span>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-[#35373c] space-y-2">
                      <div className="border border-[#35373c] rounded-xl overflow-hidden bg-[#1e1f22]">
                        <ForumToolbar
                          onInsert={(prefix, suffix, placeholder) => 
                            insertFormatting(replyTextareaRef, replyText, setReplyText, prefix, suffix, placeholder)
                          }
                          isPreview={isReplyPreview}
                          onTogglePreview={() => setIsReplyPreview(!isReplyPreview)}
                        />
                        {isReplyPreview ? (
                          <div className="p-3.5 min-h-[72px] text-sm text-white bg-[#1e1f22]">
                            {replyText.trim() ? (
                              <ForumRichText content={replyText} />
                            ) : (
                              <span className="text-zinc-500 italic">Preview of your reply will appear here...</span>
                            )}
                          </div>
                        ) : (
                          <textarea
                            ref={replyTextareaRef}
                            rows={3}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => {
                              // Enter alone inserts a newline as requested
                              // Ctrl+Enter or Cmd+Enter submits
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleAddReply();
                              }
                            }}
                            placeholder={`Reply to #${selectedPost.title.slice(0, 24)}... (Press Enter for new line)`}
                            className="w-full bg-[#1e1f22] p-3 text-sm text-white placeholder-zinc-500 focus:outline-none resize-none"
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-zinc-500">Press <b>Enter</b> for new line • <b>Ctrl+Enter</b> or click Send</span>
                        <button
                          onClick={handleAddReply}
                          disabled={!replyText.trim()}
                          className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0 shadow"
                        >
                          <Send size={14} /> Send Reply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Search and Category Filter Bar */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search FAQ titles, keywords, or guides..."
                  className="w-full bg-[#2b2d31] border border-[#35373c] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#5865F2] transition-colors"
                />
              </div>

              {/* Category Tags Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                <button
                  onClick={() => setActiveCategoryId(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                    activeCategoryId === null 
                      ? 'bg-white text-zinc-950 border-white font-bold' 
                      : 'bg-[#2b2d31] text-zinc-300 border-[#35373c] hover:bg-[#35373c]'
                  }`}
                >
                  All Categories ({posts.length})
                </button>
                {categories.map(cat => {
                  const isActive = activeCategoryId === cat.id;
                  const catPostCount = posts.filter(p => p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all border ${
                        isActive 
                          ? 'text-white shadow-sm' 
                          : 'bg-[#2b2d31] text-zinc-300 border-[#35373c] hover:bg-[#35373c]'
                      }`}
                      style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                    >
                      <span>{cat.icon || '🏷️'}</span>
                      <span>{cat.name}</span>
                      <span className="text-[10px] opacity-70">({catPostCount})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Posts Grid / List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPosts.map(post => {
                const cat = getCategory(post.categoryId);
                const author = getAuthor(post.authorId);
                const isOwnerPost = author?.role === 'owner';
                const isStaffPost = author?.role === 'staff';
                const replyCount = post.replies?.length || 0;
                
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="bg-[#2b2d31] hover:bg-[#35373c] border border-[#35373c] hover:border-[#5865F2]/50 rounded-2xl p-5 cursor-pointer transition-all duration-150 flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      {/* Top tags */}
                      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                        {post.pinned && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-400 bg-amber-950/40 border border-amber-600/40 px-2 py-0.5 rounded-md">
                            <Pin size={11} /> Pinned
                          </span>
                        )}
                        {post.registeredOnly && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-purple-400 bg-purple-950/40 border border-purple-600/40 px-2 py-0.5 rounded-md">
                            <Lock size={11} /> Registered Only
                          </span>
                        )}
                        {post.mediaUrl && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-cyan-400 bg-cyan-950/40 border border-cyan-600/40 px-2 py-0.5 rounded-md">
                            {post.mediaType === 'video' ? <VideoIcon size={11} /> : <Paperclip size={11} />}
                            {post.mediaType === 'video' ? 'Video' : 'Media'}
                          </span>
                        )}
                        {post.allowReplies === false && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-zinc-400 bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 rounded-md">
                            No Comments
                          </span>
                        )}
                        {cat && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border"
                            style={{ backgroundColor: `${cat.color}20`, borderColor: `${cat.color}60`, color: cat.color }}
                          >
                            <span>{cat.icon || '🏷️'}</span> {cat.name}
                          </span>
                        )}
                      </div>

                      {/* Post Title */}
                      <h3 className="font-bold text-white text-base md:text-lg mb-2 group-hover:text-[#5865F2] transition-colors line-clamp-2">
                        {post.title}
                      </h3>

                      {/* Content Preview */}
                      <p className="text-xs text-zinc-300 line-clamp-3 mb-4 leading-relaxed">
                        {post.content}
                      </p>
                    </div>

                    {/* Footer Row */}
                    <div className="pt-3 border-t border-[#35373c]/60 flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        {author?.avatarUrl ? (
                          <img src={author.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#5865F2] text-white text-[10px] flex items-center justify-center font-bold">
                            {author?.username?.charAt(0) || 'S'}
                          </div>
                        )}
                        <span className="font-semibold text-zinc-300">@{author?.handle || 'staff'}</span>
                        {isOwnerPost && <Crown size={12} className="text-red-400" title="Owner" />}
                        {isStaffPost && <ShieldCheck size={12} className="text-blue-400" title="Staff" />}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={13} /> {replyCount}
                        </span>
                        <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPosts.length === 0 && (
                <div className="col-span-full py-16 text-center text-zinc-400">
                  <Hash size={36} className="mx-auto mb-2 text-zinc-600" />
                  <p className="font-semibold text-base">No FAQ threads found.</p>
                  <p className="text-xs text-zinc-500 mt-1">Try searching for a different keyword or view all categories.</p>
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Modal: Create New FAQ Thread */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#313338] border border-[#3d3f45] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#3d3f45] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Plus size={18} className="text-[#5865F2]" /> New FAQ Post (Staff / Owner)
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Post Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. How to get verified / How friends work..."
                  className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon || '🏷️'} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Content / Answer (Markdown & Formatting)</label>
                <div className="border border-[#3d3f45] rounded-xl overflow-hidden bg-[#1e1f22]">
                  <ForumToolbar
                    onInsert={(prefix, suffix, placeholder) =>
                      insertFormatting(postTextareaRef, newContent, setNewContent, prefix, suffix, placeholder)
                    }
                    isPreview={isPreviewMode}
                    onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
                  />
                  {isPreviewMode ? (
                    <div className="p-3.5 min-h-[140px] max-h-[220px] overflow-y-auto text-sm text-white bg-[#1e1f22]">
                      {newContent.trim() ? (
                        <ForumRichText content={newContent} />
                      ) : (
                        <span className="text-zinc-500 italic">Preview will appear here...</span>
                      )}
                    </div>
                  ) : (
                    <textarea
                      ref={postTextareaRef}
                      required
                      rows={6}
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      placeholder="Type the full FAQ guidance, details, or announcement... (Press Enter to start a new line)"
                      className="w-full bg-[#1e1f22] p-3 text-sm text-white resize-none focus:outline-none"
                    />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Press <b>Enter</b> to start a new line. Use the toolbar buttons for Bold, Italic, Strikethrough, Code, and Lists.</p>
              </div>

              {/* Media Attachment (Image or Video) */}
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1 flex items-center justify-between">
                  <span>Attach Image or Video (Optional)</span>
                  {mediaUrl && (
                    <button
                      type="button"
                      onClick={() => { setMediaUrl(''); setMediaType(null); }}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Remove Attachment
                    </button>
                  )}
                </label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleMediaUpload}
                  accept="image/*,video/*"
                  className="hidden"
                />

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 bg-[#2b2d31] hover:bg-[#35373c] text-xs font-semibold text-zinc-200 rounded-xl border border-zinc-700/70 flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Paperclip size={14} /> Choose File
                    </button>
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={e => {
                        setMediaUrl(e.target.value);
                        if (e.target.value.match(/\.(mp4|webm|mov|m4v)($|\?)/i)) {
                          setMediaType('video');
                        } else if (e.target.value) {
                          setMediaType('image');
                        } else {
                          setMediaType(null);
                        }
                      }}
                      placeholder="Or paste direct image / video URL..."
                      className="flex-1 bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                    />
                  </div>

                  {mediaUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-black/40 max-h-40 flex items-center justify-center p-1">
                      {mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mov|m4v)($|\?)/i) ? (
                        <video src={mediaUrl} controls className="max-h-36 rounded-lg object-contain" />
                      ) : (
                        <img src={mediaUrl} alt="Attached Preview" className="max-h-36 rounded-lg object-contain" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Post Controls */}
              <div className="space-y-2.5 pt-1 bg-[#2b2d31]/60 p-3 rounded-xl border border-[#3d3f45]/70">
                <div className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider">Post Permissions & Visibility</div>
                
                {/* Pin Post */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pinCheck"
                    checked={isPinned}
                    onChange={e => setIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5865F2] focus:ring-0 bg-[#1e1f22] border-zinc-700"
                  />
                  <label htmlFor="pinCheck" className="text-xs font-semibold text-zinc-300 cursor-pointer flex items-center gap-1.5">
                    <Pin size={13} className="text-amber-400" /> Pin this thread to top of forum
                  </label>
                </div>

                {/* Enable Comments / Replies */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowRepliesCheck"
                    checked={allowReplies}
                    onChange={e => setAllowReplies(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5865F2] focus:ring-0 bg-[#1e1f22] border-zinc-700"
                  />
                  <label htmlFor="allowRepliesCheck" className="text-xs font-semibold text-zinc-300 cursor-pointer flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-emerald-400" /> Allow comments & replies on this post
                  </label>
                </div>

                {/* Registered users only */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="regOnlyCheck"
                    checked={registeredOnly}
                    onChange={e => setRegisteredOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5865F2] focus:ring-0 bg-[#1e1f22] border-zinc-700"
                  />
                  <label htmlFor="regOnlyCheck" className="text-xs font-semibold text-zinc-300 cursor-pointer flex items-center gap-1.5">
                    <Lock size={13} className="text-purple-400" /> Only allow registered users to view this post
                  </label>
                </div>

                {/* Announce to everyone */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="announceCheck"
                    checked={announceToEveryone}
                    onChange={e => setAnnounceToEveryone(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5865F2] focus:ring-0 bg-[#1e1f22] border-zinc-700"
                  />
                  <label htmlFor="announceCheck" className="text-xs font-semibold text-zinc-300 cursor-pointer flex items-center gap-1.5">
                    <span className="text-sm">📢</span> Announce this new forum to everyone (offline users get notified when online)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 bg-[#2b2d31] hover:bg-[#35373c] text-zinc-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  Publish FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Customize Categories */}
      {showCategoriesModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#313338] border border-[#3d3f45] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto hide-scrollbar">
            <div className="flex items-center justify-between border-b border-[#3d3f45] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Settings size={18} className="text-[#5865F2]" /> Manage Forum Categories
              </h3>
              <button onClick={() => setShowCategoriesModal(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Existing Categories */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-zinc-400">Current Categories</label>
              {categories.map(c => (
                <div key={c.id} className="p-3 bg-[#232428] rounded-xl border border-[#3d3f45] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{c.icon || '🏷️'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{c.name}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      </div>
                      {c.description && <p className="text-[11px] text-zinc-400">{c.description}</p>}
                    </div>
                  </div>
                  {categories.length > 1 && (
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#35373c] transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Category */}
            <form onSubmit={handleAddCategory} className="pt-3 border-t border-[#3d3f45] space-y-3">
              <label className="block text-xs font-bold uppercase text-zinc-400">Create New Category</label>
              
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] text-zinc-400 mb-1">Emoji</label>
                  <input
                    type="text"
                    value={catIcon}
                    onChange={e => setCatIcon(e.target.value)}
                    className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl p-2 text-center text-sm text-white"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] text-zinc-400 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={e => setCatName(e.target.value)}
                    placeholder="e.g. Creator Tools"
                    className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Tag Color</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCatColor(color)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ 
                        backgroundColor: color, 
                        borderColor: catColor === color ? '#ffffff' : 'transparent' 
                      }}
                    >
                      {catColor === color && <Check size={12} className="text-black stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={catDesc}
                  onChange={e => setCatDesc(e.target.value)}
                  placeholder="Short description of this category topic"
                  className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold transition-colors"
              >
                + Add Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit FAQ Thread */}
      {showEditModal && editingPost && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#313338] border border-[#3d3f45] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#3d3f45] pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Edit3 size={18} className="text-[#5865F2]" /> {isStaffEditing ? 'Request Approval for Edit' : 'Edit FAQ Post'}
              </h3>
              <button onClick={() => { setShowEditModal(false); setEditingPost(null); }} className="text-zinc-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {isStaffEditing && (
              <div className="bg-amber-900/30 border border-amber-600/50 p-4 rounded-xl flex gap-3 items-start">
                <ShieldCheck size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong className="block mb-0.5">Staff Edit Policy:</strong>
                  You are proposing an edit to someone else's post. This will be sent to the **Owner** for final approval before taking effect.
                </div>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Post Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon || '🏷️'} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Content / Answer (Markdown & Formatting)</label>
                <div className="border border-[#3d3f45] rounded-xl overflow-hidden bg-[#1e1f22]">
                  <ForumToolbar
                    onInsert={(prefix, suffix, placeholder) =>
                      insertFormatting(postTextareaRef, newContent, setNewContent, prefix, suffix, placeholder)
                    }
                    isPreview={isPreviewMode}
                    onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
                  />
                  {isPreviewMode ? (
                    <div className="p-3.5 min-h-[140px] max-h-[220px] overflow-y-auto text-sm text-white bg-[#1e1f22]">
                      <ForumRichText content={newContent} />
                    </div>
                  ) : (
                    <textarea
                      ref={postTextareaRef}
                      required
                      rows={6}
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="w-full bg-[#1e1f22] p-3 text-sm text-white resize-none focus:outline-none"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-300 mb-1">Attachment URL (Optional)</label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="Image or video URL..."
                  className="w-full bg-[#1e1f22] border border-[#3d3f45] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>

              <div className="space-y-2.5 pt-1 bg-[#2b2d31]/60 p-3 rounded-xl border border-[#3d3f45]/70">
                <div className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider">Post Controls</div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="editPinCheck" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22] border-zinc-700" />
                    <label htmlFor="editPinCheck" className="text-xs font-semibold text-zinc-300 cursor-pointer">Pin</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="editAllowReplies" checked={allowReplies} onChange={e => setAllowReplies(e.target.checked)} className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22] border-zinc-700" />
                    <label htmlFor="editAllowReplies" className="text-xs font-semibold text-zinc-300 cursor-pointer">Allow Comments</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="editRegOnly" checked={registeredOnly} onChange={e => setRegisteredOnly(e.target.checked)} className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22] border-zinc-700" />
                    <label htmlFor="editRegOnly" className="text-xs font-semibold text-zinc-300 cursor-pointer">Registered Only</label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold">Cancel</button>
                <button type="submit" className="px-8 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl text-sm transition-all shadow-lg flex items-center gap-2">
                  {isStaffEditing ? <Send size={16} /> : <Check size={16} />}
                  {isStaffEditing ? 'Submit for Approval' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Requests (Owner Only) */}
      {showRequestsPanel && isOwner && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#313338] border border-[#3d3f45] w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85dvh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-[#3d3f45] pb-3 shrink-0">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-amber-500" /> Pending Staff Edit Requests ({editRequests.length})
              </h3>
              <button onClick={() => setShowRequestsPanel(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 hide-scrollbar">
              {editRequests.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">No pending edit requests.</div>
              ) : (
                editRequests.map(req => {
                  const staff = getAuthor(req.staffId);
                  const post = posts.find(p => p.id === req.postId);
                  return (
                    <div key={req.id} className="bg-[#2b2d31] border border-[#3d3f45] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#1f2023] pb-2">
                        <div className="flex items-center gap-2">
                          <img src={staff?.avatarUrl} alt="" className="w-7 h-7 rounded-full border border-zinc-700" />
                          <div>
                            <p className="text-xs font-bold text-white">@{staff?.handle} requested an edit</p>
                            <p className="text-[10px] text-zinc-500">{new Date(req.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleRejectEdit(req.id)} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold">Reject</button>
                          <button onClick={() => handleApproveEdit(req)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">Approve</button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <p className="text-zinc-500 uppercase font-bold text-[9px] mb-0.5">Original Post</p>
                          <p className="text-zinc-300 italic truncate">"{post?.title}"</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 uppercase font-bold text-[9px] mb-0.5">Proposed Title</p>
                          <p className="text-white font-bold">{req.proposedTitle}</p>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-zinc-500 uppercase font-bold text-[9px] mb-0.5">Proposed Changes</p>
                        <div className="bg-[#1e1f22] p-2 rounded-lg border border-[#3d3f45] text-xs text-zinc-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {req.proposedContent}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
