import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Crown, Heart } from 'lucide-react';

// 1. Holographic Badge Component
export const HolographicBadge: React.FC<{ type?: 'verified' | 'staff' | 'owner' }> = ({ type = 'verified' }) => {
  return (
    <motion.span
      className="relative group cursor-help inline-flex items-center"
      whileHover={{ scale: 1.1 }}
    >
      <span className={`
        relative z-10 p-0.5 rounded-full flex items-center justify-center
        ${type === 'owner' ? 'bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 
          type === 'staff' ? 'bg-gradient-to-tr from-emerald-400 via-teal-200 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 
          'bg-[#00A2FF] shadow-[0_0_8px_rgba(0,162,255,0.4)]'}
      `}>
        {type === 'owner' ? <Crown size={12} className="text-amber-950" /> : <ShieldCheck size={12} className={type === 'verified' ? "text-white" : "text-blue-950"} />}
      </span>
      
      {/* Holographic Shimmer Effect */}
      <motion.span
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className="absolute inset-0 rounded-full opacity-50 blur-[2px] bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.8)_50%,transparent_75%)] bg-[length:250%_250%]"
      />
      
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 backdrop-blur-md border border-white/20 rounded text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {type?.toUpperCase()}
      </span>
    </motion.span>
  );
};

// CentralPro Cosmic Badge
export const CentralProBadge: React.FC = () => {
  return (
    <motion.span
      className="relative group cursor-help inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-[0_0_12px_rgba(59,130,246,0.6)] border border-cyan-300/40"
      whileHover={{ scale: 1.08 }}
    >
      <span className="text-[10px]">🚀</span>
      <span className="text-[9px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">PRO</span>
      
      {/* Cosmic Animated Shimmer */}
      <motion.span
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute inset-0 rounded-full opacity-60 blur-[1px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)] bg-[length:200%_100%] pointer-events-none"
      />
      
      {/* Tooltip */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 backdrop-blur-md border border-cyan-400/40 rounded text-[10px] text-cyan-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
        CENTRALPRO SUBSCRIBER
      </span>
    </motion.span>
  );
};

// 2. Profile Hover Card
export const ProfileHoverCard: React.FC<{ user: any }> = ({ user }) => {
  return (
    <div className="absolute bottom-full left-0 mb-4 w-64 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl opacity-0 group-hover/user:opacity-100 transition-opacity pointer-events-none z-50">
      <div className="flex items-center gap-3 mb-3">
        <img src={user?.avatarUrl} className="w-12 h-12 rounded-full border border-white/20 object-cover" alt="" />
        <div>
          <h4 className="text-white font-bold text-sm">@{user?.handle}</h4>
          <p className="text-white/60 text-[10px]">{user?.followers?.length || 0} Followers • {user?.following?.length || 0} Following</p>
        </div>
      </div>
      <p className="text-white/80 text-xs line-clamp-2 mb-3">{user?.bio || 'No bio yet.'}</p>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-[3/4] bg-white/10 rounded-lg overflow-hidden">
            <div className="w-full h-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
};

// 3. Particle Like Effect
export const LikeParticles: React.FC<{ x: number, y: number, onComplete: () => void }> = ({ x, y, onComplete }) => {
  const particles = Array.from({ length: 12 });
  
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" style={{ left: x, top: y }}>
      <AnimatePresence>
        {particles.map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
            animate={{ 
              x: (Math.random() - 0.5) * 200, 
              y: (Math.random() - 0.5) * 200 - 50, 
              opacity: 0,
              scale: Math.random() * 1.5 + 0.5,
              rotate: Math.random() * 360
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute"
          >
            <Heart 
              size={Math.random() * 20 + 10} 
              className="text-pink-500 fill-current drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]" 
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// 3. Ambient Glow Container
export const AmbientGlow: React.FC<{ children: React.ReactNode, src?: string, type?: 'video' | 'image' }> = ({ children, src, type }) => {
  return (
    <div className="relative w-full h-full overflow-hidden group">
      {/* Dynamic Glow Layer */}
      {src && (
        <div className="absolute inset-0 z-0 opacity-40 blur-[80px] scale-110 pointer-events-none transition-opacity duration-700">
          {type === 'video' ? (
            <video src={src} muted loop className="w-full h-full object-cover" />
          ) : (
            <img src={src} className="w-full h-full object-cover" alt="" />
          )}
        </div>
      )}
      
      {/* Content Layer */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>
      
      {/* Glassmorphic Shadow */}
      <div className="absolute inset-0 z-[5] bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />
    </div>
  );
};
