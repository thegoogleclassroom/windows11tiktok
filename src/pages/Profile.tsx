import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Cropper from 'react-easy-crop';
import { 
  getUsers, getVideos, saveUsers, deleteVideoFromDB, getAppeals, saveAppeals, 
  updateUser, submitVerificationRequest 
} from '../lib/db';
import { User, Video, Appeal } from '../types';
import { useAppStore } from '../store';
import { isFriend } from '../lib/utils';
import { compressImage } from '../lib/imageUtils';
import { 
  Settings, Play, Edit3, Grid, Heart, X, Upload, Bookmark, Flag, 
  Hammer, Wrench, Check, Trash2, HelpCircle, Users, Lock, Image as ImageIcon, LogOut,
  AlertTriangle, Send, ShieldCheck, Trophy, Phone, Video as VideoIcon, Eye, EyeOff, Key, User as UserIcon, Sparkles, FileX
} from 'lucide-react';
import { VideoItem } from './Home';
import { HolographicBadge, CentralProBadge } from '../components/UIPolish';

// Helper for cropping
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(resolve => image.onload = resolve);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return canvas.toDataURL('image/jpeg');
};

export function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const { currentUser, setCurrentUser, setIsCalling, setCallData } = useAppStore();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [favoriteVideos, setFavoriteVideos] = useState<Video[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'liked' | 'favorites' | 'removed'>('videos');
  const [showEdit, setShowEdit] = useState(false);
  const [showThemePreview, setShowThemePreview] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [appealVideo, setAppealVideo] = useState<Video | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [myAppeals, setMyAppeals] = useState<Appeal[]>([]);
  const [removedVideos, setRemovedVideos] = useState<Video[]>([]);

  const areFriends = isFriend(currentUser, profileUser);
  const isOwnProfile = currentUser?.id === profileUser?.id;
  const isStaffOrOwner = currentUser?.role === 'owner' || currentUser?.role === 'staff';

  const loadProfile = async () => {
    const users = await getUsers();
    const user = users.find(u => u.handle === handle);
    if (user) {
      setProfileUser(user);
      setIsFollowing((currentUser?.following || []).includes(user.id) || false);
      
      const allVideos = await getVideos();
      const userVideos = allVideos.filter(v => v.userId === user.id && !v.isRemoved);
      const userRemovedVideos = allVideos.filter(v => v.userId === user.id && v.isRemoved);
      const userLikedVideos = allVideos.filter(v => (v.likes || []).includes(user.id) && !v.isRemoved);
      const userFavoriteVideos = allVideos.filter(v => (user.favorites || []).includes(v.id) && !v.isRemoved);
      
      const fixUrl = (v: Video) => ({
        ...v,
        videoUrl: v.videoData ? URL.createObjectURL(v.videoData) : v.videoUrl
      });

      const isOwnerView = currentUser?.id === user.id;
      const isMutual = isFriend(currentUser, user);

      // Filter based on visibility settings
      const visibleVideos = userVideos.filter(v => {
        if (isOwnerView || isStaffOrOwner) return true;
        if (v.visibility === 'only_you') return false;
        if (v.visibility === 'friends' && !isMutual) return false;
        return true;
      });
      
      setVideos(visibleVideos.map(fixUrl).sort((a, b) => b.timestamp - a.timestamp));
      setRemovedVideos(userRemovedVideos.map(fixUrl).sort((a, b) => b.timestamp - a.timestamp));
      setLikedVideos(userLikedVideos.map(fixUrl).sort((a, b) => b.timestamp - a.timestamp));
      setFavoriteVideos(userFavoriteVideos.map(fixUrl).sort((a, b) => b.timestamp - a.timestamp));

      if (isOwnerView) {
        const allAppeals = await getAppeals();
        setMyAppeals(allAppeals.filter(a => a.userId === user.id && a.videoId));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [handle, currentUser, showEdit]);

  const handleFollow = async () => {
    if (!currentUser || !profileUser) return;
    
    const isNowFollowing = !isFollowing;
    
    try {
      // Update Current User (following array)
      const newFollowing = isNowFollowing 
        ? [...(currentUser.following || []), profileUser.id]
        : (currentUser.following || []).filter(id => id !== profileUser.id);
      
      await updateUser(currentUser.id, { following: newFollowing });
      
      // Update Profile User (followers array)
      const newFollowers = isNowFollowing
        ? [...(profileUser.followers || []), currentUser.id]
        : (profileUser.followers || []).filter(id => id !== currentUser.id);
        
      await updateUser(profileUser.id, { followers: newFollowers });

      // Update Local State
      setCurrentUser({ ...currentUser, following: newFollowing });
      setProfileUser({ ...profileUser, followers: newFollowers });
      setIsFollowing(isNowFollowing);
    } catch (err) {
      console.error("Error toggling follow:", err);
      alert("Failed to update follow status. Please try again.");
    }
  };

  const handleReport = () => {
    alert(`User ${profileUser?.username} has been reported. Our team will review this account.`);
  };

  const handleSubmitAppeal = async () => {
    if (!currentUser || !appealVideo || !appealReason.trim()) return;
    setIsSubmittingAppeal(true);
    try {
      const appeals = await getAppeals();
      const newAppeal: Appeal = {
        id: `app_${Date.now()}`,
        userId: currentUser.id,
        videoId: appealVideo.id,
        reason: appealReason.trim(),
        status: 'pending',
        timestamp: Date.now()
      };
      appeals.push(newAppeal);
      await saveAppeals(appeals);
      setMyAppeals(prev => [newAppeal, ...prev]);
      setAppealVideo(null);
      setAppealReason('');
      alert("Appeal submitted successfully! Moderators will review it shortly.");
    } catch (err) {
      console.error(err);
      alert("Failed to submit appeal. Please try again.");
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) return;
    await deleteVideoFromDB(videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setLikedVideos(prev => prev.filter(v => v.id !== videoId));
    setFavoriteVideos(prev => prev.filter(v => v.id !== videoId));
    if (selectedVideo?.id === videoId) setSelectedVideo(null);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!profileUser) return <div className="p-8 text-center text-zinc-500">User not found</div>;

  return (
    <div className="w-full h-full overflow-y-auto hide-scrollbar pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto border-x border-zinc-200 dark:border-zinc-800 min-h-screen">
        
        {/* Profile Banner (CentralPro or custom) */}
        {profileUser.profileBannerUrl && !profileUser.isSystemWiped && (
          <div className="w-full h-36 md:h-48 overflow-hidden relative">
            <img 
              src={profileUser.profileBannerUrl} 
              alt="Banner" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        {/* Profile Header */}
        <div className={`px-4 pb-6 flex flex-col md:flex-row items-center md:items-start gap-6 border-b border-zinc-200 dark:border-zinc-800 ${profileUser.profileBannerUrl && !profileUser.isSystemWiped ? 'pt-4 -mt-12 relative z-10' : 'pt-12'}`}>
          <div className="relative group">
            {profileUser.isSystemWiped ? (
              /* Wiped Out Avatar: White background with a folded paper corner on top right and an X on the paper */
              <div 
                className="w-28 h-28 rounded-3xl bg-white border-2 border-zinc-300 dark:border-zinc-600 shadow-2xl relative flex items-center justify-center overflow-hidden"
                title="Account Deleted"
              >
                {/* Folded corner top-right */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-200 dark:bg-zinc-300 border-b border-l border-zinc-400 shadow-sm" style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
                <div className="absolute top-0 right-0 w-8 h-8 bg-zinc-100 dark:bg-zinc-950" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                
                {/* Paper with X */}
                <div className="flex flex-col items-center justify-center text-zinc-800">
                  <div className="relative">
                    <FileX size={44} className="text-zinc-700 stroke-[2.2]" />
                  </div>
                  <span className="text-[9px] font-black tracking-widest uppercase text-red-600 mt-0.5">WIPED</span>
                </div>
              </div>
            ) : profileUser.avatarUrl ? (
              <img src={profileUser.avatarUrl} alt={profileUser.username} className="w-28 h-28 rounded-full border-2 border-zinc-200 dark:border-zinc-800 object-cover shadow-lg bg-zinc-900" />
            ) : (
              <div className="w-28 h-28 rounded-full border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-800 flex items-center justify-center">
                <span className="text-zinc-500 font-bold text-2xl">{profileUser.username.charAt(0)}</span>
              </div>
            )}
            {!profileUser.isSystemWiped && profileUser.currentGame && profileUser.showActivityStatus !== false && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-white dark:border-zinc-950 animate-pulse" title={`Playing ${profileUser.currentGame}`} />
            )}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-1 flex-wrap">
              <h1 className={`text-2xl font-bold flex items-center gap-1.5 ${profileUser.isSystemWiped ? 'text-zinc-400 font-mono tracking-tight' : profileUser.displayNameFont || ''}`}>
                {profileUser.isSystemWiped ? 'Account Deleted' : profileUser.username}
                {profileUser.isVerified && !profileUser.isSystemWiped && <HolographicBadge />}
                {profileUser.isCentralPro && !profileUser.isSystemWiped && <CentralProBadge />}
              </h1>
              {areFriends && !isOwnProfile && (
                <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                  <Users size={12} /> Friends
                </span>
              )}
              {profileUser.role === 'owner' && (
                <div className="flex gap-0.5 text-red-500" title="Owner">
                  <Hammer size={20} />
                  <Wrench size={20} />
                </div>
              )}
              {profileUser.role === 'staff' && (
                <div className="flex gap-0.5 text-blue-500" title="Staff">
                  <Hammer size={20} />
                  <Wrench size={20} />
                </div>
              )}
              
              {/* Badges Section */}
              {profileUser.badges && profileUser.badges.length > 0 && (
                <div className="flex gap-2 ml-2">
                  {profileUser.badges.map(badge => (
                    <div 
                      key={badge} 
                      title={`${badge} Badge`}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                        badge === 'Tradient' 
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20' 
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {badge === 'Tradient' ? <ShieldCheck size={12} /> : <Trophy size={12} />}
                      {badge}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
              <p className="text-zinc-500 font-semibold">@{profileUser.handle}</p>
              {profileUser.currentGame && profileUser.showActivityStatus !== false && (
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                  Playing {profileUser.currentGame}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-center md:justify-start gap-6 mb-4">
              <div className="text-center">
                <span className="font-bold block">{(profileUser.following || []).length}</span>
                <span className="text-zinc-500 text-sm">Following</span>
              </div>
              <div className="text-center">
                <span className="font-bold block">{(profileUser.followers || []).length}</span>
                <span className="text-zinc-500 text-sm">Followers</span>
              </div>
              <div className="text-center">
                <span className="font-bold block">{videos.reduce((acc, v) => acc + (v.likes || []).length, 0)}</span>
                <span className="text-zinc-500 text-sm">Likes</span>
              </div>
            </div>
            
            <p className="mb-4 whitespace-pre-wrap">{profileUser.bio}</p>
            
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              {isOwnProfile ? (
                <>
                  <button onClick={() => setShowEdit(true)} className="px-6 py-2 border border-zinc-300 dark:border-zinc-700 font-semibold rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center gap-2">
                    <Edit3 size={18} /> Edit profile
                  </button>
                  <button onClick={() => setShowThemePreview(true)} className="px-4 py-2 border border-pink-500/50 bg-pink-500/10 text-pink-600 dark:text-pink-400 font-semibold rounded-md hover:bg-pink-500/20 transition-colors flex items-center gap-1.5" title="Theme Studio Preview">
                    <Sparkles size={18} /> Theme
                  </button>
                  <button onClick={() => setShowEdit(true)} className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 font-semibold rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <Settings size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleFollow}
                    className={`px-8 py-2 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                      isFollowing 
                        ? areFriends 
                          ? 'border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900' 
                        : 'bg-pink-600 text-white hover:bg-pink-700'
                    }`}
                  >
                    {isFollowing ? (areFriends ? <><Users size={16} /> Friends</> : 'Following') : 'Follow'}
                  </button>
                  <Link to={`/messages/${profileUser.handle}`} className="px-6 py-2 border border-zinc-300 dark:border-zinc-700 font-semibold rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    Message
                  </Link>
                  {areFriends && (
                    <button 
                      onClick={() => {
                        setCallData({ user: profileUser, type: 'voice' });
                        setIsCalling(true);
                      }} 
                      className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 font-semibold rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center text-blue-500"
                    >
                      <Phone size={18} />
                    </button>
                  )}
                  <button onClick={handleReport} className="px-4 py-2 border border-red-200 text-red-500 dark:border-red-900/50 dark:text-red-400 font-semibold rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center justify-center">
                    <Flag size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button 
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'videos' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
          >
            <Grid size={18} /> Posts
          </button>
          {(!profileUser.isPrivate || isOwnProfile || isFollowing) && (
            <button 
              onClick={() => setActiveTab('liked')}
              className={`flex-1 py-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'liked' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
            >
              <Heart size={18} /> Liked
            </button>
          )}
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 py-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'favorites' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
            >
              <Bookmark size={18} /> Favorites
            </button>
          )}
          {isOwnProfile && (
            <button 
              onClick={() => setActiveTab('removed')}
              className={`flex-1 py-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'removed' ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white' : 'text-zinc-500'}`}
            >
              <AlertTriangle size={18} /> Removed
            </button>
          )}
          <button 
            onClick={() => navigate('/forum')}
            className="flex-1 py-4 font-semibold flex items-center justify-center gap-2 text-zinc-500 hover:text-[#5865F2] transition-colors"
          >
            <HelpCircle size={18} /> Forum
          </button>
        </div>
        
        {/* Tab Content Grid */}
        <div className="grid grid-cols-3 gap-0.5 md:gap-1 p-0.5 md:p-1">
            {(() => {
              const getThemeFrameClass = (style?: string) => {
                switch (style) {
                  case 'gold':
                    return 'border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] rounded-2xl overflow-hidden';
                  case 'emerald':
                    return 'border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)] rounded-2xl overflow-hidden';
                  case 'purple':
                    return 'border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] rounded-2xl overflow-hidden';
                  case 'sunset':
                    return 'border-2 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.5)] rounded-2xl overflow-hidden';
                  case 'cyber':
                  default:
                    return 'border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.5)] rounded-2xl overflow-hidden';
                }
              };
              const items = activeTab === 'videos' ? videos : activeTab === 'liked' ? likedVideos : activeTab === 'favorites' ? favoriteVideos : removedVideos;
              return items.map(video => {
                const canDelete = currentUser?.id === video.userId || isStaffOrOwner;
                const isImage = video.mediaType === 'image';
                const hasPendingAppeal = myAppeals.some(a => a.videoId === video.id && a.status === 'pending');
                const hasRejectedAppeal = myAppeals.some(a => a.videoId === video.id && a.status === 'rejected');
                
                return (
                  <div key={video.id} className={`aspect-[3/4] relative bg-black group cursor-pointer overflow-hidden m-1 ${getThemeFrameClass(profileUser?.themeStyle)}`}>
                  <div onClick={() => setSelectedVideo(video)} className="w-full h-full">
                    {isImage ? (
                      <img src={video.videoUrl} alt={video.description} className="w-full h-full object-cover" />
                    ) : (
                      <video src={video.videoUrl} className={`w-full h-full object-cover ${video.filter || ''} ${video.isRemoved ? 'grayscale opacity-50' : ''}`} />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    
                    {/* Media Type & Privacy Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      {video.isRemoved && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg">
                          <AlertTriangle size={10} /> REMOVED
                        </span>
                      )}
                      {isImage && (
                        <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <ImageIcon size={10} /> Photo
                        </span>
                      )}
                      {video.visibility === 'friends' && (
                        <span className="bg-emerald-600/80 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Users size={10} /> Friends
                        </span>
                      )}
                      {video.visibility === 'only_you' && (
                        <span className="bg-zinc-800/90 backdrop-blur-sm text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Lock size={10} /> Only you
                        </span>
                      )}
                    </div>

                    {!video.isRemoved && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white font-semibold text-xs drop-shadow-md">
                        <Play size={14} className="fill-current" />
                        <span>{video.views || 0}</span>
                      </div>
                    )}
                  </div>

                  {/* Appeal Button for Removed Content */}
                  {video.isRemoved && isOwnProfile && !hasPendingAppeal && !hasRejectedAppeal && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAppealVideo(video);
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Send size={14} /> Appeal
                      </span>
                    </button>
                  )}

                  {video.isRemoved && hasPendingAppeal && (
                     <div className="absolute inset-0 flex items-center justify-center bg-yellow-600/40 pointer-events-none">
                        <span className="text-[10px] font-bold text-white bg-yellow-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Appeal Pending</span>
                     </div>
                  )}

                  {/* Delete Button on Hover */}
                  {canDelete && !video.isRemoved && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video.id);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Post"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            });
          })()}
          {(activeTab === 'videos' ? videos : activeTab === 'liked' ? likedVideos : activeTab === 'favorites' ? favoriteVideos : removedVideos).length === 0 && (
              <div className="col-span-3 py-20 text-center text-zinc-500">
                No posts found in this tab.
              </div>
            )}
          </div>

      </div>
      
      {showEdit && currentUser && (
        <EditProfileModal user={currentUser} onClose={() => setShowEdit(false)} />
      )}

      {/* Appeal Modal */}
      <AnimatePresence>
        {appealVideo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl text-red-600">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Appeal Content Removal</h3>
                  <p className="text-sm text-zinc-500">Video ID: {appealVideo.id.slice(0, 8)}...</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 font-semibold">Removal Reason:</p>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-950 rounded-xl text-sm italic text-zinc-700 dark:text-zinc-300">
                  "{appealVideo.removalReason || 'Violation of community standards'}"
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Your Appeal Reason</label>
                  <textarea 
                    value={appealReason}
                    onChange={e => setAppealReason(e.target.value)}
                    placeholder="Explain why your content should be restored..."
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-pink-500 rounded-2xl p-4 text-sm outline-none transition-all resize-none h-32"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setAppealVideo(null);
                      setAppealReason('');
                    }}
                    disabled={isSubmittingAppeal}
                    className="flex-1 py-3 font-bold bg-zinc-100 dark:bg-zinc-800 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors uppercase text-xs tracking-wider"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmitAppeal}
                    disabled={!appealReason.trim() || isSubmittingAppeal}
                    className="flex-1 py-3 font-bold bg-pink-600 text-white rounded-2xl hover:bg-pink-700 disabled:opacity-50 transition-colors shadow-lg shadow-pink-600/20 uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                  >
                    {isSubmittingAppeal ? 'Submitting...' : 'Send Appeal'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Playback Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-in fade-in duration-200">
          <button 
            onClick={() => setSelectedVideo(null)} 
            className="absolute top-4 left-4 z-50 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full transition-colors"
          >
            <X size={24} />
          </button>

          {/* Delete Post Button in Modal */}
          {(currentUser?.id === selectedVideo.userId || isStaffOrOwner) && (
            <button
              onClick={() => handleDeleteVideo(selectedVideo.id)}
              className="absolute top-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg"
            >
              <Trash2 size={16} /> Delete Post
            </button>
          )}

          <div className="w-full h-full max-w-[500px] relative bg-zinc-950 flex items-center justify-center">
            {selectedVideo.mediaType === 'image' ? (
              <div className="relative w-full h-full flex items-center justify-center bg-zinc-950">
                <img src={selectedVideo.videoUrl} alt="" className="max-w-full max-h-full object-contain" />
                <div className="absolute bottom-6 left-4 right-4 text-white z-10">
                  <p className="font-bold text-base mb-1">@{profileUser.handle}</p>
                  <p className="text-sm">{selectedVideo.description}</p>
                </div>
              </div>
            ) : (
              <VideoItem video={{...selectedVideo, user: profileUser}} />
            )}
          </div>
        </div>
      )}

      {showThemePreview && currentUser && (
        <ThemePreviewModal user={currentUser} onClose={() => setShowThemePreview(false)} />
      )}
    </div>
  );
}

function ThemePreviewModal({ user, onClose }: { user: User, onClose: () => void }) {
  const { setCurrentUser } = useAppStore();
  const [activeTheme, setActiveTheme] = useState(user.themeStyle || 'cyber');
  const [showLockInfo, setShowLockInfo] = useState(false);

  const isEligible = user.isVerified || user.role === 'staff' || user.role === 'owner' || (user.badges || []).includes('Tradient');

  const THEMES = [
    { id: 'cyber', name: 'Neon Cyber', free: true, color: 'from-cyan-400 to-blue-600', frameClass: 'border-4 border-cyan-400 shadow-[0_0_30px_rgba(0,242,254,0.6)]' },
    { id: 'gold', name: 'Royal Gold', free: false, color: 'from-amber-400 to-yellow-600', frameClass: 'border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]' },
    { id: 'emerald', name: 'Emerald Forest', free: false, color: 'from-emerald-400 to-green-600', frameClass: 'border-4 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)]' },
    { id: 'purple', name: 'Midnight Purple', free: false, color: 'from-purple-400 to-indigo-600', frameClass: 'border-4 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.6)]' },
    { id: 'sunset', name: 'Sunset Glow', free: false, color: 'from-pink-500 to-rose-600', frameClass: 'border-4 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.6)]' },
  ];

  const currentThemeObj = THEMES.find(t => t.id === activeTheme) || THEMES[0];
  const isLocked = !currentThemeObj.free && !isEligible;

  const handleApply = async () => {
    if (isLocked) {
      setShowLockInfo(true);
      return;
    }
    try {
      await updateUser(user.id, { themeStyle: activeTheme });
      setCurrentUser({ ...user, themeStyle: activeTheme });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to apply theme.");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="text-pink-500" size={24} />
            <h3 className="text-xl font-black uppercase tracking-tight">Theme Preview Studio</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Theme Selector */}
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Select a Theme</p>
            {THEMES.map(t => {
              const locked = !t.free && !isEligible;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTheme(t.id)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    activeTheme === t.id 
                      ? 'border-pink-600 bg-pink-500/10 shadow-lg' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm shadow`}>
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{t.free ? 'Free Theme' : locked ? 'Locked (Tradient/Verified)' : 'Unlocked'}</p>
                    </div>
                  </div>
                  {locked && <Lock size={16} className="text-amber-400" />}
                </div>
              );
            })}
          </div>

          {/* Right: Live Account Preview */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
              Live Preview
            </div>

            {/* Profile Preview Avatar & Frame */}
            <div className={`relative w-24 h-24 rounded-full mb-4 flex items-center justify-center overflow-hidden ${currentThemeObj.frameClass}`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white font-bold text-2xl">{user.username.charAt(0)}</div>
              )}
            </div>

            <h4 className="font-bold text-lg mb-1">@{user.handle}</h4>
            <p className="text-xs text-zinc-500 mb-4 max-w-xs">{user.bio || 'Previewing theme appearance across profile and video frames.'}</p>

            {/* Video Frame Preview Box */}
            <div className={`w-full h-32 bg-black rounded-2xl overflow-hidden flex items-center justify-center relative mb-4 ${currentThemeObj.frameClass}`}>
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-600/30 to-purple-600/30 flex items-center justify-center">
                <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow">Video Frame Preview</span>
              </div>
            </div>

            {isLocked ? (
              <button 
                onClick={() => setShowLockInfo(true)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-pink-600 hover:opacity-90 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all"
              >
                🔒 Unlock This Theme
              </button>
            ) : (
              <button 
                onClick={handleApply}
                className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all"
              >
                Apply Theme To Profile
              </button>
            )}
          </div>
        </div>

        {showLockInfo && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">🔒 Unlock {currentThemeObj.name}</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                To unlock exclusive profile themes and customized video picture frames, you need the <span className="font-bold text-pink-600">Tradient</span> or <span className="font-bold text-blue-500">Verified</span> badge.
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl text-left text-xs space-y-2 mb-4 text-zinc-700 dark:text-zinc-300">
                <p className="font-bold text-zinc-900 dark:text-white">How to get Tradient or Verified:</p>
                <p>• Help keep our community safe by reporting bugs & malicious content.</p>
                <p>• Apply for verification through the "Be Verified" button on your profile.</p>
                <p>• Maintain an active and trusted track record in our forums!</p>
              </div>
              <button 
                onClick={() => setShowLockInfo(false)}
                className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { VerificationModal } from '../components/VerificationModal';

function EditProfileModal({ user, onClose }: { user: User, onClose: () => void }) {
  const { setCurrentUser } = useAppStore();
  const [modalTab, setModalTab] = useState<'profile' | 'account'>('profile');
  const [username, setUsername] = useState(user.username);
  const [handleInput, setHandleInput] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [password, setPassword] = useState(user.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showActivityStatus, setShowActivityStatus] = useState(user.showActivityStatus !== false);
  const [isGhostMode, setIsGhostMode] = useState(user.isGhostMode || false);
  const [themeStyle, setThemeStyle] = useState(user.themeStyle || 'cyber');
  const [profileBannerUrl, setProfileBannerUrl] = useState(user.profileBannerUrl || '');
  const [displayNameFont, setDisplayNameFont] = useState(user.displayNameFont || '');
  const [showLockInfo, setShowLockInfo] = useState(false);

  const isEligible = user.isVerified || user.role === 'staff' || user.role === 'owner' || (user.badges || []).includes('Tradient');

  const THEMES = [
    { id: 'cyber', name: 'Neon Cyber', free: true, color: 'from-cyan-400 to-blue-600' },
    { id: 'gold', name: 'Royal Gold', free: false, color: 'from-amber-400 to-yellow-600' },
    { id: 'emerald', name: 'Emerald Forest', free: false, color: 'from-emerald-400 to-green-600' },
    { id: 'purple', name: 'Midnight Purple', free: false, color: 'from-purple-400 to-indigo-600' },
    { id: 'sunset', name: 'Sunset Glow', free: false, color: 'from-pink-500 to-rose-600' },
  ];

  // Verification State
  const [showVerifModal, setShowVerifModal] = useState(false);
  
  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    try {
      const cleanHandle = handleInput.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
      const updateData: Partial<User> = {
        username,
        handle: cleanHandle || user.handle,
        bio,
        isPrivate,
        avatarUrl,
        password,
        showActivityStatus,
        isGhostMode,
        themeStyle,
        profileBannerUrl,
        displayNameFont
      };
      
      await updateUser(user.id, updateData);
      setCurrentUser({ ...user, ...updateData });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save profile. The image might still be too large or there's a connection issue.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (ev.target?.result) {
          setImageToCrop(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels) {
      const cropped = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const compressed = await compressImage(cropped, 300, 300, 0.6);
      setAvatarUrl(compressed);
      setImageToCrop(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setModalTab('profile')}
              className={`text-lg font-bold pb-1 border-b-2 transition-colors ${modalTab === 'profile' ? 'border-pink-600 text-pink-600' : 'border-transparent text-zinc-500'}`}
            >
              Profile
            </button>
            <button 
              onClick={() => setModalTab('account')}
              className={`text-lg font-bold pb-1 border-b-2 transition-colors ${modalTab === 'account' ? 'border-pink-600 text-pink-600' : 'border-transparent text-zinc-500'}`}
            >
              Account
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {modalTab === 'profile' ? (
            <>
              <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700" />
                  ) : (
                    <div className="w-24 h-24 rounded-full border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-2xl">{username.charAt(0)}</div>
                  )}
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                    <Upload size={24} />
                  </div>
                  <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                </div>
                <p className="mt-2 text-sm text-pink-600 font-semibold cursor-pointer" onClick={() => fileRef.current?.click()}>Change photo</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1 flex items-center gap-2">
                  <UserIcon size={14} /> Username
                </label>
                <input 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 rounded-lg px-4 py-2 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 flex items-center gap-2">
                  <ImageIcon size={14} /> Handle (@)
                </label>
                <input 
                  value={handleInput} 
                  onChange={e => setHandleInput(e.target.value)} 
                  placeholder="username handle"
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 rounded-lg px-4 py-2 outline-none transition-all"
                />
                <p className="text-xs text-zinc-500 mt-1">Unique handle for your profile URL.</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Bio</label>
                <textarea 
                  value={bio} 
                  onChange={e => setBio(e.target.value)} 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 rounded-lg px-4 py-2 outline-none transition-all resize-none h-24"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Private Account</p>
                  <p className="text-sm text-zinc-500">Only approved followers can see your videos.</p>
                </div>
                <button 
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <Sparkles size={16} className="text-cyan-500" /> CentralPro Features
                  </label>
                  {user.isCentralPro ? (
                    <span className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black rounded-full shadow-sm">
                      PRO UNLOCKED
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-semibold">
                      Requires CentralPro
                    </span>
                  )}
                </div>

                {/* Display Name Font */}
                <div>
                  <label className="block text-xs font-semibold mb-1 text-zinc-600 dark:text-zinc-400">
                    Display Name Font Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '', label: 'Standard Sans', preview: 'font-sans' },
                      { id: 'font-mono tracking-wider text-cyan-400 font-bold', label: 'Cyber Mono', preview: 'font-mono text-cyan-400' },
                      { id: 'font-serif italic font-extrabold text-amber-300 tracking-wide', label: 'Royal Serif', preview: 'font-serif italic text-amber-300' },
                      { id: 'font-mono uppercase font-black tracking-[0.2em] text-blue-400', label: 'Glitch Tech', preview: 'font-mono uppercase text-blue-400' },
                      { id: 'italic font-bold tracking-wide text-pink-400', label: 'Neon Script', preview: 'italic text-pink-400' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        disabled={!user.isCentralPro && user.role !== 'owner' && user.role !== 'staff'}
                        onClick={() => setDisplayNameFont(f.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                          displayNameFont === f.id
                            ? 'border-cyan-500 bg-cyan-500/15 text-cyan-400'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 text-zinc-700 dark:text-zinc-300'
                        } ${(!user.isCentralPro && user.role !== 'owner' && user.role !== 'staff') ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <p className="text-[10px] text-zinc-400">{f.label}</p>
                        <p className={`text-sm truncate mt-0.5 ${f.id || 'font-sans'}`}>{username || 'Preview'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Profile Banner */}
                <div>
                  <label className="block text-xs font-semibold mb-1 text-zinc-600 dark:text-zinc-400">
                    Background Profile Banner
                  </label>
                  <input
                    type="text"
                    disabled={!user.isCentralPro && user.role !== 'owner' && user.role !== 'staff'}
                    value={profileBannerUrl}
                    onChange={e => setProfileBannerUrl(e.target.value)}
                    placeholder="Image URL or pick cosmic preset below"
                    className={`w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 rounded-lg px-4 py-2 outline-none text-xs transition-all ${(!user.isCentralPro && user.role !== 'owner' && user.role !== 'staff') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                    {[
                      { name: 'Deep Space', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80' },
                      { name: 'Neon Cyber', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80' },
                      { name: 'Synthwave', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80' },
                      { name: 'Midnight', url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?w=1200&q=80' },
                    ].map(preset => (
                      <button
                        key={preset.name}
                        type="button"
                        disabled={!user.isCentralPro && user.role !== 'owner' && user.role !== 'staff'}
                        onClick={() => setProfileBannerUrl(preset.url)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-cyan-500/20 hover:text-cyan-400 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {preset.name}
                      </button>
                    ))}
                    {profileBannerUrl && (
                      <button
                        type="button"
                        onClick={() => setProfileBannerUrl('')}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-pink-500" /> Profile Theme & Video Frame
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {THEMES.map(t => {
                    const isLocked = !t.free && !isEligible;
                    return (
                      <div 
                        key={t.id}
                        onClick={() => {
                          if (isLocked) {
                            setShowLockInfo(true);
                          } else {
                            setThemeStyle(t.id);
                          }
                        }}
                        className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                          themeStyle === t.id 
                            ? 'border-pink-600 bg-pink-500/10 shadow-md' 
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                        }`}
                      >
                        {isLocked && (
                          <div className="absolute -top-2.5 -right-2.5 bg-zinc-900 text-amber-400 p-1 rounded-full shadow border border-amber-400/50">
                            <Lock size={14} />
                          </div>
                        )}
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-xs`}>
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{t.name}</p>
                          <p className="text-[10px] text-zinc-500">{isLocked ? 'Locked (Tradient/Verified)' : 'Unlocked'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {showLockInfo && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Lock size={24} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">🔒 Premium Theme Locked</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                      To unlock exclusive profile themes and customized video picture frames, you need the <span className="font-bold text-pink-600">Tradient</span> or <span className="font-bold text-blue-500">Verified</span> badge.
                    </p>
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl text-left text-xs space-y-2 mb-4 text-zinc-700 dark:text-zinc-300">
                      <p className="font-bold text-zinc-900 dark:text-white">How to get Tradient or Verified:</p>
                      <p>• Help keep our community safe by reporting bugs & malicious content.</p>
                      <p>• Apply for verification through the "Be Verified" button on your profile.</p>
                      <p>• Maintain an active and trusted track record in our forums!</p>
                    </div>
                    <button 
                      onClick={() => setShowLockInfo(false)}
                      className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-pink-600/20"
                    >
                      Got It
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1 flex items-center gap-2">
                  <Key size={14} /> Change Password
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="New password"
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 rounded-lg px-4 py-2 outline-none transition-all pr-10"
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <Check size={16} className="text-green-500" /> Activity Status
                  </p>
                  <p className="text-sm text-zinc-500">Show friends what game you're playing.</p>
                </div>
                <button 
                  onClick={() => setShowActivityStatus(!showActivityStatus)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${showActivityStatus ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${showActivityStatus ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    <EyeOff size={16} className="text-zinc-500" /> Ghost Mode
                  </p>
                  <p className="text-sm text-zinc-500">Hide your online status completely.</p>
                </div>
                <button 
                  onClick={() => setIsGhostMode(!isGhostMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isGhostMode ? 'bg-zinc-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isGhostMode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <h4 className="font-bold text-sm mb-4">Account Verification</h4>
                {!user.isVerified ? (
                  <button 
                    onClick={() => setShowVerifModal(true)}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg shadow-blue-500/20"
                  >
                    <ShieldCheck size={18} /> Be Verified
                  </button>
                ) : (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center gap-3">
                    <ShieldCheck className="text-blue-600" />
                    <div>
                      <p className="font-bold text-blue-600 text-sm">Account Verified</p>
                      <p className="text-[10px] text-blue-500 uppercase font-black">Holographic badge active</p>
                    </div>
                  </div>
                )}
              </div>

              {showVerifModal && (
                <VerificationModal user={user} onClose={() => setShowVerifModal(false)} />
              )}

              <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <ShieldCheck size={14} /> Security Info
                </h4>
                <p className="text-xs text-zinc-500">
                  Your password is stored securely in our database. We recommend using a unique password for this site.
                </p>
              </div>
            </>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between gap-3">
          <button 
            onClick={() => {
              setCurrentUser(null);
              onClose();
              window.location.href = '#/';
            }} 
            className="px-4 py-2 flex items-center gap-2 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
          >
            <LogOut size={18} /> Log out
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-pink-600/20">Save</button>
          </div>
        </div>

        {/* Cropping Modal Overlay */}
        <AnimatePresence>
          {imageToCrop && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col"
            >
              <div className="relative flex-1">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="round"
                  showGrid={false}
                />
              </div>
              <div className="p-6 bg-zinc-900 border-t border-zinc-800 space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-white text-sm font-bold">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-pink-600"
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setImageToCrop(null)}
                    className="flex-1 py-3 bg-zinc-800 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCropSave}
                    className="flex-1 py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-700 transition-colors shadow-lg shadow-pink-600/20"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
