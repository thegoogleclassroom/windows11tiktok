import React, { useState } from 'react';
import { useAppStore } from '../store';
import { getUsers, saveUsers, updateUser, getUserByEmail, isReadQuotaBlocked, upsertUserInCache } from '../lib/db';
import { User } from '../types';
import { signInWithGoogle, signInAsGuest } from '../lib/firebase';
import { Loader2 } from 'lucide-react';
import { getDeviceId } from '../lib/utils';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { setCurrentUser } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const syncUserToDb = async (email: string, displayName: string | null, photoURL: string | null) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await getUsers();
    const existingUser =
      users.find(u => u.email?.toLowerCase() === normalizedEmail) ||
      (await getUserByEmail(email));
    const deviceId = getDeviceId();
    const isOwner = normalizedEmail === 'zaellacruze1@gmail.com';
    
    if (existingUser) {
      const updates: Partial<User> = {};
      if (isOwner && existingUser.role !== 'owner') {
        updates.role = 'owner';
        existingUser.role = 'owner';
      }
      if (!existingUser.deviceId) {
        updates.deviceId = deviceId;
        existingUser.deviceId = deviceId;
      }
      if (Object.keys(updates).length > 0) {
        await updateUser(existingUser.id, updates);
      }
      upsertUserInCache(existingUser);
      return existingUser;
    }

    if (isReadQuotaBlocked()) {
      throw new Error(
        'Firebase free daily read quota is currently reached, so existing accounts cannot be verified right now. All profile data is safe and will reload once the quota resets.'
      );
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      username: displayName || email.split('@')[0],
      handle: (displayName ? displayName.replace(/\s+/g, '').toLowerCase() : email.split('@')[0]) + Math.floor(Math.random() * 1000),
      avatarUrl: photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      bio: isOwner ? 'Owner of CentralTok' : 'BETA user :D',
      following: [],
      followers: [],
      isPrivate: false,
      deviceId,
      role: isOwner ? 'owner' : 'user'
    };

    const linkedBan = users.find(user => user.deviceId === deviceId && user.banStatus);
    if (linkedBan) {
      newUser.banStatus = {
        type: 'hwid',
        linkedAccount: linkedBan.handle,
        reason: 'This device is linked to a banned account.'
      };
    }
    
    upsertUserInCache(newUser);
    await saveUsers([...users, newUser]);
    return newUser;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    
    setLoading(true);
    
    try {
      if (email === 'zaellacruze1@gmail.com' && password === 'nohorse') {
        await signInAsGuest();
        const user = await syncUserToDb(email, 'Zaella Cruze', null);
        setCurrentUser(user);
        onClose();
        return;
      }
      
      const users = await getUsers();
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser =
        users.find(u => u.email?.toLowerCase() === normalizedEmail) ||
        (await getUserByEmail(email));

      if (isSignUp) {
        if (existingUser) {
          setError('User already exists. Please log in.');
          setLoading(false);
          return;
        }
        const newUser = await syncUserToDb(email, null, null);
        setCurrentUser(newUser);
        onClose();
      } else {
        if (!existingUser) {
          if (isReadQuotaBlocked()) {
            setError('Firebase free daily read quota is currently reached. Your account is safe — please try again once quota resets.');
          } else {
            setError('User not found. Please sign up or use Google Sign-in.');
          }
          setLoading(false);
          return;
        }
        upsertUserInCache(existingUser);
        setCurrentUser(existingUser);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGmailLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const firebaseUser = await signInWithGoogle();
      if (firebaseUser.email) {
        const user = await syncUserToDb(firebaseUser.email, firebaseUser.displayName, firebaseUser.photoURL);
        setCurrentUser(user);
        onClose();
      } else {
        setError('Google login failed to provide an email.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 relative">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-center mb-6 text-zinc-900 dark:text-white">
            {isSignUp ? 'Sign up for CentralTok' : 'Log in to CentralTok'}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
              <input 
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 rounded-lg outline-none text-zinc-900 dark:text-white transition-all"
                placeholder="Email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
              <input 
                type="password"
                name="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500 rounded-lg outline-none text-zinc-900 dark:text-white transition-all"
                placeholder="Password"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center font-medium bg-red-100 dark:bg-red-900/30 p-2 rounded">{error}</p>}
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center h-12 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? 'Sign up' : 'Log in')}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between">
            <span className="border-b border-zinc-200 dark:border-zinc-700 w-1/5"></span>
            <span className="text-xs text-center text-zinc-500 uppercase font-medium">Or continue with</span>
            <span className="border-b border-zinc-200 dark:border-zinc-700 w-1/5"></span>
          </div>

          <button 
            onClick={handleGmailLogin}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center h-12 gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>
        
        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-pink-600 font-semibold hover:underline" disabled={loading}>
              {isSignUp ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </div>
        
        {/* Close Button if we want them to browse as guest */}
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800 dark:hover:text-white" disabled={loading}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

