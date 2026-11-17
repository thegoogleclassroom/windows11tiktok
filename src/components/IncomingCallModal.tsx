import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { Call, User } from '../types';
import { getUser, updateCallStatus } from '../lib/db';

interface IncomingCallModalProps {
  call: Call;
  onClose: () => void;
}

export function IncomingCallModal({ call, onClose }: IncomingCallModalProps) {
  const navigate = useNavigate();
  const [caller, setCaller] = useState<User | null>(null);

  useEffect(() => {
    const fetchCaller = async () => {
      const userData = await getUser(call.callerId);
      setCaller(userData);
    };
    fetchCaller();

    // Play ringtone
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    audio.loop = true;
    audio.play().catch(e => console.log('Audio play failed:', e));

    return () => {
      audio.pause();
    };
  }, [call.callerId]);

  const handleAccept = async () => {
    await updateCallStatus(call.id, 'answered');
    onClose();
    if (caller?.handle) {
      navigate(`/messages/${caller.handle}?call=${call.id}`);
    }
  };

  const handleDecline = async () => {
    await updateCallStatus(call.id, 'declined');
    onClose();
  };

  if (!caller) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center relative overflow-hidden"
      >
        {/* Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px] rounded-full" />

        <div className="relative z-10">
          <div className="relative inline-block mb-6">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-pink-500/20 rounded-full blur-xl"
            />
            <img 
              src={caller.avatarUrl} 
              alt="" 
              className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-800 shadow-xl relative z-10"
            />
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white dark:border-zinc-900 z-20" />
          </div>

          <h2 className="text-2xl font-black tracking-tight mb-1">{caller.username}</h2>
          <p className="text-zinc-500 font-bold text-sm mb-8">@{caller.handle} is calling you...</p>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={handleDecline}
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 transition-all transform hover:scale-110 active:scale-95">
                <PhoneOff size={28} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Decline</span>
            </button>

            <button
              onClick={handleAccept}
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all transform hover:scale-110 active:scale-95 animate-bounce">
                {call.type === 'video' ? <Video size={28} /> : <Phone size={28} />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Accept</span>
            </button>
          </div>
        </div>

        <button 
          onClick={handleDecline}
          className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </motion.div>
    </div>
  );
}
