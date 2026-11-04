import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { getUsers, getReports, saveReports, getAppeals, saveAppeals, getAuditLogs, saveAuditLogs, saveUsers, getVideos, saveVideos, getAppSettings, saveAppSettings, saveNotifications, getNotifications, getAnnouncements, saveAnnouncement, deleteAnnouncement, subscribeToAnnouncements, subscribeToVerificationRequests, voteOnVerificationRequest, updateVerificationRequestStatus, updateUserVerificationStatus, subscribeToSuggestions, getVerificationRequests, updateDoc, doc, db, wipeUserFromSystem, getCentralProRequests, approveCentralProPayment, declineCentralProPayment } from '../lib/db';
import { User, Report, Appeal, AuditLog, Video, AppNotification, Announcement, VerificationRequest, AppSuggestion, CentralProRequest } from '../types';
import { ShieldAlert, AlertTriangle, Users, FileText, CheckCircle, XCircle, Trash2, Ban, Search, Filter, RotateCcw, Loader2, Power, Gamepad2, Settings, Megaphone, Plus, Calendar, Palette, Maximize, Target, Layout as LayoutIcon, Ghost, X, Lightbulb, UserCheck, HelpCircle, Rocket } from 'lucide-react';
import { getDeviceId } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { GAMES, APPS } from '../data/games';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

