import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Settings, Monitor, Camera, Grid, 
  UserPlus, MessageSquare, Video, VideoOff,
  Phone, X, Check, Maximize2, Minimize2, Tv, Sparkles
} from 'lucide-react';
import { useAppStore } from '../store';
import { createCall, updateCall, addIceCandidate, subscribeToCall, deleteCall, getUsers, db } from '../lib/db';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CameraDeviceSelector } from './CameraDeviceSelector';

const servers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

// Web Audio API helper for real voice activity detection
function setupAudioAnalyzer(stream: MediaStream, onSpeakingChange: (speaking: boolean) => void): () => void {
  try {
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) return () => {};

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return () => {};

    const audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isSpeakingCurrent = false;
    let animId: number;

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      // Speech volume threshold (ranges 0-255)
      const speaking = average > 14;
      if (speaking !== isSpeakingCurrent) {
        isSpeakingCurrent = speaking;
        onSpeakingChange(speaking);
      }
      animId = requestAnimationFrame(checkVolume);
    };
    checkVolume();

    return () => {
      cancelAnimationFrame(animId);
      try {
        source.disconnect();
        analyser.disconnect();
        audioCtx.close().catch(() => {});
      } catch (e) {
        // ignore cleanup errors
      }
    };
  } catch (e) {
    console.warn("Could not setup audio analyzer:", e);
    return () => {};
  }
}

const getAvatarUrl = (user?: { avatarUrl?: string; username?: string }) => {
  if (user?.avatarUrl && user.avatarUrl.trim().length > 0) return user.avatarUrl;
  const seed = encodeURIComponent(user?.username || 'user');
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
};

