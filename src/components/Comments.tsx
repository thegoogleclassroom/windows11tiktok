import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Video, Comment, User } from '../types';
import { addCommentToVideo, getUsers, ensureVideoInDB } from '../lib/db';
import { X, Send } from 'lucide-react';
import { HolographicBadge } from './UIPolish';

export function Comments({ video, onClose }: { video: Video, onClose: () => void }) {
  const { currentUser, setShowAuthModal } = useAppStore();
  const [comments, setComments] = useState<Comment[]>(video.comments || []);
  const [users, setUsers] = useState<User[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    getUsers().then(setUsers);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      text: newComment.trim(),
      timestamp: Date.now(),
      replyToId: replyTo?.id
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');
    setReplyTo(null);
    await ensureVideoInDB(video);
    await addCommentToVideo(video.id, comment);
  };

  const mainComments = comments.filter(c => !c.replyToId).sort((a, b) => b.timestamp - a.timestamp);
  const getReplies = (id: string) => comments.filter(c => c.replyToId === id).sort((a, b) => a.timestamp - b.timestamp);

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff/60)}m`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h`;
    return `${Math.floor(diff/86400)}d`;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[30%] bg-white dark:bg-zinc-900 rounded-t-2xl z-40 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 pointer-events-auto">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-bold">{comments.length} comments</h3>
        <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><X size={20}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 hide-scrollbar">
        {mainComments.map(c => {
          const user = users.find(u => u.id === c.userId);
          const replies = getReplies(c.id);
          return (
            <div key={c.id} className="flex gap-3">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold">{user?.username.charAt(0) || '?'}</div>
              )}
              <div className="flex-1">
                <p className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                  {user?.username}
                  {user?.isVerified && <HolographicBadge />}
                </p>
                <p className="text-sm mt-0.5">{c.text}</p>
                <div className="flex gap-4 mt-1 items-center">
                  <span className="text-xs text-zinc-500">{formatTime(c.timestamp)}</span>
                  <button onClick={() => setReplyTo(c)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Reply</button>
                </div>
                
                {replies.length > 0 && (
                  <div className="mt-4 flex flex-col gap-4">
                    {replies.map(r => {
                      const rUser = users.find(u => u.id === r.userId);
                      return (
                        <div key={r.id} className="flex gap-3">
                          {rUser?.avatarUrl ? (
                            <img src={rUser.avatarUrl} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xs">{rUser?.username.charAt(0) || '?'}</div>
                          )}
                          <div>
                            <p className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                              {rUser?.username}
                              {rUser?.isVerified && <HolographicBadge />}
                            </p>
                            <p className="text-sm mt-0.5">{r.text}</p>
                            <div className="flex gap-4 mt-1 items-center">
                              <span className="text-xs text-zinc-500">{formatTime(r.timestamp)}</span>
                              <button onClick={() => setReplyTo(c)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Reply</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {comments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
            <p className="font-semibold text-lg">No comments yet</p>
            <p className="text-sm">Be the first to comment.</p>
          </div>
        )}
      </div>
      
      {replyTo && (
        <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between text-sm">
          <span>Replying to {users.find(u => u.id === replyTo.userId)?.username}...</span>
          <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"><X size={16}/></button>
        </div>
      )}
      <form onSubmit={handleSend} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
        <input 
          type="text" 
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder={currentUser ? "Add comment..." : "Log in to comment..."}
          onClick={() => { if (!currentUser) setShowAuthModal(true); }}
          className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full px-4 py-2.5 outline-none text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 select-text cursor-text"
        />
        <button type="submit" disabled={!newComment.trim()} className="text-pink-600 p-2.5 disabled:opacity-50 cursor-pointer"><Send size={20}/></button>
      </form>
    </div>
  )
}
