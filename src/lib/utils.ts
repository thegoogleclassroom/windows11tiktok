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

export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function resolveJoinTimestamp(user?: Pick<User, 'id' | 'createdAt'> | null): number | null {
  if (!user) return null;
  if (typeof user.createdAt === 'number' && Number.isFinite(user.createdAt) && user.createdAt > 1_577_836_800_000) {
    return user.createdAt;
  }
  const parts = String(user.id || '').split('_');
  for (const part of parts) {
    const parsed = Number(part);
    if (Number.isFinite(parsed) && parsed > 1_577_836_800_000 && parsed < 4_102_444_800_000) {
      return parsed;
    }
  }
  return null;
}

export function formatJoinDate(user?: Pick<User, 'id' | 'createdAt'> | null): string {
  const ts = resolveJoinTimestamp(user);
  if (!ts) return 'Unknown (Legacy)';
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isUserOnline(
  userOrLastActive?: Pick<User, 'lastActive'> | number | null,
  now: number = Date.now()
): boolean {
  const lastActive =
    typeof userOrLastActive === 'number'
      ? userOrLastActive
      : userOrLastActive?.lastActive;
  if (typeof lastActive !== 'number' || !Number.isFinite(lastActive) || lastActive <= 0) {
    return false;
  }
  return now - lastActive <= ONLINE_WINDOW_MS;
}

export function formatLastActive(lastActive?: number | null, now: number = Date.now()): string {
  if (typeof lastActive !== 'number' || !Number.isFinite(lastActive) || lastActive <= 0) {
    return 'No activity recorded';
  }
  const diffMs = Math.max(0, now - lastActive);
  if (diffMs <= ONLINE_WINDOW_MS) {
    const secs = Math.floor(diffMs / 1000);
    if (secs < 45) return 'Active just now';
    return `Online (${Math.max(1, Math.floor(secs / 60))}m ago)`;
  }
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(lastActive).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildGoogleSpaceWebhookPayload(opts: {
  title?: string;
  summary?: string;
  updatedBy?: string;
  pageUrl?: string;
}) {
  const title = String(opts.title || 'CentralTok Site Updated').slice(0, 120);
  const summary = String(opts.summary || 'Site update pushed cleanly to GitHub Pages.').slice(0, 1500);
  const updatedBy = String(opts.updatedBy || 'CentralTok Owner').slice(0, 60);
  const rawUrl = String(opts.pageUrl || 'https://thegoogleclassroom.github.io/windows11tiktok/');
  const safePageUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : 'https://thegoogleclassroom.github.io/windows11tiktok/';

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  return {
    text: `🚀 *${title}* — ${updatedBy}\n${summary.slice(0, 500)}\nLive: ${safePageUrl}`,
    cardsV2: [
      {
        cardId: `space-update-${Date.now()}`,
        card: {
          header: {
            title,
            subtitle: 'Google Space: CentralTok Developers.',
            imageUrl: 'https://github.githubassets.com/favicons/favicon.png',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: 'Update Summary',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Sent By',
                    text: escapeHtml(updatedBy),
                  },
                },
                {
                  textParagraph: {
                    text: escapeHtml(summary).replace(/\n/g, '<br>'),
                  },
                },
              ],
            },
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'Open Live Site',
                        onClick: { openLink: { url: safePageUrl } },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export function toFirestoreValue(val: unknown): Record<string, any> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { nullValue: null };
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: toFirestoreFields(val as Record<string, any>),
      },
    };
  }
  return { stringValue: String(val) };
}

export function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || typeof v === 'function') continue;
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

export function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) {
    const parsed = Date.parse(val.timestampValue);
    return Number.isFinite(parsed) ? parsed : val.timestampValue;
  }
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values;
    return Array.isArray(values) ? values.map(fromFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    return fromFirestoreFields(val.mapValue?.fields);
  }
  return null;
}

export function fromFirestoreFields<T = Record<string, any>>(fields?: Record<string, any>): T {
  const result: Record<string, any> = {};
  if (!fields || typeof fields !== 'object') return result as T;
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result as T;
}