export function Admin() {
  const { currentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'appeals' | 'logs' | 'announcements' | 'verification' | 'centralpro' | 'suggestions' | 'settings' | 'analytics'>('reports');
  
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [suggestions, setSuggestions] = useState<AppSuggestion[]>([]);
  const [centralProRequests, setCentralProRequests] = useState<CentralProRequest[]>([]);
  const [centralProProcessing, setCentralProProcessing] = useState<string | null>(null);
  
  // Announcement Form State
  const [newAnnouncement, setNewAnnouncement] = useState<Partial<Announcement>>({
    text: '',
    type: 'global',
    color: 'bg-pink-600',
    size: 'md',
    active: true,
    targetGameIds: [],
    targetPage: '',
    hideDuringGameplay: false,
    displayDuration: 0,
    allowDismiss: true,
    isPoll: false,
    pollOptions: ['', ''],
    scheduledAt: 0,
    actionButtonText: '',
    actionButtonLink: '',
  });
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [announcementAmount, setAnnouncementAmount] = useState<number>(24);
  const [announcementUnit, setAnnouncementUnit] = useState<'secs' | 'hours' | 'days' | 'months' | 'years' | 'never'>('hours');

  // Temp Ban Modal State
  const [tempBanModal, setTempBanModal] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [tempBanAmount, setTempBanAmount] = useState<number>(7);
  const [tempBanUnit, setTempBanUnit] = useState<'secs' | 'hours' | 'days' | 'months' | 'years'>('days');
  const [tempBanReason, setTempBanReason] = useState<string>('');
  const [tempBanLoading, setTempBanLoading] = useState<boolean>(false);

  // Rename Modal State
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [renameUsername, setRenameUsername] = useState('');
  const [renameHandle, setRenameHandle] = useState('');
  const [renameReason, setRenameReason] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const handleApplyRename = async () => {
    if (!renameModal.user || !renameReason.trim() || !renameUsername.trim() || !renameHandle.trim()) return;
    setRenameLoading(true);
    try {
      const allUsers = await getUsers();
      const idx = allUsers.findIndex(u => u.id === renameModal.user!.id);
      if (idx !== -1) {
        const oldUsername = allUsers[idx].username;
        const oldHandle = allUsers[idx].handle;
        allUsers[idx].username = renameUsername.trim();
        allUsers[idx].handle = renameHandle.trim();
        await saveUsers(allUsers);
        setUsers(allUsers);

        // Send notification to user activity feed
        const notifId = `notif_mod_rename_${Date.now()}`;
        const notifications = await getNotifications();
        const newNotif: AppNotification = {
          id: notifId,
          userId: renameModal.user.id,
          type: 'moderation',
          fromUserId: currentUser!.id,
          title: 'Moderator Action: Renamed',
          message: `You have been renamed by staff (@${currentUser!.handle}). Old: @${oldHandle} (${oldUsername}) -> New: @${renameHandle.trim()} (${renameUsername.trim()}). Reason: ${renameReason.trim()}`,
          read: false,
          timestamp: Date.now()
        };
        await saveNotifications([...notifications, newNotif]);

        await logAction('rename_user', renameModal.user.id, `Renamed user from @${oldHandle} to @${renameHandle.trim()} (${renameUsername.trim()}). Reason: ${renameReason.trim()}`);
      }
      setRenameModal({ isOpen: false, user: null });
      setRenameUsername('');
      setRenameHandle('');
      setRenameReason('');
    } catch (err) {
      console.error(err);
    } finally {
      setRenameLoading(false);
    }
  };

  const calculateDurationMs = (amount: number, unit: string) => {
    if (unit === 'never') return 0;
    switch (unit) {
      case 'secs': return amount * 1000;
      case 'hours': return amount * 60 * 60 * 1000;
      case 'days': return amount * 24 * 60 * 60 * 1000;
      case 'months': return amount * 30 * 24 * 60 * 60 * 1000;
      case 'years': return amount * 365 * 24 * 60 * 60 * 1000;
      default: return amount * 24 * 60 * 60 * 1000;
    }
  };

  const handleApplyTempBan = async () => {
    if (!tempBanModal.user || !tempBanReason.trim()) return;
    setTempBanLoading(true);
    try {
      if (wipeSystemCheck) {
        await wipeUserFromSystem(tempBanModal.user.id);
        const freshUsers = await getUsers();
        setUsers(freshUsers);
        await logAction('ban_user', tempBanModal.user.id, `SYSTEM WIPE BAN (temp): Completely wiped @${tempBanModal.user.handle} out of system. Reason: ${tempBanReason.trim()}`);
      } else {
        const durationMs = calculateDurationMs(tempBanAmount, tempBanUnit);
        const until = Date.now() + durationMs;
        const allUsers = await getUsers();
        const idx = allUsers.findIndex(u => u.id === tempBanModal.user!.id);
        if (idx !== -1) {
          allUsers[idx].banStatus = {
            type: 'temp',
            until,
            reason: tempBanReason.trim(),
            bannedBy: currentUser!.id,
            bannedAt: Date.now()
          };
          await saveUsers(allUsers);
          setUsers(allUsers);
          await logAction('ban_user', tempBanModal.user.id, `Banned user (temp) for ${tempBanAmount} ${tempBanUnit}. Reason: ${tempBanReason.trim()}`);
        }
      }
      setTempBanModal({ isOpen: false, user: null });
      setTempBanReason('');
      setWipeSystemCheck(false);
    } catch (err) {
      console.error(err);
    } finally {
      setTempBanLoading(false);
    }
  };

  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<{ 
    useCache: boolean; 
    youtubeApiKeyIndex: number; 
    serverCrashed: boolean; 
    gamesAppsCrashed: boolean; 
  }>({ 
    useCache: true, 
    youtubeApiKeyIndex: 0, 
    serverCrashed: false, 
    gamesAppsCrashed: false 
  });
  
  const [logSearch, setLogSearch] = useState('');

  // Pin & Countdown State
  const [pinModal, setPinModal] = useState<{ isOpen: boolean; action: () => void; title: string }>({ isOpen: false, action: () => {}, title: '' });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    action: (reason: string, wipeSystem?: boolean) => Promise<void>;
    requireReason: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    loading?: boolean;
    isBanAction?: boolean;
    targetUserId?: string;
  }>({ isOpen: false, title: '', action: async () => {}, requireReason: false });
  const [actionReason, setActionReason] = useState('');
  const [wipeSystemCheck, setWipeSystemCheck] = useState(false);
  const [binaryCode, setBinaryCode] = useState('01000100 01000101 01001100 01000101 01010100 01000101');

  // Animated binary typewriter cycle
  useEffect(() => {
    const chars = '01';
    const interval = setInterval(() => {
      let result = '';
      for (let i = 0; i < 48; i++) {
        if (i > 0 && i % 8 === 0) result += ' ';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setBinaryCode(result);
    }, 150);
    return () => clearInterval(interval);
  }, []);
  
  const isOwner = currentUser?.role === 'owner';
  const isMod = isOwner || currentUser?.role === 'staff';

  const [isRefreshingCP, setIsRefreshingCP] = useState(false);

  const refreshCentralProList = async () => {
    setIsRefreshingCP(true);
    try {
      const [reqs, freshUsers] = await Promise.all([getCentralProRequests(), getUsers()]);
      setUsers(freshUsers);
      setCentralProRequests(reqs);
    } catch (e) {
      console.warn("Error refreshing CP:", e);
    } finally {
      setTimeout(() => setIsRefreshingCP(false), 400);
    }
  };

  const loadData = async () => {
    const [reps, usrs, apps, lgs, vids, anns, verifs, cpreqs] = await Promise.all([
      getReports(),
      getUsers(),
      getAppeals(),
      getAuditLogs(),
      getVideos(),
      getAnnouncements(),
      getVerificationRequests(),
      getCentralProRequests()
    ]);
    setReports(reps);
    setUsers(usrs);
    setAppeals(apps);
    setLogs(lgs);
    setVideos(vids);
    setAnnouncements(anns);
    setVerificationRequests(verifs);
    setCentralProRequests(cpreqs);
    if (isOwner) {
      const settings = await getAppSettings();
      setAppSettings(settings);
    }
  };

  useEffect(() => {
    if (isMod && activeTab === 'centralpro') {
      refreshCentralProList();
      const interval = setInterval(refreshCentralProList, 4000);
      return () => clearInterval(interval);
    }
  }, [isMod, activeTab]);

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.text) return;
    
    setConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      const durationMs = calculateDurationMs(announcementAmount, announcementUnit);
      
      let scheduledAt = 0;
      if (scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
      }

      const announcement: Announcement = {
        id: `ann_${Date.now()}`,
        text: newAnnouncement.text!,
        type: newAnnouncement.type as any,
        targetPage: newAnnouncement.targetPage,
        targetGameIds: newAnnouncement.targetGameIds,
        color: newAnnouncement.color!,
        size: newAnnouncement.size as any,
        createdAt: Date.now(),
        expiresAt: durationMs > 0 ? Date.now() + durationMs : undefined,
        active: true,
        hideDuringGameplay: newAnnouncement.hideDuringGameplay,
        displayDuration: newAnnouncement.displayDuration,
        allowDismiss: newAnnouncement.allowDismiss,
        isPoll: newAnnouncement.isPoll,
        pollOptions: newAnnouncement.isPoll ? newAnnouncement.pollOptions?.filter(o => o.trim() !== '') : undefined,
        pollVotes: {},
        scheduledAt: scheduledAt || undefined,
        actionButtonText: newAnnouncement.actionButtonText,
        actionButtonLink: newAnnouncement.actionButtonLink,
      };

      await saveAnnouncement(announcement);
      // Local update is redundant if subscription is active but good for responsiveness
      setAnnouncements(prev => [announcement, ...prev]);
      setNewAnnouncement({
        text: '',
        type: 'global',
        color: 'bg-pink-600',
        size: 'md',
        active: true,
        targetGameIds: [],
        hideDuringGameplay: false,
        displayDuration: 0,
        allowDismiss: true,
        isPoll: false,
        pollOptions: ['', ''],
        actionButtonText: '',
        actionButtonLink: '',
      });
      setScheduledDate('');
      setScheduledTime('');
      await logAction('create_announcement', announcement.id, `Created ${announcement.type} announcement: ${announcement.text.substring(0, 30)}...`);
    } catch (err) {
      console.error(err);
      alert("Failed to create announcement. Please check permissions (Try logging in with Google).");
    } finally {
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await deleteAnnouncement(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    await logAction('delete_announcement', id, `Deleted announcement`);
  };

  useEffect(() => {
    if (isMod) {
      loadData();
      const unsubAnn = subscribeToAnnouncements(setAnnouncements);
      const unsubVerif = subscribeToVerificationRequests(setVerificationRequests);
      const unsubSugg = subscribeToSuggestions(setSuggestions);
      return () => {
        unsubAnn();
        unsubVerif();
        unsubSugg();
      };
    }
  }, [isMod]);

  if (!isMod) {
    return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>;
  }

  const logAction = async (action: string, targetId: string, details: string) => {
    const allLogs = await getAuditLogs();
    allLogs.push({
      id: `log_${Date.now()}`,
      action,
      adminId: currentUser!.id,
      targetId,
      details,
      timestamp: Date.now()
    });
    await saveAuditLogs(allLogs);
    setLogs(allLogs);
  };

  const redoAuditAction = async (log: AuditLog) => {
    if (!isOwner || log.reverted) return;
    const allUsers = await getUsers();
    const allReports = await getReports();
    const allAppeals = await getAppeals();
    const user = allUsers.find(item => item.id === log.targetId);
    const report = allReports.find(item => item.id === log.targetId);
    const appeal = allAppeals.find(item => item.id === log.targetId);

    if (log.action === 'promote_staff' && user) user.role = 'staff';
    if (log.action === 'remove_staff' && user) user.role = 'user';
    if (log.action === 'verify_user' && user) {
      // Toggle logic for "redo" acting as revert if already done
      if (user.isVerified) {
        user.isVerified = false;
        // Also find the verification request and set it back to pending
        const requests = await getVerificationRequests();
        const req = requests.find(r => r.userId === user.id && r.status === 'approved');
        if (req) {
          await updateVerificationRequestStatus(req.id, 'pending');
        }
      } else {
        user.isVerified = true;
      }
    }
    if (log.action === 'ban_user' && user) {
      const type = log.details.includes('(hwid)') ? 'hwid' : log.details.includes('(temp)') ? 'temp' : 'perm';
      user.banStatus = { type, reason: `Redone by owner from audit log ${log.id}`, linkedAccount: type === 'hwid' ? user.handle : undefined };
    }
    if (log.action === 'report_accepted' && report) report.status = 'accepted';
    if (log.action === 'report_rejected' && report) report.status = 'rejected';
    if (log.action === 'appeal_accepted' && appeal) appeal.status = 'accepted';
    if (log.action === 'appeal_rejected' && appeal) appeal.status = 'rejected';

    if (user) await saveUsers(allUsers);
    if (report) await saveReports(allReports);
    if (appeal) await saveAppeals(allAppeals);
    const allLogs = await getAuditLogs();
    allLogs.push({
      id: `log_${Date.now()}`,
      action: 'redo_action',
      adminId: currentUser!.id,
      targetId: log.targetId,
      details: `Redid ${log.action} from audit log ${log.id}`,
      timestamp: Date.now()
    });
    await saveAuditLogs(allLogs);
    await loadData();
  };

  const executeWithConfirm = (
    title: string, 
    action: (reason: string, wipeSystem?: boolean) => Promise<void>, 
    requireReason = true,
    reasonLabel?: string,
    reasonPlaceholder?: string,
    isBanAction?: boolean,
    targetUserId?: string
  ) => {
    setActionReason('');
    setWipeSystemCheck(false);
    setConfirmModal({
      isOpen: true,
      title,
      requireReason,
      reasonLabel,
      reasonPlaceholder,
      action,
      isBanAction,
      targetUserId
    });
  };

  const handleConfirmAction = async () => {
    if (confirmModal.requireReason && !actionReason.trim()) return;
    setConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      await confirmModal.action(actionReason.trim(), wipeSystemCheck);
      setConfirmModal({ isOpen: false, title: '', action: async () => {}, requireReason: false, loading: false });
      setActionReason('');
      setWipeSystemCheck(false);
    } catch (err) {
      console.error(err);
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Report actions
  const handleResolveReport = (report: Report, status: 'accepted' | 'rejected') => {
    executeWithConfirm(`Resolve Report as ${status.toUpperCase()}`, async (reason) => {
      // Use the centralized resolveReport helper
      const { resolveReport: dbResolveReport } = await import('../lib/db');
      
      if (status === 'accepted') {
        const allReports = await getReports();
        const idx = allReports.findIndex(r => r.id === report.id);
        if (idx !== -1) {
          // If accepted, we still need to handle video removal and tradient rewards logic here
          // as it's specific to the admin UI flow
          const vids = await getVideos();
          const vIdx = vids.findIndex(v => v.id === report.videoId);
          if (vIdx !== -1) {
             vids[vIdx].isRemoved = true;
             vids[vIdx].removalReason = reason;
             await saveVideos(vids);
             setVideos(vids);
          }

          const allUsers = await getUsers();
          const reporterIdx = allUsers.findIndex(u => u.id === report.reporterId);
          if (reporterIdx !== -1) {
            const reporter = allUsers[reporterIdx];
            reporter.acceptedReportsCount = (reporter.acceptedReportsCount || 0) + 1;
            if (reporter.acceptedReportsCount === 3 && !(reporter.badges || []).includes('Tradient')) {
              reporter.badges = [...(reporter.badges || []), 'Tradient'];
              // Send important notification for Tradient reward
              const tradientNotif: AppNotification = {
                id: `notif_tradient_${Date.now()}`,
                userId: reporter.id,
                type: 'tradient_reward',
                fromUserId: currentUser!.id,
                title: '🏆 Tradient Badge Earned!',
                message: "Congratulations! Your reports have been consistently accurate. You've been rewarded with the exclusive Tradient Badge. Check it out!",
                read: false,
                timestamp: Date.now(),
                isImportant: true,
                actionButton: {
                  text: 'Check it out',
                  action: 'show_tradient_info'
                }
              };
              const allNotifs = await getNotifications();
              await saveNotifications([...allNotifs, tradientNotif]);
            }
            await saveUsers(allUsers);
            setUsers(allUsers);
          }
        }
      }

      // This helper updates the status and sends the notification to the reporter
      await dbResolveReport(report.id, currentUser!.id, currentUser!.username, reason);
      
      // Update local state
      const updatedReports = await getReports();
      setReports(updatedReports);
      
      await logAction(`report_${status}`, report.id, `Report resolved. Notes: ${reason}`);
    }, true, 'Moderator Note / Reason', 'State why this report is resolved...');
  };

  // User Ban actions
  const applyBan = (user: User, type: 'temp' | 'perm' | 'hwid', days?: number) => {
    const title = type === 'temp' 
      ? `Temp Ban (7 days): @${user.handle}` 
      : type === 'perm' 
      ? `Permanent Ban: @${user.handle}` 
      : `Enforcement (Hardware) Ban: @${user.handle}`;
    
    executeWithConfirm(
      title, 
      async (reason, shouldWipe) => {
        if (shouldWipe) {
          await wipeUserFromSystem(user.id);
          const freshUsers = await getUsers();
          setUsers(freshUsers);
          await logAction('ban_user', user.id, `SYSTEM WIPE BAN (${type}): Completely wiped @${user.handle} out of system. Reason: ${reason}`);
          return;
        }

        const allUsers = await getUsers();
        const idx = allUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) {
          const until = type === 'temp' && days ? Date.now() + (days * 24 * 60 * 60 * 1000) : undefined;
          allUsers[idx].banStatus = {
            type,
            until,
            reason: reason.trim(),
            bannedBy: currentUser!.id,
            bannedAt: Date.now(),
            linkedAccount: type === 'hwid' ? user.handle : undefined
          };
          if (type === 'hwid') allUsers[idx].deviceId = allUsers[idx].deviceId || getDeviceId();
          await saveUsers(allUsers);
          setUsers(allUsers);
          await logAction('ban_user', user.id, `Banned user (${type})${days ? ` for ${days} days` : ''}. Reason: ${reason}`);
        }
      },
      true,
      'Reason for Ban (Mandatory for staff/owner)',
      'Specify the guideline violation or reason why this user is being banned...',
      true,
      user.id
    );
  };

  // User Unban action
  const unbanUser = (user: User) => {
    executeWithConfirm(
      `Unban User: @${user.handle}`,
      async (reason) => {
        const allUsers = await getUsers();
        const idx = allUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) {
          delete allUsers[idx].banStatus;
          await saveUsers(allUsers);
          setUsers(allUsers);
          await logAction('unban_user', user.id, `Unbanned user @${user.handle}. Reason: ${reason}`);
        }
      },
      true,
      'Reason for Unbanning (Mandatory)',
      'Explain why this person is getting unbanned...'
    );
  };

  // Appeal actions
  const resolveAppeal = (appeal: Appeal, status: 'accepted' | 'rejected') => {
    const u = users.find(user => user.id === appeal.userId);
    const title = status === 'accepted' ? `Accept Appeal & Unban @${u?.handle || 'User'}` : `Reject Appeal - Keep @${u?.handle || 'User'} Banned`;
    const label = status === 'accepted' 
      ? 'Reason for Unbanning (Mandatory - why they are getting unbanned)' 
      : 'Reason Why Still Banned (Mandatory - why they remain banned)';
    const placeholder = status === 'accepted'
      ? 'Provide detailed reason why this user is getting unbanned...'
      : 'Explain why this appeal was rejected and why the user is still banned...';

    executeWithConfirm(
      title, 
      async (reason) => {
        const allAppeals = await getAppeals();
        const idx = allAppeals.findIndex(a => a.id === appeal.id);
        if (idx !== -1) {
          allAppeals[idx].status = status;
          allAppeals[idx].adminNotes = reason;
          await saveAppeals(allAppeals);
          setAppeals(allAppeals);
          
          if (appeal.videoId) {
            // Video appeal
            if (status === 'accepted') {
              const allVids = await getVideos();
              const vIdx = allVids.findIndex(v => v.id === appeal.videoId);
              if (vIdx !== -1) {
                delete allVids[vIdx].isRemoved;
                delete allVids[vIdx].removalReason;
                await saveVideos(allVids);
                setVideos(allVids);
              }
            }
          } else {
            // Ban appeal
            const allUsers = await getUsers();
            const uIdx = allUsers.findIndex(user => user.id === appeal.userId);
            if (uIdx !== -1) {
              if (status === 'accepted') {
                delete allUsers[uIdx].banStatus;
              } else {
                if (allUsers[uIdx].banStatus) {
                  allUsers[uIdx].banStatus!.stillBannedReason = reason;
                }
              }
              await saveUsers(allUsers);
              setUsers(allUsers);
            }
          }
          await logAction(`appeal_${status}`, appeal.id, `Appeal ${status}. Reason/Notes: ${reason}`);
        }
      },
      true,
      label,
      placeholder
    );
  };

  const toggleCache = async () => {
    if (!isOwner) return;
    const newSettings = { ...appSettings, useCache: !appSettings.useCache };
    setAppSettings(newSettings);
    await saveAppSettings(newSettings);
    await logAction('toggle_cache', 'system', `Toggled cached data to ${newSettings.useCache ? 'ON' : 'OFF'}`);
  };

  const updateApiIndex = async (index: number) => {
    if (!isOwner) return;
    const newSettings = { ...appSettings, youtubeApiKeyIndex: index };
    setAppSettings(newSettings);
    await saveAppSettings(newSettings);
    await logAction('update_api_index', 'system', `Updated YouTube API strategy to ${index === 0 ? 'Automatic' : `Key ${index}`}`);
  };

  const handleCrashAction = (type: 'server' | 'games', currentStatus: boolean) => {
    if (!isOwner) return;
    setPinInput('');
    setPinError(false);
    setPinModal({
      isOpen: true,
      title: currentStatus ? `Recover ${type === 'server' ? 'Server' : 'Games & Apps'}` : `Shutdown ${type === 'server' ? 'Server' : 'Games & Apps'}`,
      action: async () => {
        if (currentStatus) {
           // Direct recovery
           const newSettings = type === 'server' 
             ? { ...appSettings, serverCrashed: false } 
             : { ...appSettings, gamesAppsCrashed: false };
           setAppSettings(newSettings);
           await saveAppSettings(newSettings);
           await logAction(`${type}_recover`, 'system', `Recovered ${type}`);
        } else {
           // Start countdown
           setCountdown(10);
        }
      }
    });
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      const executeCrash = async () => {
        const type = pinModal.title.includes('Server') ? 'server' : 'games';
        const newSettings = type === 'server' 
          ? { ...appSettings, serverCrashed: true } 
          : { ...appSettings, gamesAppsCrashed: true };
        setAppSettings(newSettings);
        await saveAppSettings(newSettings);
        await logAction(`${type}_crash`, 'system', `Crashed ${type} intentionally`);
        setTimeout(() => setCountdown(null), 3000);
      };
      executeCrash();
    }
  }, [countdown]);

  const verifyPin = () => {
    if (pinInput === '1205') {
      setPinModal(prev => ({ ...prev, isOpen: false }));
      pinModal.action();
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!logSearch) return true;
    const searchLower = logSearch.toLowerCase();
    const admin = users.find(u => u.id === log.adminId);
    return log.action.toLowerCase().includes(searchLower) || 
           log.details.toLowerCase().includes(searchLower) ||
           (admin && admin.handle.toLowerCase().includes(searchLower));
  }).sort((a,b) => b.timestamp - a.timestamp);

  return (
    <div className="w-full h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldAlert size={32} className={isOwner ? 'text-red-500' : 'text-blue-500'} />
          <h1 className="text-3xl font-bold">Moderation Dashboard</h1>
        </div>

        <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-2">
          {['reports', 'users', 'appeals', 'centralpro', 'logs', 'announcements', 'verification', 'suggestions', 'settings', 'analytics'].map(tab => {
            const isVisible = tab === 'centralpro' ? isMod : (((tab !== 'logs' && tab !== 'announcements' && tab !== 'verification' && tab !== 'suggestions' && tab !== 'settings' && tab !== 'analytics') || isOwner));
            const pendingCpCount = centralProRequests.filter(r => r.status === 'pending').length;
            if (!isVisible) return null;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 font-semibold rounded-t-lg transition-colors capitalize whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab ? 'bg-zinc-200 dark:bg-zinc-800 text-pink-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <span>{tab === 'centralpro' ? 'CentralPro' : tab}</span>
                {tab === 'centralpro' && pendingCpCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-black animate-pulse">
                    {pendingCpCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm min-h-[500px]">
          
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Pending Reports and Support</h2>
              {reports.filter(r => r.status === 'pending').map(report => {
                const vid = report.videoId ? videos.find(v => v.id === report.videoId) : null;
                const repUser = users.find(u => u.id === report.reporterId);
                return (
                  <div key={report.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4">
                    {vid ? (
                      <div className="w-24 h-32 bg-black shrink-0 rounded-lg overflow-hidden relative">
                         {vid.isYouTube ? (
                           <img src={`https://img.youtube.com/vi/${vid.youtubeId}/default.jpg`} className="w-full h-full object-cover opacity-50" />
                         ) : vid.videoUrl ? (
                           <video src={vid.videoUrl} className="w-full h-full object-cover" />
                         ) : null}
                      </div>
                    ) : (
                      <div className="w-24 h-32 bg-zinc-100 dark:bg-zinc-800 shrink-0 rounded-lg flex items-center justify-center text-zinc-400">
                        <AlertTriangle size={32} />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-red-500 mb-1">{report.category === 'support' ? 'Support Request' : report.category === 'bug' ? 'Bug / Issue' : 'Report'}: {report.reason}</p>
                      <p className="text-sm text-zinc-500 mb-2">Reported by: @{repUser?.handle}</p>
                      <p className="text-xs text-zinc-400 mb-4">{new Date(report.timestamp).toLocaleString()}</p>
                      <div className="flex gap-2">
                        {vid && (
                          <button onClick={() => setPreviewVideo(vid)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm flex items-center gap-1">
                            <Search size={16} /> View Video
                          </button>
                        )}
                        <button onClick={() => handleResolveReport(report, 'accepted')} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm flex items-center gap-1">
                          {report.category === 'video' ? <Trash2 size={16} /> : <CheckCircle size={16} />}
                          {report.category === 'video' ? 'Take Down' : 'Resolve'}
                        </button>
                        <button onClick={() => handleResolveReport(report, 'rejected')} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 font-semibold rounded-lg text-sm">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {reports.filter(r => r.status === 'pending').length === 0 && <p className="text-zinc-500">No pending reports.</p>}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4 overflow-x-auto">
              <h2 className="text-xl font-bold mb-4">User Management</h2>
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Join Date (ID)</th>
                    <th className="pb-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-800" />
                          )}
                          <div>
                            <p className="font-bold">{u.username}</p>
                            <p className="text-xs text-zinc-500">@{u.handle}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 capitalize text-sm font-medium">
                        {u.role || 'User'}
                      </td>
                      <td className="py-3 pr-4">
                        {u.banStatus ? (
                          <div>
                            <span className="text-red-500 text-xs uppercase bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded font-semibold whitespace-nowrap">
                              {u.banStatus.type} Ban
                            </span>
                            {u.banStatus.reason && (
                              <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px] truncate" title={u.banStatus.reason}>
                                Reason: {u.banStatus.reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-green-500 text-xs uppercase bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded font-semibold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm text-zinc-500 whitespace-nowrap">
                        {new Date(parseInt(u.id.split('_')[1] || '0')).toLocaleDateString() === 'Invalid Date' ? 'Unknown' : new Date(parseInt(u.id.split('_')[1])).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2 items-center">
                          {u.banStatus && (
                            <button 
                              onClick={() => unbanUser(u)} 
                              className="px-2.5 py-1 bg-green-500/20 text-green-600 dark:text-green-400 font-semibold rounded text-xs hover:bg-green-500/30 flex items-center gap-1"
                              title="Unban this user"
                            >
                              <CheckCircle size={13} /> Unban User
                            </button>
                          )}
                          {u.role !== 'owner' && (
                            <button 
                              onClick={() => { 
                                setRenameModal({ isOpen: true, user: u }); 
                                setRenameUsername(u.username); 
                                setRenameHandle(u.handle); 
                                setRenameReason(''); 
                              }} 
                              className="px-2 py-1 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold rounded text-xs hover:bg-indigo-500/30 flex items-center gap-1"
                            >
                              Rename
                            </button>
                          )}
                          {!u.banStatus && u.role !== 'owner' && (
                            <>
                              <button onClick={() => { setTempBanModal({ isOpen: true, user: u }); setTempBanAmount(7); setTempBanUnit('days'); setTempBanReason(''); }} className="px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-semibold rounded text-xs hover:bg-yellow-500/30">
                                7d Ban
                              </button>
                              <button onClick={() => applyBan(u, 'perm')} className="px-2 py-1 bg-red-500/20 text-red-600 dark:text-red-400 font-semibold rounded text-xs hover:bg-red-500/30">
                                Permaban
                              </button>
                              <button onClick={() => applyBan(u, 'hwid')} className="px-2 py-1 bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold rounded text-xs hover:bg-purple-500/30 flex items-center gap-1">
                                <Ban size={12} /> Enforcement
                              </button>
                              
                              {isOwner && u.role !== 'staff' && (
                                <button 
                                  onClick={() => executeWithConfirm('Promote to Staff', async (reason) => {
                                    const allUsers = await getUsers();
                                    const idx = allUsers.findIndex(user => user.id === u.id);
                                    if (idx !== -1) {
                                      allUsers[idx].role = 'staff';
                                      await saveUsers(allUsers);
                                      setUsers(allUsers);
                                      await logAction('promote_staff', u.id, `Promoted to staff. Reason: ${reason}`);
                                    }
                                  }, false)}
                                  className="px-2 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold rounded text-xs hover:bg-blue-500/30"
                                >
                                  Make Staff
                                </button>
                              )}
                              {u.isVerified && isOwner && (
                                <button
                                  onClick={() => executeWithConfirm('Remove Verification Badge', async (reason) => {
                                    await updateUserVerificationStatus(u.id, false);
                                    await logAction('remove_verification', u.id, `Removed verification badge. Reason: ${reason}`);
                                    await loadData();
                                  })}
                                  className="px-2 py-1 bg-red-500/20 text-red-600 dark:text-red-400 font-semibold rounded text-xs hover:bg-red-500/30 flex items-center gap-1"
                                >
                                  <XCircle size={12} /> Remove Verified
                                </button>
                              )}
                            </>
                          )}
                          {isOwner && u.role === 'staff' && (
                            <button
                              onClick={() => executeWithConfirm('Remove Staff Permissions', async (reason) => {
                                const allUsers = await getUsers();
                                const idx = allUsers.findIndex(user => user.id === u.id);
                                if (idx !== -1) {
                                  allUsers[idx].role = 'user';
                                  await saveUsers(allUsers);
                                  setUsers(allUsers);
                                  await logAction('remove_staff', u.id, `Removed staff permissions. Reason: ${reason}`);
                                }
                              })}
                              className="px-2 py-1 bg-orange-500/20 text-orange-600 dark:text-orange-400 font-semibold rounded text-xs hover:bg-orange-500/30"
                            >
                              Remove Staff
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'appeals' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">Pending Appeals</h2>
              {appeals.filter(a => a.status === 'pending').map(appeal => {
                const u = users.find(u => u.id === appeal.userId);
                const vid = appeal.videoId ? videos.find(v => v.id === appeal.videoId) : null;
                return (
                  <div key={appeal.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold">@{u?.handle}</p>
                        <p className="text-xs text-zinc-500">{appeal.videoId ? 'Video Removal Appeal' : 'Ban Appeal'}</p>
                      </div>
                      {vid && (
                        <button onClick={() => setPreviewVideo(vid)} className="text-pink-600 text-xs font-bold hover:underline">
                          View Removed Video
                        </button>
                      )}
                    </div>
                    <div className="bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg text-sm mb-4">
                      "{appeal.reason}"
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resolveAppeal(appeal, 'accepted')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm flex items-center gap-1">
                        <CheckCircle size={16} /> Accept Appeal
                      </button>
                      <button onClick={() => resolveAppeal(appeal, 'rejected')} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm flex items-center gap-1">
                        <XCircle size={16} /> Reject Appeal
                      </button>
                    </div>
                  </div>
                );
              })}
              {appeals.filter(a => a.status === 'pending').length === 0 && <p className="text-zinc-500">No pending appeals.</p>}
            </div>
          )}

          {activeTab === 'logs' && isOwner && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <h2 className="text-xl font-bold">Audit Logs</h2>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="text" 
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs..." 
                    className="pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:border-pink-500 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                {filteredLogs.map(log => {
                  const admin = users.find(u => u.id === log.adminId);
                  return (
                    <div key={log.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-sm flex flex-col sm:flex-row sm:gap-4 sm:items-center">
                      <div className="text-zinc-500 w-full sm:w-32 shrink-0">{new Date(log.timestamp).toLocaleString()}</div>
                      <div className="font-semibold w-full sm:w-32 truncate">@{admin?.handle || 'unknown'}</div>
                      <div className="font-mono text-xs bg-zinc-100 dark:bg-zinc-950 px-2 py-1 rounded w-max sm:w-32 my-2 sm:my-0">{log.action}</div>
                      <div className="flex-1">{log.details}</div>
                      <button
                        onClick={() => executeWithConfirm('Redo Audit Action', async () => redoAuditAction(log), false)}
                        className="p-2 text-zinc-500 hover:text-pink-600"
                        title="Redo action"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  );
                })}
                {filteredLogs.length === 0 && <p className="text-zinc-500">No audit logs available.</p>}
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Megaphone className="text-pink-600" /> Create Announcement
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Creation Form */}
                  <div className="space-y-4 bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Announcement Text</label>
                      <textarea
                        value={newAnnouncement.text}
                        onChange={e => setNewAnnouncement(prev => ({ ...prev, text: e.target.value }))}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 outline-none focus:border-pink-500 min-h-[100px] resize-none"
                        placeholder="Type your announcement here..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Target Type</label>
                        <select
                          value={newAnnouncement.type}
                          onChange={e => setNewAnnouncement(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500"
                        >
                          <option value="global">Global (All Pages)</option>
                          <option value="page">Specific Page</option>
                          <option value="game">Specific Games</option>
                        </select>
                      </div>

                      {newAnnouncement.type === 'page' && (
                        <div>
                          <label className="block text-sm font-semibold mb-2">Target Page</label>
                          <select
                            value={newAnnouncement.targetPage}
                            onChange={e => setNewAnnouncement(prev => ({ ...prev, targetPage: e.target.value }))}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500"
                          >
                            <option value="">Select Page</option>
                            <option value="/">For You / Home</option>
                            <option value="/explore">Explore</option>
                            <option value="/inbox">Inbox</option>
                            <option value="/games-apps">Games & Apps</option>
                            <option value="/profile">Profile</option>
                          </select>
                        </div>
                      )}

                      {newAnnouncement.type === 'game' && (
                        <div className="col-span-2">
                          <label className="block text-sm font-semibold mb-2">Target Games & Apps</label>
                          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 max-h-[200px] overflow-y-auto">
                            <div className="flex flex-wrap gap-2">
                              {[...GAMES, ...APPS].map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    const ids = newAnnouncement.targetGameIds || [];
                                    if (ids.includes(item.title)) {
                                      setNewAnnouncement(prev => ({ ...prev, targetGameIds: ids.filter(id => id !== item.title) }));
                                    } else {
                                      setNewAnnouncement(prev => ({ ...prev, targetGameIds: [...ids, item.title] }));
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                                    (newAnnouncement.targetGameIds || []).includes(item.title)
                                      ? 'bg-pink-600 text-white'
                                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300'
                                  }`}
                                >
                                  {item.title}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-2 italic">Click titles to toggle selection. Announcements will show when these games are active.</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                          <Palette size={14} /> Color
                        </label>
                        <select
                          value={newAnnouncement.color}
                          onChange={e => setNewAnnouncement(prev => ({ ...prev, color: e.target.value }))}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500"
                        >
                          <option value="bg-pink-600">Pink</option>
                          <option value="bg-blue-600">Blue</option>
                          <option value="bg-green-600">Green</option>
                          <option value="bg-orange-500">Orange</option>
                          <option value="bg-red-600">Red</option>
                          <option value="bg-zinc-900">Black</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                          <Maximize size={14} /> Size
                        </label>
                        <select
                          value={newAnnouncement.size}
                          onChange={e => setNewAnnouncement(prev => ({ ...prev, size: e.target.value as any }))}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500"
                        >
                          <option value="sm">Small</option>
                          <option value="md">Medium</option>
                          <option value="lg">Large</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                          <Calendar size={14} /> Duration
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="number"
                            min="1"
                            disabled={announcementUnit === 'never'}
                            value={announcementAmount}
                            onChange={e => setAnnouncementAmount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500 text-sm disabled:opacity-50"
                          />
                          <select
                            value={announcementUnit}
                            onChange={e => setAnnouncementUnit(e.target.value as any)}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500 text-sm"
                          >
                            <option value="secs">Seconds</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                            <option value="never">Permanent</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                          <Calendar size={14} /> Scheduled Date
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={e => setScheduledDate(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                          <Calendar size={14} /> Scheduled Time
                        </label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={e => setScheduledTime(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-sm flex items-center gap-2">
                          <Target size={16} className="text-pink-600" /> Action Button
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Button Text (e.g. Play Now)"
                          value={newAnnouncement.actionButtonText}
                          onChange={e => setNewAnnouncement(prev => ({ ...prev, actionButtonText: e.target.value }))}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-sm outline-none focus:border-pink-500"
                        />
                        <input
                          type="text"
                          placeholder="Link (e.g. /games-apps)"
                          value={newAnnouncement.actionButtonLink}
                          onChange={e => setNewAnnouncement(prev => ({ ...prev, actionButtonLink: e.target.value }))}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-sm outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-sm flex items-center gap-2">
                          <Users size={16} className="text-blue-600" /> Interaction Poll
                        </label>
                        <button
                          onClick={() => setNewAnnouncement(prev => ({ ...prev, isPoll: !prev.isPoll }))}
                          className={`w-12 h-6 rounded-full transition-all relative ${newAnnouncement.isPoll ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newAnnouncement.isPoll ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                      
                      {newAnnouncement.isPoll && (
                        <div className="space-y-2">
                          {newAnnouncement.pollOptions?.map((option, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                placeholder={`Option ${idx + 1}`}
                                value={option}
                                onChange={e => {
                                  const newOptions = [...(newAnnouncement.pollOptions || [])];
                                  newOptions[idx] = e.target.value;
                                  setNewAnnouncement(prev => ({ ...prev, pollOptions: newOptions }));
                                }}
                                className="flex-grow bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
                              />
                              {idx > 1 && (
                                <button
                                  onClick={() => {
                                    const newOptions = newAnnouncement.pollOptions?.filter((_, i) => i !== idx);
                                    setNewAnnouncement(prev => ({ ...prev, pollOptions: newOptions }));
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                          {(newAnnouncement.pollOptions?.length || 0) < 4 && (
                            <button
                              onClick={() => setNewAnnouncement(prev => ({ ...prev, pollOptions: [...(prev.pollOptions || []), ''] }))}
                              className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:underline"
                            >
                              <Plus size={12} /> Add Option
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                          Timer (Disappears in)
                        </label>
                        <select
                          value={newAnnouncement.displayDuration}
                          onChange={e => setNewAnnouncement(prev => ({ ...prev, displayDuration: parseInt(e.target.value) }))}
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 outline-none focus:border-pink-500"
                        >
                          <option value="0">Permanent</option>
                          <option value="5">5 Seconds</option>
                          <option value="10">10 Seconds</option>
                          <option value="15">15 Seconds</option>
                          <option value="30">30 Seconds</option>
                          <option value="60">1 Minute</option>
                        </select>
                      </div>

                      {(newAnnouncement.type === 'page' && newAnnouncement.targetPage === '/games-apps') && (
                        <div className="flex items-center gap-3 pt-6">
                          <button
                            onClick={() => setNewAnnouncement(prev => ({ ...prev, hideDuringGameplay: !prev.hideDuringGameplay }))}
                            className={`w-12 h-6 rounded-full transition-all relative ${newAnnouncement.hideDuringGameplay ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newAnnouncement.hideDuringGameplay ? 'left-7' : 'left-1'}`} />
                          </button>
                          <label className="text-xs font-semibold">Hide during gameplay</label>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-6">
                        <button
                          onClick={() => setNewAnnouncement(prev => ({ ...prev, allowDismiss: !prev.allowDismiss }))}
                          className={`w-12 h-6 rounded-full transition-all relative ${newAnnouncement.allowDismiss ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newAnnouncement.allowDismiss ? 'left-7' : 'left-1'}`} />
                        </button>
                        <label className="text-xs font-semibold">Allow users to close (X)</label>
                      </div>
                    </div>

                    <button
                      onClick={handleCreateAnnouncement}
                      className="w-full py-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={20} /> Launch Announcement
                    </button>
                  </div>

                  {/* Preview Section */}
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold mb-2 text-zinc-500 uppercase tracking-widest">Live Preview</label>
                    <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 flex items-center justify-center min-h-[200px] bg-zinc-50/50 dark:bg-zinc-950/50">
                      {newAnnouncement.text ? (
                        <div className={`relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden border flex items-center gap-4 animate-pulse
                          ${newAnnouncement.size === 'sm' ? 'p-3 text-sm' : newAnnouncement.size === 'md' ? 'p-4 text-base' : 'p-6 text-lg'}
                          ${newAnnouncement.color} text-white border-white/20
                        `}>
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                            <Megaphone size={20} />
                          </div>
                          <div className="flex-grow font-bold tracking-tight leading-snug">
                            {newAnnouncement.text}
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-400 flex flex-col items-center gap-2">
                          <Ghost size={40} className="opacity-20" />
                          <p className="text-sm">Enter text to see preview</p>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl">
                      <div className="flex gap-3 text-blue-600 dark:text-blue-400">
                        <Target size={20} className="shrink-0" />
                        <div className="text-sm">
                          <p className="font-bold">Targeting Summary</p>
                          <p className="opacity-80">
                            This announcement will be shown {newAnnouncement.type === 'global' ? 'everywhere in the app' : 
                                                            newAnnouncement.type === 'page' ? `on the ${newAnnouncement.targetPage} page` : 
                                                            `to players of: ${(newAnnouncement.targetGameIds || []).join(', ') || 'No games selected'}`}.
                            {newAnnouncement.hideDuringGameplay && <span className="block font-bold text-pink-600 mt-1">Will hide automatically when a game starts.</span>}
                            {newAnnouncement.displayDuration! > 0 && <span className="block text-[10px] opacity-70 mt-1">Disappears {newAnnouncement.displayDuration}s after appearing.</span>}
                            {!newAnnouncement.allowDismiss && <span className="block font-bold text-red-500 mt-1">Users cannot manually close this!</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                   Active & Recent Announcements ({announcements.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {announcements.map(ann => (
                    <div key={ann.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-start gap-4 shadow-sm group">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ann.color} text-white`}>
                        <Megaphone size={20} />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            ann.type === 'global' ? 'bg-purple-100 text-purple-600' :
                            ann.type === 'page' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {ann.type}
                          </span>
                          {!ann.active && <span className="text-[10px] font-black uppercase bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">Inactive</span>}
                        </div>
                        <p className="font-bold text-sm mb-2 line-clamp-2">{ann.text}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-[10px] text-zinc-400">
                              {ann.expiresAt ? `Expires: ${new Date(ann.expiresAt).toLocaleDateString()}` : 'Never Expires'}
                            </span>
                            {ann.displayDuration ? (
                              <span className="text-[10px] text-zinc-500 font-bold bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded">
                                Timer: {ann.displayDuration}s
                              </span>
                            ) : (
                              <span className="text-[10px] text-green-500 font-bold">Permanent</span>
                            )}
                            {ann.hideDuringGameplay && (
                              <span className="text-[10px] text-pink-500 font-bold">Hides in Game</span>
                            )}
                            {ann.allowDismiss === false && (
                              <span className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-950/30 px-1.5 rounded">Mandatory</span>
                            )}
                          </div>
                          <button 
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {announcements.length === 0 && (
                    <div className="col-span-full py-12 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                      No active announcements found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verification' && isOwner && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Verification Requests</h2>
                  <p className="text-sm text-zinc-500 mt-1">Review students requesting the holographic verification badge.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800">
                  {verificationRequests.filter(r => r.status === 'pending').length} Pending
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {verificationRequests.filter(r => r.status === 'pending').map((request) => {
                  const user = users.find(u => u.id === request.userId);
                  const approves = Object.values(request.votes || {}).filter(v => v === 'approve').length;
                  const rejects = Object.values(request.votes || {}).filter(v => v === 'reject').length;
                  const myVote = currentUser ? request.votes?.[currentUser.id] : null;

                  return (
                    <div key={request.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row">
                      <div className="md:w-64 aspect-[3/4] bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative group">
                        <img 
                          src={request.schoolIdUrl} 
                          className="w-full h-full object-cover cursor-zoom-in transition-transform group-hover:scale-110" 
                          alt="School ID Proof" 
                          onClick={() => setZoomedImage(request.schoolIdUrl)}
                        />
                        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest border border-white/20">
                          School ID
                        </div>
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                           <Maximize className="text-white" size={24} />
                        </div>
                      </div>
                      {request.photoUrl && (
                        <div className="md:w-32 aspect-[3/4] bg-zinc-200 dark:bg-zinc-800 border-l border-zinc-300 dark:border-zinc-700 overflow-hidden relative group">
                           <img 
                            src={request.photoUrl} 
                            className="w-full h-full object-cover cursor-zoom-in transition-transform group-hover:scale-110" 
                            alt="Selfie" 
                            onClick={() => setZoomedImage(request.photoUrl!)}
                           />
                           <div className="absolute bottom-1 left-1 bg-black/30 text-[8px] text-white px-1 rounded">Selfie</div>
                           <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                              <Maximize className="text-white" size={16} />
                           </div>
                        </div>
                      )}
                      
                      <div className="flex-1 p-6 flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-black">{request.firstName} {request.lastName}</h3>
                            <p className="text-sm text-zinc-500">@{user?.handle || 'Unknown'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">{new Date(request.createdAt).toLocaleDateString()}</p>
                            <div className="flex gap-1 mt-1 justify-end">
                              <span className="text-[10px] font-black text-green-600 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                Approve: {approves}
                              </span>
                              <span className="text-[10px] font-black text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                                Reject: {rejects}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 space-y-4">
                          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">Reason for Verification</p>
                            <p className="text-sm italic text-zinc-700 dark:text-zinc-300">"{request.reason}"</p>
                          </div>
                          
                          <p className="text-[10px] text-zinc-500 italic">
                            * Remember: Only verify if they are actually known around the school. Approval requires multiple mod votes.
                          </p>
                        </div>

                        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3">
                          <button
                            onClick={() => voteOnVerificationRequest(request.id, currentUser!.id, 'approve')}
                            disabled={myVote === 'approve'}
                            className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                              myVote === 'approve' 
                                ? 'bg-green-100 text-green-600 border-2 border-green-200 cursor-default' 
                                : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20'
                            }`}
                          >
                            <CheckCircle size={18} />
                            {myVote === 'approve' ? 'Voted Approve' : 'Vote Approve'}
                          </button>
                          
                          <button
                            onClick={() => voteOnVerificationRequest(request.id, currentUser!.id, 'reject')}
                            disabled={myVote === 'reject'}
                            className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                              myVote === 'reject' 
                                ? 'bg-red-100 text-red-600 border-2 border-red-200 cursor-default' 
                                : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
                            }`}
                          >
                            <XCircle size={18} />
                            {myVote === 'reject' ? 'Voted Reject' : 'Vote Reject'}
                          </button>

                          {(approves >= 1) && (
                            <button
                              onClick={async () => {
                                await updateVerificationRequestStatus(request.id, 'approved');
                                await updateUserVerificationStatus(request.userId, true);
                                await logAction('verify_user', request.userId, `Verified user ${request.firstName} ${request.lastName} after vote.`);
                              }}
                              className="w-full mt-2 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                              Finalize Approval & Verify
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {verificationRequests.filter(r => r.status === 'pending').length === 0 && (
                  <div className="py-20 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                    <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">Inbox Clear</p>
                    <p className="text-xs">No pending verification requests at this time.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'centralpro' && isMod && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Rocket className="text-cyan-500" size={24} />
                    <h2 className="text-xl font-bold">CentralPro Payment Review (Priority Support)</h2>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    Verify student purchases on Cash App (<span className="text-emerald-500 font-bold">$ZaelLac</span>). Look for their CentralTok username in the payment note.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshCentralProList}
                    disabled={isRefreshingCP}
                    className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="Refresh requests"
                  >
                    <RotateCcw size={14} className={isRefreshingCP ? 'animate-spin text-cyan-400' : ''} />
                    <span>{isRefreshingCP ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>{centralProRequests.filter(r => r.status === 'pending').length} Pending Review</span>
                  </div>
                </div>
              </div>

              {/* Instructions banner for admins */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-indigo-950/40 border border-cyan-500/30 text-xs text-zinc-300 space-y-1">
                <p className="font-bold text-cyan-300">How to process CentralPro requests:</p>
                <p>1. Open Cash App on phone/web and check activity for payments sent to <span className="font-black text-emerald-400">$ZaelLac</span>.</p>
                <p>2. Match the sender's note with their CentralTok username (e.g. "@username").</p>
                <p>3. If they paid: Click <span className="font-bold text-emerald-400">Accept Payment</span>. CentralPro perks will be granted automatically and a welcome notification will be sent!</p>
                <p>4. If they did not pay or note was missing: Click <span className="font-bold text-red-400">Decline</span>. They will be notified that their payment was declined.</p>
              </div>

              {/* Requests list */}
              <div className="grid grid-cols-1 gap-4">
                {centralProRequests.map(req => {
                  const targetUser = users.find(u => u.id === req.userId);
                  const isProcessing = centralProProcessing === req.id;

                  return (
                    <div 
                      key={req.id} 
                      className={`border rounded-2xl p-5 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        req.status === 'pending'
                          ? 'border-cyan-500/50 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                          : req.status === 'accepted'
                          ? 'border-emerald-500/30 bg-emerald-950/10 opacity-75'
                          : 'border-zinc-800 bg-zinc-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img 
                          src={targetUser?.avatarUrl || req.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                          alt="" 
                          className="w-14 h-14 rounded-2xl object-cover border border-cyan-400/40 shrink-0" 
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-base text-white truncate">
                              {targetUser?.username || req.username}
                            </span>
                            <span className="text-xs text-zinc-400">@{targetUser?.handle || req.handle}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              req.plan === 'forever' 
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' 
                                : 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40'
                            }`}>
                              {req.plan === 'forever' ? '$1 Forever' : '$0.50 Monthly'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              req.status === 'pending' 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                                : req.status === 'accepted'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-red-500/20 text-red-400 border border-red-500/40'
                            }`}>
                              {req.status === 'pending' ? 'Needs Review' : req.status === 'accepted' ? 'Approved' : 'Declined'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            Requested {new Date(req.timestamp).toLocaleString()} • Note to look for in Cash App: <span className="font-mono text-cyan-300 font-bold">@{req.handle}</span>
                          </p>
                        </div>
                      </div>

                      {req.status === 'pending' ? (
                        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
                          <button
                            disabled={isProcessing}
                            onClick={async () => {
                              setCentralProProcessing(req.id);
                              try {
                                await approveCentralProPayment(req.id, currentUser!);
                                setCentralProRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'accepted' } : r));
                                const freshUsers = await getUsers();
                                setUsers(freshUsers);
                                await logAction('centralpro_approve', req.userId, `Approved CentralPro payment for @${req.handle} (${req.plan}).`);
                              } catch (err) {
                                console.error(err);
                                alert("Failed to approve CentralPro payment.");
                              } finally {
                                setCentralProProcessing(null);
                              }
                            }}
                            className="flex-1 md:flex-initial px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-50"
                          >
                            <CheckCircle size={16} />
                            <span>{isProcessing ? 'Approving...' : 'Accept Payment'}</span>
                          </button>

                          <button
                            disabled={isProcessing}
                            onClick={async () => {
                              setCentralProProcessing(req.id);
                              try {
                                await declineCentralProPayment(req.id, currentUser!);
                                setCentralProRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'declined' } : r));
                                await logAction('centralpro_decline', req.userId, `Declined CentralPro payment for @${req.handle}.`);
                              } catch (err) {
                                console.error(err);
                                alert("Failed to decline CentralPro payment.");
                              } finally {
                                setCentralProProcessing(null);
                              }
                            }}
                            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-red-950/60 hover:text-red-400 text-zinc-300 font-bold text-xs uppercase tracking-wider border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <XCircle size={16} />
                            <span>Decline</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 italic">
                          Reviewed {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : ''}
                        </div>
                      )}
                    </div>
                  );
                })}

                {centralProRequests.length === 0 && (
                  <div className="py-20 text-center text-zinc-500 bg-zinc-50 dark:bg-zinc-950 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                    <Rocket size={48} className="mx-auto mb-4 opacity-20 text-cyan-500" />
                    <p className="font-bold text-zinc-300">No CentralPro Requests Yet</p>
                    <p className="text-xs text-zinc-500 mt-1">When users click Confirm Purchase, requests will appear here for verification.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'suggestions' && isOwner && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">App Suggestions</h2>
                  <p className="text-sm text-zinc-500 mt-1">Review student ideas for new games or apps.</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-3 py-1 rounded-full text-xs font-bold border border-amber-100 dark:border-amber-800">
                  {suggestions.filter(s => s.status === 'pending').length} New
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.sort((a, b) => b.createdAt - a.createdAt).map((suggestion) => {
                  const user = users.find(u => u.id === suggestion.userId);
                  return (
                    <div key={suggestion.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl ${suggestion.type === 'game' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {suggestion.type === 'game' ? <Gamepad2 size={20} /> : <LayoutIcon size={20} />}
                          </div>
                          <div>
                            <h3 className="font-black text-lg">{suggestion.name}</h3>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                              By {user?.handle || 'Unknown'} • {new Date(suggestion.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                          suggestion.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                          suggestion.status === 'reviewed' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {suggestion.status}
                        </span>
                      </div>
                      
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 mb-6 italic">
                        "{suggestion.description}"
                      </p>

                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, 'app_suggestions', suggestion.id), { status: 'reviewed' });
                            await logAction('review_suggestion', suggestion.id, `Reviewed suggestion: ${suggestion.name}`);
                          }}
                          className="flex-1 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-bold hover:bg-zinc-300 transition-colors"
                        >
                          Mark Reviewed
                        </button>
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, 'app_suggestions', suggestion.id), { status: 'implemented' });
                            await logAction('implement_suggestion', suggestion.id, `Implemented suggestion: ${suggestion.name}`);
                          }}
                          className="flex-1 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
                        >
                          Implemented
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {suggestions.length === 0 && (
                <div className="py-20 text-center text-zinc-500">
                  <Lightbulb size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold">No Suggestions Yet</p>
                  <p className="text-xs">Students haven't suggested any apps or games yet.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && isOwner && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold mb-2">Global App Settings</h2>
                <p className="text-zinc-500 text-sm mb-6">Manage high-level system behaviors. These changes affect all users instantly.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* YouTube Cache */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">YouTube Data Caching</h3>
                        <p className="text-xs text-zinc-500 mt-1">
                          Prefer pre-fetched feed to save quota.
                        </p>
                      </div>
                      <button 
                        onClick={toggleCache}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                          appSettings.useCache ? 'bg-pink-600' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            appSettings.useCache ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                      appSettings.useCache ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800'
                    }`}>
                      Status: {appSettings.useCache ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  {/* API Strategy */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold text-lg mb-2">YouTube API Strategy</h3>
                    <p className="text-xs text-zinc-500 mb-4">Choose a specific key or use automatic rotation.</p>
                    <select 
                      value={appSettings.youtubeApiKeyIndex}
                      onChange={(e) => updateApiIndex(parseInt(e.target.value))}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 rounded-lg outline-none focus:border-pink-500"
                    >
                      <option value={0}>Automatic (Rotation)</option>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(idx => (
                        <option key={idx} value={idx}>YOUTUBE API KEY {idx}</option>
                      ))}
                    </select>
                  </div>

                  {/* Crash Buttons */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                         <Power className={appSettings.serverCrashed ? 'text-red-500' : 'text-green-500'} />
                         <h3 className="font-bold">System Server</h3>
                       </div>
                       <button 
                         onClick={() => handleCrashAction('server', appSettings.serverCrashed)}
                         className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all ${
                           appSettings.serverCrashed 
                             ? 'bg-green-600 text-white hover:bg-green-700' 
                             : 'bg-red-600 text-white hover:bg-red-700'
                         }`}
                       >
                         {appSettings.serverCrashed ? 'Recover Server' : 'Self Crash'}
                       </button>
                    </div>
                    <p className="text-xs text-zinc-500">Crashes the entire video feed system for all users.</p>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                         <Gamepad2 className={appSettings.gamesAppsCrashed ? 'text-red-500' : 'text-green-500'} />
                         <h3 className="font-bold">Games & Apps</h3>
                       </div>
                       <button 
                         onClick={() => handleCrashAction('games', appSettings.gamesAppsCrashed)}
                         className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all ${
                           appSettings.gamesAppsCrashed 
                             ? 'bg-green-600 text-white hover:bg-green-700' 
                             : 'bg-red-600 text-white hover:bg-red-700'
                         }`}
                       >
                         {appSettings.gamesAppsCrashed ? 'Enable' : 'Shutdown'}
                       </button>
                    </div>
                    <p className="text-xs text-zinc-500">Disables access to the Games & Apps section.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && isOwner && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Platform Analytics & Insights</h2>
                  <p className="text-zinc-500 text-sm">Real-time engagement metrics, video category breakdown, and growth analytics.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ videos, users, reports, timestamp: Date.now() }, null, 2));
                      const dlAnchorElem = document.createElement('a');
                      dlAnchorElem.setAttribute("href", dataStr);
                      dlAnchorElem.setAttribute("download", `platform_analytics_${Date.now()}.json`);
                      dlAnchorElem.click();
                    }}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-pink-600/20"
                  >
                    Export Analytics JSON
                  </button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Videos</p>
                  <p className="text-3xl font-black text-pink-600">{videos.length}</p>
                  <p className="text-[10px] text-green-500 font-semibold mt-2">+12% from last week</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Registered Users</p>
                  <p className="text-3xl font-black text-indigo-500">{users.length}</p>
                  <p className="text-[10px] text-green-500 font-semibold mt-2">+8% new signups</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Views</p>
                  <p className="text-3xl font-black text-amber-500">
                    {videos.reduce((acc, v) => acc + (v.views || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-green-500 font-semibold mt-2">High engagement rate</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Pending Reports</p>
                  <p className="text-3xl font-black text-red-500">{reports.filter(r => r.status === 'pending').length}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold mt-2">Requires moderation</p>
                </div>
              </div>

              {/* Recharts 1: Trending Video Categories (BarChart) */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold mb-2">Trending Video Categories (Views & Count)</h3>
                <p className="text-xs text-zinc-500 mb-6">Distribution of views and uploaded videos across different categories.</p>
                
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.values(videos.reduce((acc, v) => {
                      const cat = v.category || 'General';
                      if (!acc[cat]) acc[cat] = { category: cat, views: 0, count: 0, likes: 0 };
                      acc[cat].views += (v.views || 0);
                      acc[cat].likes += (v.likes || 0);
                      acc[cat].count += 1;
                      return acc;
                    }, {} as Record<string, { category: string; views: number; count: number; likes: number }>))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="category" stroke="#888888" fontSize={12} />
                      <YAxis stroke="#888888" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }}
                      />
                      <Legend />
                      <Bar dataKey="views" fill="#db2777" name="Total Views" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="likes" fill="#6366f1" name="Total Likes" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recharts 2: Top Video Engagement Metrics (AreaChart) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-bold mb-2">Top Video Engagement (Likes & Comments)</h3>
                  <p className="text-xs text-zinc-500 mb-6">Comparing interaction rates on top platform videos.</p>
                  
                  <div className="w-full h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={videos.slice(0, 8).map((v, i) => ({
                        title: v.title ? v.title.substring(0, 12) + '...' : `Video ${i+1}`,
                        likes: v.likes || 0,
                        comments: v.commentsCount || (v.comments ? v.comments.length : 0),
                        shares: v.shares || 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="title" stroke="#888888" fontSize={10} />
                        <YAxis stroke="#888888" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }} />
                        <Legend />
                        <Area type="monotone" dataKey="likes" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} name="Likes" />
                        <Area type="monotone" dataKey="comments" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Comments" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recharts 3: User Role Breakdown (PieChart) */}
                <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-bold mb-2">User Roles & Verification Breakdown</h3>
                  <p className="text-xs text-zinc-500 mb-6">Proportion of regular users, staff, and owners.</p>
                  
                  <div className="w-full h-[280px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Users', value: users.filter(u => u.role === 'user' || !u.role).length },
                            { name: 'Staff', value: users.filter(u => u.role === 'staff').length },
                            { name: 'Owners', value: users.filter(u => u.role === 'owner').length },
                            { name: 'Verified', value: users.filter(u => u.isVerified).length },
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#ec4899" />
                          <Cell fill="#6366f1" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#10b981" />
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {previewVideo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-black rounded-3xl w-full max-w-sm aspect-[9/16] relative overflow-hidden shadow-2xl border border-zinc-800"
            >
              <button 
                onClick={() => setPreviewVideo(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
              >
                <XCircle size={24} />
              </button>
              
              {previewVideo.isYouTube ? (
                <iframe 
                  src={`https://www.youtube.com/embed/${previewVideo.youtubeId}?autoplay=1&mute=0`}
                  className="w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video 
                  src={previewVideo.videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-cover"
                />
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white font-bold">{previewVideo.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {previewVideo.tags.map(t => (
                    <span key={t} className="text-pink-400 text-xs">#{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Modal */}
      {pinModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl border border-zinc-800 text-center"
          >
            <Settings className="w-12 h-12 mx-auto mb-4 text-pink-600" />
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">{pinModal.title}</h3>
            <p className="text-zinc-500 text-sm mb-6">Enter Owner PIN to proceed</p>
            
            <div className="space-y-4">
              <input 
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                className={`w-full bg-zinc-100 dark:bg-zinc-950 border-2 ${pinError ? 'border-red-500' : 'border-zinc-800'} rounded-2xl py-4 text-center text-3xl font-black tracking-[1em] outline-none transition-all`}
                autoFocus
              />
              {pinError && <p className="text-red-500 text-xs font-bold uppercase animate-bounce">Invalid PIN</p>}
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setPinModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 font-black bg-zinc-200 dark:bg-zinc-800 rounded-2xl uppercase text-xs"
                >
                  Cancel
                </button>
                <button 
                  onClick={verifyPin}
                  className="flex-1 py-4 font-black bg-pink-600 text-white rounded-2xl uppercase text-xs shadow-lg shadow-pink-600/30"
                >
                  Verify
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Crash Animation Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white"
          >
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-[12rem] font-black leading-none"
            >
              {countdown}
            </motion.div>
            <p className="text-xl font-bold uppercase tracking-[0.5em] mt-8 text-red-500">Executing Payload</p>
            {countdown === 0 && (
               <motion.div 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="mt-8 text-2xl font-black text-red-600 uppercase"
               >
                 {pinModal.title.includes('Server') ? 'Servers has crashed' : 'Games & Apps has crashed'}
               </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-bold mb-4">{confirmModal.title}</h3>
            {confirmModal.requireReason ? (
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">
                  {confirmModal.reasonLabel || 'Reason for Action (Required)'}
                </label>
                <textarea 
                  value={actionReason}
                  onChange={e => setActionReason(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-pink-500 focus:outline-none resize-none min-h-[100px]"
                  placeholder={confirmModal.reasonPlaceholder || 'Provide a detailed reason for this action...'}
                />

                {confirmModal.isBanAction && (
                  <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={wipeSystemCheck}
                          onChange={e => setWipeSystemCheck(e.target.checked)}
                          className="w-4 h-4 rounded border-emerald-500 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 bg-zinc-900 cursor-pointer accent-emerald-500"
                        />
                        <span className="text-emerald-400 font-mono font-black text-xs tracking-wider uppercase drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                          Completely WIPE OUT OF SYSTEM
                        </span>
                      </label>
                      
                      <div className="relative group">
                        <button
                          type="button"
                          className="w-5 h-5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 font-black text-xs flex items-center justify-center transition-all"
                        >
                          !
                        </button>
                        <div className="absolute right-0 bottom-full mb-2 w-64 p-2.5 bg-zinc-950/95 backdrop-blur-md border border-emerald-500/40 rounded-xl text-[11px] text-zinc-200 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-sans">
                          Remove this user from the system and it will delete them from the firebase, no one will be able to see that person again.
                        </div>
                      </div>
                    </div>

                    {/* Animated Typewriter Binary */}
                    <div className="mt-2 font-mono text-[9px] text-emerald-500/70 overflow-hidden whitespace-nowrap tracking-widest select-none flex items-center gap-1">
                      <span>&gt;&gt;</span>
                      <motion.span
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        {wipeSystemCheck ? 'SYS_PURGE_ENGAGED: ' + binaryCode : binaryCode}
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="w-1.5 h-3 bg-emerald-400 inline-block"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 mb-6">Are you sure you want to perform this action?</p>
            )}
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setConfirmModal({ isOpen: false, title: '', action: async () => {}, requireReason: false });
                  setActionReason('');
                }}
                disabled={confirmModal.loading}
                className="flex-1 py-3 font-semibold bg-zinc-200 dark:bg-zinc-800 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAction}
                disabled={(confirmModal.requireReason && !actionReason.trim()) || confirmModal.loading}
                className="flex-1 py-3 font-semibold bg-pink-600 text-white rounded-xl disabled:opacity-50 hover:bg-pink-700 transition-colors flex items-center justify-center gap-2"
              >
                {confirmModal.loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Processing...
                  </>
                ) : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp Ban Duration Modal */}
      {tempBanModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-bold mb-4">Temporary Ban: @{tempBanModal.user?.handle}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Duration Amount & Unit</label>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="number"
                  min="1"
                  value={tempBanAmount}
                  onChange={e => setTempBanAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-pink-500 focus:outline-none"
                />
                <select
                  value={tempBanUnit}
                  onChange={e => setTempBanUnit(e.target.value as any)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-pink-500 focus:outline-none"
                >
                  <option value="secs">Seconds</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Reason for Temporary Ban (Required)</label>
              <textarea 
                value={tempBanReason}
                onChange={e => setTempBanReason(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-pink-500 focus:outline-none resize-none min-h-[100px]"
                placeholder="Specify the violation or reason for temporary ban..."
              />

              <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={wipeSystemCheck}
                      onChange={e => setWipeSystemCheck(e.target.checked)}
                      className="w-4 h-4 rounded border-emerald-500 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 bg-zinc-900 cursor-pointer accent-emerald-500"
                    />
                    <span className="text-emerald-400 font-mono font-black text-xs tracking-wider uppercase drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                      Completely WIPE OUT OF SYSTEM
                    </span>
                  </label>
                  
                  <div className="relative group">
                    <button
                      type="button"
                      className="w-5 h-5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 font-black text-xs flex items-center justify-center transition-all"
                    >
                      !
                    </button>
                    <div className="absolute right-0 bottom-full mb-2 w-64 p-2.5 bg-zinc-950/95 backdrop-blur-md border border-emerald-500/40 rounded-xl text-[11px] text-zinc-200 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 leading-relaxed font-sans">
                      Remove this user from the system and it will delete them from the firebase, no one will be able to see that person again.
                    </div>
                  </div>
                </div>

                <div className="mt-2 font-mono text-[9px] text-emerald-500/70 overflow-hidden whitespace-nowrap tracking-widest select-none flex items-center gap-1">
                  <span>&gt;&gt;</span>
                  <motion.span
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    {wipeSystemCheck ? 'SYS_PURGE_ENGAGED: ' + binaryCode : binaryCode}
                  </motion.span>
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-1.5 h-3 bg-emerald-400 inline-block"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setTempBanModal({ isOpen: false, user: null })}
                disabled={tempBanLoading}
                className="flex-1 py-3 font-semibold bg-zinc-200 dark:bg-zinc-800 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleApplyTempBan}
                disabled={!tempBanReason.trim() || tempBanLoading}
                className="flex-1 py-3 font-semibold bg-yellow-600 text-white rounded-xl disabled:opacity-50 hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
              >
                {tempBanLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Banning...
                  </>
                ) : 'Apply Temp Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-xl font-bold mb-4">Rename User: @{renameModal.user?.handle}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">New Display Name</label>
              <input 
                type="text"
                value={renameUsername}
                onChange={e => setRenameUsername(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-indigo-500 focus:outline-none"
                placeholder="New display name..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">New Handle (@)</label>
              <input 
                type="text"
                value={renameHandle}
                onChange={e => setRenameHandle(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-indigo-500 focus:outline-none"
                placeholder="New handle..."
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Reason for Renaming (Required)</label>
              <textarea 
                value={renameReason}
                onChange={e => setRenameReason(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 border border-transparent focus:border-indigo-500 focus:outline-none resize-none min-h-[100px]"
                placeholder="Specify why this user is being renamed..."
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setRenameModal({ isOpen: false, user: null })}
                disabled={renameLoading}
                className="flex-1 py-3 font-semibold bg-zinc-200 dark:bg-zinc-800 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleApplyRename}
                disabled={!renameReason.trim() || !renameUsername.trim() || !renameHandle.trim() || renameLoading}
                className="flex-1 py-3 font-semibold bg-indigo-600 text-white rounded-xl disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                {renameLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Renaming...
                  </>
                ) : 'Apply Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          >
            <button 
              onClick={() => setZoomedImage(null)}
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-full flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={zoomedImage} 
                alt="Zoomed" 
                className="max-w-full max-h-[85vh] object-contain transition-transform hover:scale-150 cursor-move"
                onDragStart={(e) => e.preventDefault()}
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[10px] font-black text-white uppercase tracking-widest pointer-events-none">
                Hover to Zoom • Click outside to close
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
