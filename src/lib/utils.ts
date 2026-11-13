import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isFriend(userA?: User | null, userB?: User | null): boolean {
  if (!userA || !userB) return false;
  if (userA.id === userB.id) return true;
  return (
    Array.isArray(userA.following) &&
    userA.following.includes(userB.id) &&
    Array.isArray(userB.following) &&
    userB.following.includes(userA.id)
  );
}

export function getDeviceId() {
  const key = 'centraltok_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const deviceId = `device_${crypto.randomUUID()}`;
  localStorage.setItem(key, deviceId);
  return deviceId;
}

export function playNotificationSound(sound: string = 'chime') {
  if (sound === 'mute') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine', peakGain = 0.14, endFreq?: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + start + duration);
      }
      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.linearRampToValueAtTime(peakGain, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    };

    switch (sound) {
      case 'pop':
        playTone(420, 0, 0.11, 'sine', 0.18, 760);
        break;
      case 'ping':
        playTone(1046.5, 0, 0.28, 'triangle', 0.14);
        break;
      case 'arcade':
        playTone(523.25, 0, 0.08, 'square', 0.08);
        playTone(659.25, 0.08, 0.08, 'square', 0.08);
        playTone(783.99, 0.16, 0.16, 'square', 0.08);
        break;
      case 'chime':
      default:
        playTone(659.25, 0, 0.22, 'sine', 0.13);
        playTone(987.77, 0.09, 0.3, 'sine', 0.11);
        break;
    }

    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 800);
  } catch {}
}