export function CallOverlay() {
  const { isCalling, setIsCalling, callData, currentUser, setCallData, selectedCameraId } = useAppStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'active'>('idle');
  const [remoteMedia, setRemoteMedia] = useState<'none' | 'camera' | 'screen'>('none');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [isFullscreenStage, setIsFullscreenStage] = useState(false);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localAudioTrack = useRef<MediaStreamTrack | null>(null);
  const localCameraStream = useRef<MediaStream | null>(null);
  const localScreenStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  const audioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const videoTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  
  const callIdRef = useRef<string | null>(null);
  const isCallerRef = useRef<boolean>(false);

  const callUnsubRef = useRef<(() => void) | null>(null);
  const isSettingRemoteDesc = useRef<boolean>(false);
  const processedCandidates = useRef<Set<string>>(new Set());
  const candidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const cleanupTimerRef = useRef<any>(null);
  const localAnalyzerCleanupRef = useRef<(() => void) | null>(null);
  const remoteAnalyzerCleanupRef = useRef<(() => void) | null>(null);

  // Helper to attach and play remote audio without interrupting existing playback
  const attachRemoteAudio = () => {
    if (remoteAudioRef.current && remoteStream.current) {
      if (remoteAudioRef.current.srcObject !== remoteStream.current) {
        remoteAudioRef.current.srcObject = remoteStream.current;
      }
      if (remoteAudioRef.current.paused) {
        remoteAudioRef.current.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn("Auto-play waiting for user interaction:", e);
          }
        });
      }
    }
  };

  // Listen for incoming calls
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'calls'), 
      where('receiverId', '==', currentUser.id),
      where('status', '==', 'initiating')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Filter out stale calls older than 60 seconds
          if (data.timestamp && Date.now() - data.timestamp > 60000) return;

          if (!isCalling && callStatus === 'idle') {
            try {
              const users = await getUsers();
              const caller = users.find(u => u.id === data.callerId);
              if (caller) {
                isCallerRef.current = false;
                setCallData({ user: caller, type: data.type || 'voice' });
                setIsCalling(true);
                setCallStatus('ringing');
                callIdRef.current = data.id;
              }
            } catch (err) {
              console.error("Failed to load caller info:", err);
            }
          }
        }
      });
    }, (err) => {
      console.warn("Incoming calls snapshot warning:", err);
    });

    return () => unsub();
  }, [currentUser?.id, isCalling, callStatus, setCallData, setIsCalling]);

  // If ringing, listen to see if the caller hangs up before we answer
  useEffect(() => {
    if (callStatus === 'ringing' && callIdRef.current) {
      const unsub = subscribeToCall(callIdRef.current, (data) => {
        if (!data || data.status === 'ended') {
          handleEndCall(false);
        }
      });
      return () => unsub();
    }
  }, [callStatus]);

  // Handle Call Lifecycle for Caller
  useEffect(() => {
    if (!isCalling || !callData || !currentUser) return;

    if (callStatus === 'idle') {
      const isCaller = !callIdRef.current;
      if (isCaller) {
        isCallerRef.current = true;
        setCallStatus('calling');
        startCall();
      }
    }

    async function startCall() {
      // Clear any pending old call deletion timer
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      if (callUnsubRef.current) {
        callUnsubRef.current();
        callUnsubRef.current = null;
      }

      // Generate a unique session call ID
      const sessionCallId = `call_${currentUser!.id}_${callData!.user.id}_${Date.now()}`;
      callIdRef.current = sessionCallId;
      isCallerRef.current = true;
      processedCandidates.current.clear();
      candidatesQueue.current = [];
      isSettingRemoteDesc.current = false;
      
      const newPc = new RTCPeerConnection(servers);
      pc.current = newPc;
      remoteStream.current = new MediaStream();

      // Pre-add transceivers for both audio and video
      // This is the critical WebRTC requirement: ensures m=audio and m=video are in the initial SDP
      // so replaceTrack() for camera and screenshare works in real-time without renegotiation!
      const audioTransceiver = newPc.addTransceiver('audio', { direction: 'sendrecv' });
      const videoTransceiver = newPc.addTransceiver('video', { direction: 'sendrecv' });
      audioTransceiverRef.current = audioTransceiver;
      videoTransceiverRef.current = videoTransceiver;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          localAudioTrack.current = audioTrack;
          await audioTransceiver.sender.replaceTrack(audioTrack);

          // Setup real voice activity analyzer
          localAnalyzerCleanupRef.current?.();
          localAnalyzerCleanupRef.current = setupAudioAnalyzer(new MediaStream([audioTrack]), setIsSpeaking);
        }
      } catch (err) {
        console.error("Microphone error:", err);
      }

      // If initial call type is video, attempt to turn on camera right away
      if (callData!.type === 'video') {
        try {
          const videoConstraints = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true;
          const camStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
          const camTrack = camStream.getVideoTracks()[0];
          if (camTrack) {
            localCameraStream.current = camStream;
            await videoTransceiver.sender.replaceTrack(camTrack);
            setIsCameraOn(true);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = camStream;
              localVideoRef.current.play().catch(() => {});
            }
          }
        } catch (camErr) {
          console.warn("Initial camera activation failed:", camErr);
        }
      }

      newPc.ontrack = (event) => {
        if (event.track.kind === 'video') {
          if (!remoteStream.current) remoteStream.current = new MediaStream();
          // Remove old video tracks and attach latest
          remoteStream.current.getVideoTracks().forEach(t => remoteStream.current?.removeTrack(t));
          remoteStream.current.addTrack(event.track);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
            remoteVideoRef.current.play().catch(() => {});
          }
          setHasRemoteVideo(true);

          event.track.onmute = () => setHasRemoteVideo(false);
          event.track.onunmute = () => {
            setHasRemoteVideo(true);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream.current;
              remoteVideoRef.current.play().catch(() => {});
            }
          };
          event.track.onended = () => setHasRemoteVideo(false);
        } else if (event.track.kind === 'audio') {
          if (!remoteStream.current) remoteStream.current = new MediaStream();
          remoteStream.current.getAudioTracks().forEach(t => remoteStream.current?.removeTrack(t));
          remoteStream.current.addTrack(event.track);

          attachRemoteAudio();

          remoteAnalyzerCleanupRef.current?.();
          remoteAnalyzerCleanupRef.current = setupAudioAnalyzer(new MediaStream([event.track]), setRemoteIsSpeaking);
        }
      };

      newPc.onicecandidate = (event) => {
        if (event.candidate && callIdRef.current === sessionCallId) {
          addIceCandidate(sessionCallId, 'caller', event.candidate.toJSON());
        }
      };

      newPc.oniceconnectionstatechange = () => {
        console.log("Caller ICE connection state:", newPc.iceConnectionState);
        if (newPc.iceConnectionState === 'connected' || newPc.iceConnectionState === 'completed') {
          attachRemoteAudio();
        } else if (newPc.iceConnectionState === 'failed') {
          newPc.restartIce?.();
        }
      };

      const offerDescription = await newPc.createOffer();
      await newPc.setLocalDescription(offerDescription);

      await createCall(
        sessionCallId, 
        currentUser!.id, 
        callData!.user.id, 
        { type: offerDescription.type, sdp: offerDescription.sdp },
        {
          callerMedia: isCameraOn ? 'camera' : 'none',
          receiverMedia: 'none',
          callerName: currentUser!.username,
          callerAvatar: currentUser!.avatarUrl || '',
          receiverName: callData!.user.username,
          receiverAvatar: callData!.user.avatarUrl || ''
        }
      );

      // Subscribe to signaling updates
      const unsub = subscribeToCall(sessionCallId, async (data) => {
        if (!data || pc.current !== newPc) return;

        if (data.status === 'ended') {
          handleEndCall(false);
          return;
        }

        if (data.status === 'active' && callStatus !== 'active') {
          setCallStatus('active');
        }

        if (data.receiverMedia) {
          setRemoteMedia(data.receiverMedia);
        }

        // Set remote answer description safely without race conditions
        if (data.answer && newPc.signalingState === 'have-local-offer' && !isSettingRemoteDesc.current) {
          isSettingRemoteDesc.current = true;
          try {
            await newPc.setRemoteDescription(new RTCSessionDescription(data.answer));
            setCallStatus('active');
            attachRemoteAudio();

            // Drain queued ICE candidates
            while (candidatesQueue.current.length > 0) {
              const cand = candidatesQueue.current.shift();
              if (cand && newPc.remoteDescription) {
                try {
                  await newPc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn("Error adding queued receiver candidate:", e);
                }
              }
            }
          } catch (err) {
            console.error("Error setting remote answer description:", err);
          } finally {
            isSettingRemoteDesc.current = false;
          }
        }

        // Process receiver ICE candidates with deduplication
        if (Array.isArray(data.receiverCandidates)) {
          for (const candidate of data.receiverCandidates) {
            if (!candidate || !candidate.candidate) continue;
            const key = `${candidate.candidate}_${candidate.sdpMid}_${candidate.sdpMLineIndex}`;
            if (processedCandidates.current.has(key)) continue;
            processedCandidates.current.add(key);

            if (newPc.remoteDescription && newPc.remoteDescription.type) {
              try {
                await newPc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.warn("Error adding receiver candidate:", e);
              }
            } else {
              candidatesQueue.current.push(candidate);
            }
          }
        }
      });

      callUnsubRef.current = unsub;
    }
  }, [isCalling, callData, currentUser, callStatus]);

  // Synchronize local preview video element
  useEffect(() => {
    if (isCameraOn && localCameraStream.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localCameraStream.current) {
        localVideoRef.current.srcObject = localCameraStream.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [isCameraOn, callStatus]);

  // Synchronize local screenshare preview video element
  useEffect(() => {
    if (isScreenSharing && localScreenStream.current && localScreenRef.current) {
      if (localScreenRef.current.srcObject !== localScreenStream.current) {
        localScreenRef.current.srcObject = localScreenStream.current;
        localScreenRef.current.play().catch(() => {});
      }
    }
  }, [isScreenSharing, callStatus]);

  // Synchronize remote video element
  useEffect(() => {
    if (remoteStream.current && remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStream.current) {
        remoteVideoRef.current.srcObject = remoteStream.current;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [hasRemoteVideo, remoteMedia, callStatus]);

  const acceptCall = async () => {
    const sessionCallId = callIdRef.current;
    if (!sessionCallId || !currentUser) return;
    
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    if (callUnsubRef.current) {
      callUnsubRef.current();
      callUnsubRef.current = null;
    }

    setCallStatus('active');
    isCallerRef.current = false;
    processedCandidates.current.clear();
    candidatesQueue.current = [];
    isSettingRemoteDesc.current = false;

    const newPc = new RTCPeerConnection(servers);
    pc.current = newPc;
    remoteStream.current = new MediaStream();

    // Pre-create transceivers for both audio and video on receiver side too
    const audioTransceiver = newPc.addTransceiver('audio', { direction: 'sendrecv' });
    const videoTransceiver = newPc.addTransceiver('video', { direction: 'sendrecv' });
    audioTransceiverRef.current = audioTransceiver;
    videoTransceiverRef.current = videoTransceiver;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        localAudioTrack.current = audioTrack;
        await audioTransceiver.sender.replaceTrack(audioTrack);

        localAnalyzerCleanupRef.current?.();
        localAnalyzerCleanupRef.current = setupAudioAnalyzer(new MediaStream([audioTrack]), setIsSpeaking);
      }
    } catch (err) {
      console.error("Receiver Media error:", err);
    }

    newPc.ontrack = (event) => {
      if (event.track.kind === 'video') {
        if (!remoteStream.current) remoteStream.current = new MediaStream();
        remoteStream.current.getVideoTracks().forEach(t => remoteStream.current?.removeTrack(t));
        remoteStream.current.addTrack(event.track);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream.current;
          remoteVideoRef.current.play().catch(() => {});
        }
        setHasRemoteVideo(true);

        event.track.onmute = () => setHasRemoteVideo(false);
        event.track.onunmute = () => {
          setHasRemoteVideo(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
            remoteVideoRef.current.play().catch(() => {});
          }
        };
        event.track.onended = () => setHasRemoteVideo(false);
      } else if (event.track.kind === 'audio') {
        if (!remoteStream.current) remoteStream.current = new MediaStream();
        remoteStream.current.getAudioTracks().forEach(t => remoteStream.current?.removeTrack(t));
        remoteStream.current.addTrack(event.track);

        attachRemoteAudio();

        remoteAnalyzerCleanupRef.current?.();
        remoteAnalyzerCleanupRef.current = setupAudioAnalyzer(new MediaStream([event.track]), setRemoteIsSpeaking);
      }
    };

    newPc.onicecandidate = (event) => {
      if (event.candidate && callIdRef.current === sessionCallId) {
        addIceCandidate(sessionCallId, 'receiver', event.candidate.toJSON());
      }
    };

    newPc.oniceconnectionstatechange = () => {
      console.log("Receiver ICE connection state:", newPc.iceConnectionState);
      if (newPc.iceConnectionState === 'connected' || newPc.iceConnectionState === 'completed') {
        attachRemoteAudio();
      } else if (newPc.iceConnectionState === 'failed') {
        newPc.restartIce?.();
      }
    };

    const unsub = subscribeToCall(sessionCallId, async (data) => {
      if (!data || pc.current !== newPc) return;

      if (data.status === 'ended') {
        handleEndCall(false);
        return;
      }

      if (data.callerMedia) {
        setRemoteMedia(data.callerMedia);
      }

      // Process offer only when in 'stable' state and not already processing
      if (data.offer && newPc.signalingState === 'stable' && !isSettingRemoteDesc.current && !newPc.currentRemoteDescription) {
        isSettingRemoteDesc.current = true;
        try {
          await newPc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await newPc.createAnswer();
          await newPc.setLocalDescription(answer);

          await updateCall(sessionCallId, {
            answer: { type: answer.type, sdp: answer.sdp },
            status: 'active',
            receiverMedia: isCameraOn ? 'camera' : 'none'
          });

          attachRemoteAudio();

          // Process queued caller candidates
          while (candidatesQueue.current.length > 0) {
            const cand = candidatesQueue.current.shift();
            if (cand && newPc.remoteDescription) {
              try {
                await newPc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn("Error adding queued caller candidate:", e);
              }
            }
          }
        } catch (err) {
          console.error("Error setting remote offer / creating answer:", err);
        } finally {
          isSettingRemoteDesc.current = false;
        }
      }

      // Process caller ICE candidates with deduplication
      if (Array.isArray(data.callerCandidates)) {
        for (const candidate of data.callerCandidates) {
          if (!candidate || !candidate.candidate) continue;
          const key = `${candidate.candidate}_${candidate.sdpMid}_${candidate.sdpMLineIndex}`;
          if (processedCandidates.current.has(key)) continue;
          processedCandidates.current.add(key);

          if (newPc.remoteDescription && newPc.remoteDescription.type) {
            try {
              await newPc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("Error adding caller candidate:", e);
            }
          } else {
            candidatesQueue.current.push(candidate);
          }
        }
      }
    });

    callUnsubRef.current = unsub;
  };

  const handleEndCall = async (shouldUpdateDb = true) => {
    const currentId = callIdRef.current;
    
    // Stop listening to signaling updates
    if (callUnsubRef.current) {
      callUnsubRef.current();
      callUnsubRef.current = null;
    }

    // Stop audio analyzers
    localAnalyzerCleanupRef.current?.();
    localAnalyzerCleanupRef.current = null;
    remoteAnalyzerCleanupRef.current?.();
    remoteAnalyzerCleanupRef.current = null;

    if (shouldUpdateDb && currentId) {
      try {
        await updateCall(currentId, { status: 'ended' });
        cleanupTimerRef.current = setTimeout(() => {
          try {
            deleteCall(currentId);
          } catch (e) {
            console.warn("Could not delete call doc:", e);
          }
        }, 3000);
      } catch (err) {
        console.error("Failed to update call status in DB:", err);
      }
    }
    
    // Stop and release all tracks
    if (localAudioTrack.current) {
      localAudioTrack.current.stop();
      localAudioTrack.current = null;
    }
    if (localCameraStream.current) {
      localCameraStream.current.getTracks().forEach(t => t.stop());
      localCameraStream.current = null;
    }
    if (localScreenStream.current) {
      localScreenStream.current.getTracks().forEach(t => t.stop());
      localScreenStream.current = null;
    }
    if (remoteStream.current) {
      remoteStream.current.getTracks().forEach(t => t.stop());
      remoteStream.current = null;
    }

    if (pc.current) {
      pc.current.ontrack = null;
      pc.current.onicecandidate = null;
      pc.current.oniceconnectionstatechange = null;
      pc.current.close();
      pc.current = null;
    }

    audioTransceiverRef.current = null;
    videoTransceiverRef.current = null;
    isSettingRemoteDesc.current = false;
    processedCandidates.current.clear();
    candidatesQueue.current = [];

    setIsCalling(false);
    setCallStatus('idle');
    setCallData(null);
    callIdRef.current = null;
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsSpeaking(false);
    setRemoteIsSpeaking(false);
    setRemoteMedia('none');
    setHasRemoteVideo(false);
  };

  const toggleCamera = async () => {
    if (!isCameraOn) {
      try {
        // If screen sharing was on, stop screen sharing first
        if (isScreenSharing) {
          await stopScreenShare();
        }

        const videoConstraints = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true;
        const camStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        const camTrack = camStream.getVideoTracks()[0];
        if (!camTrack) return;

        localCameraStream.current = camStream;

        // Show local preview immediately
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = camStream;
          localVideoRef.current.play().catch(() => {});
        }

        // Transmit video track to remote peer via video transceiver
        if (videoTransceiverRef.current) {
          await videoTransceiverRef.current.sender.replaceTrack(camTrack);
        } else if (pc.current) {
          const sender = pc.current.getSenders().find(s => s.track?.kind === 'video' || (s as any).kind === 'video');
          if (sender) {
            await sender.replaceTrack(camTrack);
          } else {
            pc.current.addTrack(camTrack, camStream);
          }
        }

        setIsCameraOn(true);

        // Update Firestore so remote peer immediately knows camera is active
        if (callIdRef.current) {
          const side = isCallerRef.current ? 'caller' : 'receiver';
          await updateCall(callIdRef.current, { [`${side}Media`]: 'camera' });
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    } else {
      if (localCameraStream.current) {
        localCameraStream.current.getTracks().forEach(t => t.stop());
        localCameraStream.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      if (videoTransceiverRef.current) {
        await videoTransceiverRef.current.sender.replaceTrack(null);
      } else if (pc.current) {
        const sender = pc.current.getSenders().find(s => s.track?.kind === 'video' || (s as any).kind === 'video');
        if (sender) await sender.replaceTrack(null);
      }

      setIsCameraOn(false);

      if (callIdRef.current) {
        const side = isCallerRef.current ? 'caller' : 'receiver';
        await updateCall(callIdRef.current, { [`${side}Media`]: 'none' });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        // If camera is on, stop camera before sharing screen
        if (isCameraOn) {
          if (localCameraStream.current) {
            localCameraStream.current.getTracks().forEach(t => t.stop());
            localCameraStream.current = null;
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
          setIsCameraOn(false);
        }

        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ 
          video: { cursor: 'always' }, 
          audio: true 
        });
        const screenTrack = stream.getVideoTracks()[0];
        if (!screenTrack) return;

        localScreenStream.current = stream;

        // Auto-handle when user stops screen share from browser floating toolbar
        screenTrack.onended = () => {
          stopScreenShare();
        };

        // Attach local preview so YOU can see your own shared screen
        if (localScreenRef.current) {
          localScreenRef.current.srcObject = stream;
          localScreenRef.current.play().catch(() => {});
        }

        // Transmit screen track to remote peer via video transceiver
        if (videoTransceiverRef.current) {
          await videoTransceiverRef.current.sender.replaceTrack(screenTrack);
        } else if (pc.current) {
          const sender = pc.current.getSenders().find(s => s.track?.kind === 'video' || (s as any).kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          } else {
            pc.current.addTrack(screenTrack, stream);
          }
        }

        setIsScreenSharing(true);

        // Update Firestore so remote peer immediately switches to Screen Share Stage Mode!
        if (callIdRef.current) {
          const side = isCallerRef.current ? 'caller' : 'receiver';
          await updateCall(callIdRef.current, { [`${side}Media`]: 'screen' });
        }
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          console.error("Screenshare error:", err);
        }
      }
    } else {
      await stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    if (localScreenStream.current) {
      localScreenStream.current.getTracks().forEach(t => t.stop());
      localScreenStream.current = null;
    }
    if (localScreenRef.current) {
      localScreenRef.current.srcObject = null;
    }

    if (videoTransceiverRef.current) {
      await videoTransceiverRef.current.sender.replaceTrack(null);
    } else if (pc.current) {
      const sender = pc.current.getSenders().find(s => s.track?.kind === 'video' || (s as any).kind === 'video');
      if (sender) await sender.replaceTrack(null);
    }

    setIsScreenSharing(false);

    if (callIdRef.current) {
      const side = isCallerRef.current ? 'caller' : 'receiver';
      await updateCall(callIdRef.current, { [`${side}Media`]: 'none' });
    }
  };

  useEffect(() => {
    if (localAudioTrack.current) {
      localAudioTrack.current.enabled = !isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isDeafened;
    }
  }, [isDeafened]);

  if (!isCalling || !callData) return null;

  // Determine active view mode:
  // Is anyone sharing their screen?
  const isSomeoneScreenSharing = isScreenSharing || (hasRemoteVideo && remoteMedia === 'screen');

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed inset-0 z-[3000] bg-[#111214] flex flex-col overflow-hidden font-sans select-none"
      >
        {/* Hidden Audio element for crystal clear remote voice */}
        <audio ref={remoteAudioRef} autoPlay playsInline />
        
        {/* Top Header Bar */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-[#1E1F22]/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-3 h-3 ${callStatus === 'active' ? 'bg-[#23A559]' : 'bg-amber-400'} rounded-full animate-pulse shrink-0`} />
            <div className="min-w-0">
              <span className="text-white font-extrabold text-sm sm:text-base tracking-tight truncate block">
                {callStatus === 'ringing' ? 'Incoming Call...' : callStatus === 'calling' ? `Calling ${callData.user.username}...` : `In Call: ${callData.user.username}`}
              </span>
              <p className="text-[11px] text-zinc-400 font-medium truncate">
                {callStatus === 'active' 
                  ? (isSomeoneScreenSharing ? '🖥️ Live Screen Share Active' : (isCameraOn || hasRemoteVideo ? '📹 Video Call Active' : '🎙️ Voice Connected (Encrypted)'))
                  : 'Connecting peer-to-peer...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSomeoneScreenSharing && (
              <button 
                onClick={() => setIsFullscreenStage(!isFullscreenStage)}
                className="text-zinc-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
                title="Toggle Fullscreen Screen Share"
              >
                {isFullscreenStage ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span className="hidden sm:inline">{isFullscreenStage ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            )}

            <button 
              onClick={() => setShowCameraSettings(!showCameraSettings)}
              className="text-zinc-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              title="Camera & Audio Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Camera Device Settings Popover */}
        {showCameraSettings && (
          <div className="absolute top-16 right-4 z-50 bg-[#2B2D31] border border-white/10 p-4 rounded-2xl shadow-2xl w-80 text-white animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-pink-400">Call Settings</span>
              <button onClick={() => setShowCameraSettings(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <CameraDeviceSelector />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 relative bg-[#1E1F22] flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden">
          {callStatus === 'ringing' ? (
            /* Incoming Ringing Screen with Big Crisp Profile Picture */
            <div className="flex flex-col items-center gap-6 my-auto text-center animate-in zoom-in-95 duration-200">
              <div className="relative">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-[#23A559] shadow-[0_0_40px_rgba(35,165,89,0.4)] relative">
                  <img 
                    src={getAvatarUrl(callData.user)} 
                    alt={callData.user.username} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(callData.user.username)}`;
                      if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                    }}
                  />
                  <div className="absolute inset-0 bg-[#23A559]/10 animate-ping rounded-full pointer-events-none" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#23A559] border-4 border-[#1E1F22] flex items-center justify-center text-white shadow-lg animate-bounce">
                  <Phone size={16} />
                </div>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-1.5">{callData.user.username}</h2>
                <p className="text-zinc-400 font-bold text-sm">@{callData.user.handle} is calling you...</p>
                <span className="inline-block mt-3 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest">
                  {callData.type === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call'}
                </span>
              </div>

              <div className="flex items-center gap-8 mt-2">
                <button 
                  onClick={() => handleEndCall(true)} 
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-16 h-16 bg-[#F23F42] hover:bg-[#D83C3E] rounded-full flex items-center justify-center text-white shadow-xl shadow-red-500/30 transition-transform group-hover:scale-110 active:scale-95">
                    <PhoneOff size={28} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-red-400">Decline</span>
                </button>

                <button 
                  onClick={acceptCall} 
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <div className="w-16 h-16 bg-[#23A559] hover:bg-[#1A8344] rounded-full flex items-center justify-center text-white shadow-xl shadow-green-500/40 transition-transform group-hover:scale-110 active:scale-95 animate-pulse">
                    <Check size={32} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-[#23A559]">Accept</span>
                </button>
              </div>
            </div>
          ) : isSomeoneScreenSharing ? (
            /* ========================================================
               SCREEN SHARE THEATER STAGE
               Shown when YOU or OTHER PERSON is sharing screen.
               Participant Profile Pictures are ALWAYS visible on top!
               ======================================================== */
            <div className="w-full h-full flex flex-col gap-3 max-w-7xl">
              {/* Participant Profile Pictures Row (always visible above screen share) */}
              <div className="flex items-center justify-center gap-4 shrink-0 pb-1">
                {/* Local Participant Card */}
                <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#2B2D31]/90 border transition-all ${
                  isSpeaking ? 'border-[#23A559] shadow-[0_0_15px_rgba(35,165,89,0.35)]' : 'border-white/10'
                }`}>
                  <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 shrink-0">
                    {isCameraOn ? (
                      <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                    ) : (
                      <img 
                        src={getAvatarUrl(currentUser || undefined)} 
                        alt="You" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser?.username || 'user')}`;
                          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-white leading-tight">You {isScreenSharing && <span className="text-emerald-400 font-extrabold">(Sharing)</span>}</p>
                    <p className="text-[10px] text-zinc-400">{isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Connected'}</p>
                  </div>
                </div>

                {/* Remote Participant Card */}
                <div className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#2B2D31]/90 border transition-all ${
                  remoteIsSpeaking ? 'border-[#23A559] shadow-[0_0_15px_rgba(35,165,89,0.35)]' : 'border-white/10'
                }`}>
                  <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/20 shrink-0">
                    {hasRemoteVideo && remoteMedia === 'camera' ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    ) : (
                      <img 
                        src={getAvatarUrl(callData.user)} 
                        alt={callData.user.username} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(callData.user.username)}`;
                          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-white leading-tight">{callData.user.username} {remoteMedia === 'screen' && <span className="text-cyan-400 font-extrabold">(Sharing)</span>}</p>
                    <p className="text-[10px] text-zinc-400">{remoteIsSpeaking ? 'Speaking' : 'Connected'}</p>
                  </div>
                </div>
              </div>

              {/* High-Definition Screen Share Stage */}
              <div className="flex-1 min-h-0 w-full bg-black rounded-3xl overflow-hidden border border-white/15 relative flex items-center justify-center shadow-2xl">
                {isScreenSharing ? (
                  /* YOU are sharing screen */
                  <>
                    <video 
                      ref={localScreenRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className="w-full h-full object-contain bg-black"
                    />
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-emerald-500/40 text-white text-xs font-bold">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>You are sharing your screen</span>
                      <button 
                        onClick={stopScreenShare}
                        className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors"
                      >
                        Stop Sharing
                      </button>
                    </div>
                  </>
                ) : (
                  /* REMOTE PEER is sharing screen */
                  <>
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-contain bg-black"
                    />
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/40 text-white text-xs font-bold">
                      <Monitor size={16} className="text-cyan-400" />
                      <span>{callData.user.username}'s Screen (Live)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* ========================================================
               CALL GRID / STAGE (CAMERA OR AUDIO PROFILE PICTURES)
               The person's Profile Picture MUST BE SEEN with high clarity!
               ======================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full max-w-5xl h-full items-center justify-center">
              {/* Tile 1: Local User (You) */}
              <div className="w-full h-full max-h-[440px] bg-[#2B2D31] rounded-3xl overflow-hidden border border-white/10 flex flex-col items-center justify-center p-6 relative shadow-xl group">
                {isCameraOn ? (
                  /* Camera active */
                  <div className="w-full h-full relative rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover scale-x-[-1]" 
                    />
                    {/* Corner Profile Picture Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                      <img 
                        src={getAvatarUrl(currentUser || undefined)} 
                        alt="You" 
                        className="w-6 h-6 rounded-full object-cover" 
                      />
                      <span className="text-white text-xs font-bold">You (Camera On)</span>
                    </div>
                  </div>
                ) : (
                  /* Camera off: Profile Picture PROMINENTLY DISPLAYED */
                  <div className="flex flex-col items-center gap-4 my-auto text-center">
                    <div className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-[#313338] transition-all duration-300 ${
                      isSpeaking ? 'ring-4 ring-[#23A559] shadow-[0_0_30px_rgba(35,165,89,0.5)] scale-105' : 'ring-2 ring-white/10'
                    }`}>
                      <img 
                        src={getAvatarUrl(currentUser || undefined)} 
                        alt={currentUser?.username || 'You'} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser?.username || 'user')}`;
                          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                      {isMuted && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                          <MicOff size={36} className="text-red-500 drop-shadow" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-white">{currentUser?.username || 'You'}</h3>
                      <p className="text-xs text-zinc-400 font-semibold mt-0.5">@{currentUser?.handle || 'me'}</p>
                      <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300">
                        {isMuted ? 'Muted' : isSpeaking ? 'Speaking...' : 'Ready'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tile 2: Remote User (Other Person) */}
              <div className="w-full h-full max-h-[440px] bg-[#2B2D31] rounded-3xl overflow-hidden border border-white/10 flex flex-col items-center justify-center p-6 relative shadow-xl group">
                {hasRemoteVideo && remoteMedia === 'camera' ? (
                  /* Remote Camera active */
                  <div className="w-full h-full relative rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover" 
                    />
                    {/* Corner Profile Picture Badge for other person */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                      <img 
                        src={getAvatarUrl(callData.user)} 
                        alt={callData.user.username} 
                        className="w-6 h-6 rounded-full object-cover" 
                      />
                      <span className="text-white text-xs font-bold">{callData.user.username}</span>
                    </div>
                  </div>
                ) : (
                  /* Remote Camera off: Profile Picture PROMINENTLY DISPLAYED */
                  <div className="flex flex-col items-center gap-4 my-auto text-center">
                    <div className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-[#313338] transition-all duration-300 ${
                      remoteIsSpeaking ? 'ring-4 ring-[#23A559] shadow-[0_0_30px_rgba(35,165,89,0.5)] scale-105' : 'ring-2 ring-white/10'
                    }`}>
                      <img 
                        src={getAvatarUrl(callData.user)} 
                        alt={callData.user.username} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const fallback = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(callData.user.username)}`;
                          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                        }}
                      />
                      {callStatus === 'calling' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-white">{callData.user.username}</h3>
                      <p className="text-xs text-zinc-400 font-semibold mt-0.5">@{callData.user.handle}</p>
                      <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        callStatus === 'calling'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse'
                          : remoteIsSpeaking
                          ? 'bg-[#23A559]/20 text-[#23A559] border border-[#23A559]/40'
                          : 'bg-white/5 text-zinc-300 border border-white/10'
                      }`}>
                        {callStatus === 'calling' ? 'Ringing...' : remoteIsSpeaking ? 'Speaking...' : 'Connected'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="h-24 bg-[#1E1F22] border-t border-white/10 flex items-center justify-center px-4 gap-3 sm:gap-4 shrink-0">
          {/* Audio controls */}
          <div className="flex items-center gap-2 bg-[#2B2D31] p-1.5 rounded-2xl shadow-xl border border-white/5">
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${isMuted ? 'bg-[#F23F42] text-white shadow-lg shadow-red-500/30' : 'text-[#DBDEE1] hover:bg-[#35373C] hover:text-white'}`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button 
              onClick={() => setIsDeafened(!isDeafened)} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${isDeafened ? 'bg-[#F23F42] text-white shadow-lg shadow-red-500/30' : 'text-[#DBDEE1] hover:bg-[#35373C] hover:text-white'}`}
              title={isDeafened ? "Undeafen Audio" : "Deafen Audio"}
            >
              {isDeafened ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
          </div>

          {/* Video & Screen sharing controls */}
          <div className="flex items-center gap-2 bg-[#2B2D31] p-1.5 rounded-2xl shadow-xl border border-white/5">
            <button 
              onClick={toggleCamera} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${isCameraOn ? 'bg-white text-black shadow-lg' : 'text-[#DBDEE1] hover:bg-[#35373C] hover:text-white'}`}
              title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {isCameraOn ? <VideoOff size={22} /> : <Camera size={22} />}
            </button>
            <button 
              onClick={toggleScreenShare} 
              className={`p-3 rounded-xl transition-all cursor-pointer ${isScreenSharing ? 'bg-[#23A559] text-white shadow-lg shadow-green-500/40 animate-pulse' : 'text-[#DBDEE1] hover:bg-[#35373C] hover:text-white'}`}
              title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
            >
              <Monitor size={22} />
            </button>
          </div>

          {/* End Call Button */}
          <button 
            onClick={() => handleEndCall(true)} 
            className="w-13 h-13 sm:w-14 sm:h-14 bg-[#F23F42] hover:bg-[#D83C3E] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer ml-2"
            title="End Call"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

