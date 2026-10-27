import {mkdir, writeFile} from 'node:fs/promises';

const apiKeys = [
  process.env.Youtube_API,
  process.env.YOUTUBE_API,
  process.env.YOUTUBE_API_KEY,
  ...Array.from({length: 20}, (_, index) => process.env[`YOUTUBE_API_KEY_${index + 1}`])
].filter(Boolean);
if (apiKeys.length === 0) throw new Error('At least one YouTube API key (e.g. YOUTUBE_API_KEY_1 or Youtube_API) is required');

const queries = ['funny shorts', 'gaming shorts', 'school shorts', 'viral shorts', 'music shorts', 'sports shorts'];
const videos = [];
const seen = new Set();
let successfulKey = false;

for (const query of queries) {
  for (const [index, apiKey] of apiKeys.entries()) {
    const params = new URLSearchParams({
      part: 'snippet', maxResults: '25', q: query, type: 'video',
      videoDuration: 'short', videoEmbeddable: 'true', videoSyndicated: 'true', safeSearch: 'moderate', key: apiKey
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.warn(`YouTube key ${index + 1} failed (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
      } catch {
        console.warn(`YouTube key ${index + 1} failed (${response.status})`);
      }
      continue;
    }

    successfulKey = true;
    const data = await response.json();
    for (const item of data.items || []) {
      const videoId = item.id?.videoId;
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      videos.push({videoId, title: item.snippet?.title || 'YouTube Short', channelTitle: item.snippet?.channelTitle || 'YouTube Creator', channelId: item.snippet?.channelId || videoId});
    }
    break;
  }
}

await mkdir('public', {recursive: true});
await writeFile('public/youtube-feed.json', JSON.stringify({
  videos,
  overloaded: !successfulKey,
  generatedAt: Date.now()
}));
console.log(successfulKey ? `Generated ${videos.length} YouTube Shorts` : 'All YouTube API keys are overloaded');
