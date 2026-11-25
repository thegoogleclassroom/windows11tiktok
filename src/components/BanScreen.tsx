import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { getAppeals, saveAppeals, unbanUserStrict } from '../lib/db';
import { Appeal } from '../types';

export function BanScreen() {
  const { currentUser, setCurrentUser } = useAppStore();
  const [appealReason, setAppealReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [myAppeals, setMyAppeals] = useState<Appeal[]>([]);

  const isTemp = currentUser?.banStatus?.type === 'temp';
  const isHwid = currentUser?.banStatus?.type === 'hwid';
  const isTempExpired = Boolean(
    isTemp && currentUser?.banStatus?.until && Date.now() > currentUser.banStatus.until
  );

  useEffect(() => {
    if (currentUser) {
      getAppeals().then(appeals => {
        setMyAppeals(appeals.filter(a => a.userId === currentUser.id).sort((a,b) => b.timestamp - a.timestamp));
        if (appeals.some(a => a.userId === currentUser.id && a.status === 'pending')) {
          setSubmitted(true);
        }
      }).catch(() => {});
    }
  }, [currentUser?.id]);

  // Checking if temp ban is expired
  useEffect(() => {
    if (currentUser && isTempExpired) {
      const unban = async () => {
        try {
          await unbanUserStrict(currentUser.id);
        } catch {}
        const updated = { ...currentUser };
        delete updated.banStatus;
        setCurrentUser(updated);
      };
      void unban();
    }
  }, [isTempExpired, currentUser?.id, setCurrentUser]);

  if (!currentUser || !currentUser.banStatus || isTempExpired) return null;

  const handleAppeal = async () => {
    if (!appealReason.trim()) return;
    const appeals = await getAppeals();
    appeals.push({
      id: `app_${Date.now()}`,
      userId: currentUser.id,
      reason: appealReason,
      status: 'pending',
      timestamp: Date.now()
    });
    await saveAppeals(appeals);
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-red-500 mb-2">Account Banned</h1>
        
        {isHwid ? (
          <div className="mb-6 space-y-3">
            <p className="text-zinc-300 leading-relaxed text-sm">
              This account is linked to another banned account ({currentUser.banStatus.linkedAccount ? `@${currentUser.banStatus.linkedAccount.slice(0, 2)}******` : 'Unknown'}). 
              Please enter that account and make an appeal. If that account is not yours and not supposed to be linked, Please contact Support.
            </p>
            <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl text-red-200 text-sm">
              <span className="font-bold block mb-1 text-red-400">Ban Reason (Staff/Owner):</span>
              {currentUser.banStatus.reason || 'Enforcement linkage violation.'}
            </div>
          </div>
        ) : isTemp ? (
          <div className="mb-6 space-y-3">
            <p className="text-zinc-300 leading-relaxed text-sm">
              Your account has been temporarily suspended until <span className="font-semibold text-white">{new Date(currentUser.banStatus.until!).toLocaleString()}</span>.
            </p>
            <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl text-red-200 text-sm">
              <span className="font-bold block mb-1 text-red-400">Ban Reason (Staff/Owner):</span>
              {currentUser.banStatus.reason || 'Violation of community guidelines.'}
            </div>
            {currentUser.banStatus.stillBannedReason && (
              <div className="p-3.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-200 text-sm">
                <span className="font-bold block mb-1 text-amber-400">Why You Are Still Banned:</span>
                {currentUser.banStatus.stillBannedReason}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6 space-y-3">
            <p className="text-zinc-300 leading-relaxed text-sm">
              Your account has been permanently suspended from CentralTok.
            </p>
            <div className="p-3.5 bg-red-950/40 border border-red-800/50 rounded-xl text-red-200 text-sm">
              <span className="font-bold block mb-1 text-red-400">Ban Reason (Staff/Owner):</span>
              {currentUser.banStatus.reason || 'Violation of community guidelines.'}
            </div>
            {currentUser.banStatus.stillBannedReason && (
              <div className="p-3.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-200 text-sm">
                <span className="font-bold block mb-1 text-amber-400">Why You Are Still Banned:</span>
                {currentUser.banStatus.stillBannedReason}
              </div>
            )}
          </div>
        )}

        {isHwid ? (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-4 rounded-xl text-center font-medium mb-6">
            Appeals can only be submitted from the originally banned account. Please contact Support if this enforcement is incorrect.
          </div>
        ) : submitted ? (
          <div className="bg-yellow-900/30 border border-yellow-500/50 text-yellow-400 p-4 rounded-xl text-center font-medium mb-6">
            You currently have a pending appeal. Please wait for staff review.
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold text-lg">Submit an Appeal</h3>
            <textarea
              value={appealReason}
              onChange={e => setAppealReason(e.target.value)}
              placeholder="Explain why you think you should be unbanned..."
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 min-h-[120px] focus:outline-none focus:border-red-500 resize-none"
            />
            <button 
              onClick={handleAppeal}
              disabled={!appealReason.trim()}
              className="w-full py-3 font-semibold rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Submit Appeal
            </button>
          </div>
        )}
        
        {myAppeals.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-lg border-t border-zinc-800 pt-6">Your Past Appeals</h3>
            {myAppeals.map(a => (
              <div key={a.id} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">{new Date(a.timestamp).toLocaleDateString()}</span>
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${a.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : a.status === 'accepted' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 italic">"{a.reason}"</p>
                {a.adminNotes && (
                  <div className="mt-2 text-sm text-zinc-400 border-l-2 border-zinc-700 pl-2">
                    Staff Reply: {a.adminNotes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <button 
          onClick={() => setCurrentUser(null)}
          className="w-full py-3 font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
