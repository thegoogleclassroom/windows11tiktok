import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeYoutubeShorts } from '../src/lib/feed.ts';
import {
  ONLINE_WINDOW_MS,
  resolveJoinTimestamp,
  formatJoinDate,
  isUserOnline,
  formatLastActive,
  buildGoogleSpaceWebhookPayload,
  toFirestoreFields,
  fromFirestoreFields,
} from '../src/lib/utils.ts';

describe('normalizeYoutubeShorts', () => {
  it('filters blocked and duplicate YouTube items before they enter the feed', () => {
    const items = [
      {
        id: { videoId: 'abc123' },
        snippet: { title: 'ok', channelTitle: 'Tester', channelId: 'chan1' },
        status: { embeddable: true }
      },
      {
        id: { videoId: 'blocked1' },
        snippet: { title: 'blocked', channelTitle: 'Tester', channelId: 'chan2' },
        status: { embeddable: false }
      },
      {
        id: { videoId: 'abc123' },
        snippet: { title: 'duplicate', channelTitle: 'Tester', channelId: 'chan1' },
        status: { embeddable: true }
      }
    ];

    const result = normalizeYoutubeShorts(items);

    assert.equal(result.length, 1);
    assert.equal(result[0].youtubeId, 'abc123');
    assert.equal(result[0].id.videoId, 'abc123');
  });
});

describe('User Join Date & Online Activity Tracking', () => {
  it('resolves createdAt first, falls back to embedded ID timestamps, and returns null for legacy IDs', () => {
    const explicitTs = Date.UTC(2025, 4, 15, 12, 0, 0);
    assert.equal(resolveJoinTimestamp({ id: 'u_legacy', createdAt: explicitTs }), explicitTs);

    const embeddedTs = Date.UTC(2025, 1, 10, 8, 30, 0);
    assert.equal(resolveJoinTimestamp({ id: `user_${embeddedTs}` }), embeddedTs);

    assert.equal(resolveJoinTimestamp({ id: 'u_abc123xyz' }), null);
    assert.equal(formatJoinDate({ id: 'u_abc123xyz' }), 'Unknown (Legacy)');
    assert.notEqual(formatJoinDate({ id: 'u_legacy', createdAt: explicitTs }), 'Unknown (Legacy)');
  });

  it('marks owner online only when last interaction is within the 3-minute ONLINE_WINDOW_MS', () => {
    const now = 1_760_000_000_000;
    assert.equal(ONLINE_WINDOW_MS, 3 * 60 * 1000);
    assert.equal(isUserOnline({ lastActive: now - 30_000 }, now), true);
    assert.equal(isUserOnline({ lastActive: now - ONLINE_WINDOW_MS }, now), true);
    assert.equal(isUserOnline({ lastActive: now - ONLINE_WINDOW_MS - 1 }, now), false);
    assert.equal(isUserOnline({ lastActive: undefined }, now), false);
  });

  it('formats relative last active labels accurately for staff evidence and profiles', () => {
    const now = 1_760_000_000_000;
    assert.equal(formatLastActive(undefined, now), 'No activity recorded');
    assert.equal(formatLastActive(now - 10_000, now), 'Active just now');
    assert.equal(formatLastActive(now - 120_000, now), 'Online (2m ago)');
    assert.equal(formatLastActive(now - 15 * 60_000, now), '15m ago');
    assert.equal(formatLastActive(now - 3 * 3600_000, now), '3h ago');
    assert.equal(formatLastActive(now - 2 * 86_400_000, now), '2d ago');
  });
});

describe('Google Space Webhook Payload (CentralTok Developers.)', () => {
  it('builds a valid Google Chat cardsV2 payload and escapes HTML characters safely', () => {
    const payload = buildGoogleSpaceWebhookPayload({
      title: 'Test Webhook Alert',
      summary: 'Line 1 & <script>alert(1)</script>\nLine 2',
      updatedBy: 'Owner <dev>',
      pageUrl: 'https://thegoogleclassroom.github.io/windows11tiktok/',
    });

    assert.ok(payload.text.includes('Test Webhook Alert'));
    assert.equal(payload.cardsV2.length, 1);
    assert.equal(payload.cardsV2[0].card.header.subtitle, 'Google Space: CentralTok Developers.');

    const widgets = payload.cardsV2[0].card.sections[0].widgets;
    const sentByWidget = widgets[0];
    const summaryWidget = widgets[1];
    assert.ok(sentByWidget && 'decoratedText' in sentByWidget && sentByWidget.decoratedText);
    assert.equal(sentByWidget.decoratedText.text, 'Owner &lt;dev&gt;');
    assert.ok(summaryWidget && 'textParagraph' in summaryWidget && summaryWidget.textParagraph);
    assert.equal(
      summaryWidget.textParagraph.text,
      'Line 1 &amp; &lt;script&gt;alert(1)&lt;/script&gt;<br>Line 2'
    );
  });
});

describe('Firestore REST Conversion Helpers', () => {
  it('round-trips user ban status, live stream arrays, and numbers without loss', () => {
    const sample = {
      id: 'user_123',
      isLiveStream: true,
      likes: 42,
      rating: 4.5,
      viewers: ['u1', 'u2'],
      banStatus: {
        type: 'temp',
        until: 1795640000000,
        reason: 'Rule violation',
      },
      pinnedMessage: null,
    };

    const restFields = toFirestoreFields(sample);
    assert.equal(restFields.id.stringValue, 'user_123');
    assert.equal(restFields.likes.integerValue, '42');
    assert.equal(restFields.rating.doubleValue, 4.5);

    const decoded = fromFirestoreFields<typeof sample>(restFields);
    assert.deepEqual(decoded, sample);
  });
});

