import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const geminiKey = process.env.GEMINI_API_KEY || process.env['CentralTOK-key'] || process.env.CENTRALTOK_KEY;
  if (!aiClient && geminiKey) {
    aiClient = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Universal CORS and OPTIONS handler so preflight or relative requests never fail with 405
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const handleChat = async (req: express.Request, res: express.Response) => {
    if (req.method === 'GET') {
      return res.json({ status: "ok", message: "AI chat service is active" });
    }

    try {
      const { history = [], prompt, videoContext = {} } = req.body || {};
      
      const systemInstruction = `You are a helpful, friendly, and witty AI video assistant inside CentralTok.
You watched the video clip with the user.
Video Context:
- Description / Title: "${videoContext.description || 'Unknown'}"
- Creator: @${videoContext.creator || 'unknown'}
- Tags: ${videoContext.tags && videoContext.tags.length ? videoContext.tags.join(', ') : 'None'}

Answer any questions the user has about this video, explain what is happening in the clip, or chat about off-topic subjects if requested. Keep your responses concise, conversational, and engaging.`;

      const ai = getAiClient();
      if (ai) {
        // Construct contents array from history and new prompt
        const formattedHistory = Array.isArray(history) 
          ? history.map((m: any) => ({
              role: m.role === 'model' ? 'model' : 'user',
              parts: Array.isArray(m.parts) ? m.parts : [{ text: String(m.text || m.parts || '') }]
            }))
          : [];
        
        formattedHistory.push({ role: 'user', parts: [{ text: prompt || 'Can you tell me about this video?' }] });

        const candidateModels = ["gemini-3.6-flash", "gemini-2.0-flash", "gemini-flash-latest"];
        let generatedText = '';
        
        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: formattedHistory,
              config: {
                systemInstruction,
              },
            });
            if (response && response.text) {
              generatedText = response.text;
              break;
            }
          } catch (modelErr) {
            console.warn(`Model ${modelName} attempt failed:`, modelErr);
          }
        }

        if (generatedText) {
          return res.json({ response: generatedText });
        }
      }

      // Intelligent local fallback if GEMINI_API_KEY is not yet supplied in settings
      const p = (prompt || '').toLowerCase();
      let fallbackText = `I watched "${videoContext.description || 'this video'}" by @${videoContext.creator || 'the creator'}. `;
      if (p.includes('summary') || p.includes('what happened') || p.includes('explain') || p.includes('initial impression')) {
        fallbackText += `In this video, the creator focuses on entertaining short-form content featuring ${videoContext.tags?.join(', ') || 'trending themes'}. It's captivating, fun, and quick-paced!`;
      } else if (p.includes('who') || p.includes('creator')) {
        fallbackText += `This video was published by @${videoContext.creator || 'the user'}.`;
      } else if (p.includes('joke')) {
        fallbackText = `Why did the video go viral? Because it couldn't stop buffering up laughs! What else can I help you with?`;
      } else {
        fallbackText += `Regarding "${prompt}": It's an interesting question! Whether you want to talk about details in the clip or discuss something off-topic, I'm all ears.`;
      }
      res.json({ response: fallbackText });
    } catch (error: any) {
      console.error('Chat API Error:', error);
      res.json({ 
        response: `I've watched the video! It's titled "${req.body?.videoContext?.description || 'Video'}" by @${req.body?.videoContext?.creator || 'creator'}. Ask me any detail about what happened or any general question!`
      });
    }
  };

  async function getGlobalSettings() {
    try {
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0065963524";
      const databaseId = "ai-studio-centraltok-20b3b741-dd0c-4874-8036-490f35162ac6";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/app_settings/global`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const fields = data.fields || {};
        return {
          youtubeApiKeyIndex: parseInt(fields.youtubeApiKeyIndex?.integerValue || '0'),
          useCache: fields.useCache?.booleanValue ?? true,
          serverCrashed: fields.serverCrashed?.booleanValue ?? false,
        };
      }
    } catch (err) {
      console.warn("Settings fetch failed, using defaults", err);
    }
    return { youtubeApiKeyIndex: 0, useCache: true, serverCrashed: false };
  }

  // Support both /api/chat and wildcard paths to avoid 405
  app.all("/api/chat", handleChat);
  app.all("*/api/chat", handleChat);

  app.get("/api/ai-search", async (req, res) => {
    try {
      const q = req.query.q as string || 'trending';
      const ai = getAiClient();
      if (!ai) return res.status(503).json({ error: "AI Service Unavailable" });

      const prompt = `You are a search engine for "CentralTok", a short-form video app like TikTok.
User is searching for: "${q}"
Generate 6 diverse and highly relevant video search results. 
Each result must be a JSON object with:
- id: a unique string starting with "ai_"
- description: a catchy video description
- username: a creative username for the creator
- handle: a creative handle (no spaces)
- tags: array of 3-5 relevant hashtags
- views: a realistic view count (number)
- duration: length in seconds (15-60)

Return ONLY a valid JSON array of these objects. No markdown formatting, no extra text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text || '[]';
      const aiResults = JSON.parse(text);
      
      res.json(aiResults);
    } catch (error) {
      console.error('AI Search Error:', error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/youtube-shorts", async (req, res) => {
    try {
      const settings = await getGlobalSettings();
      if (settings.serverCrashed) {
        return res.status(503).json({ error: "Servers has crashed" });
      }

      const apiKeys = Array.from({length: 20}, (_, index) => process.env[`YOUTUBE_API_KEY_${index + 1}`]).filter(Boolean) as string[];
      if (process.env.YOUTUBE_API_KEY && !apiKeys.includes(process.env.YOUTUBE_API_KEY)) {
        apiKeys.unshift(process.env.YOUTUBE_API_KEY);
      }

      if (apiKeys.length === 0) {
        return res.status(500).json({ error: "YouTube API Key is required. Please set YOUTUBE_API_KEY in secrets." });
      }

      const pageToken = req.query.pageToken as string || '';
      const fallbackQueries = [
        'best viral shorts 2026',
        'top tier gaming clips',
        'elite comedy reels 2026',
        'trending tech moments',
        'clever humor viral',
        'high energy entertainment'
      ];
      const randomFallback = fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
      const searchQuery = req.query.q as string || randomFallback;
      const maxResults = req.query.maxResults as string || '8';
      
      // Select keys based on strategy
      let keysToTry = apiKeys;
      if (settings.youtubeApiKeyIndex > 0 && settings.youtubeApiKeyIndex <= apiKeys.length) {
        keysToTry = [apiKeys[settings.youtubeApiKeyIndex - 1]];
      }

      for (const apiKey of keysToTry) {
        const queryParams = new URLSearchParams({
          part: 'snippet', 
          maxResults, 
          q: searchQuery, 
          type: 'video', 
          videoDuration: 'short',
          relevanceLanguage: 'en',
          key: apiKey
        });
        if (pageToken) queryParams.append('pageToken', pageToken);
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          // Filter items to ensure English only titles (Latin alphabet dominance)
          if (data.items) {
            data.items = data.items.filter((item: any) => {
              const title = item.snippet?.title || '';
              // Check if title has reasonable ASCII/Latin character ratio
              const asciiCount = (title.match(/[a-zA-Z0-9\s.,!?#@]/g) || []).length;
              return asciiCount / (title.length || 1) > 0.4;
            });
          }
          return res.json(data);
        }
      }
      res.status(503).json({
        error: 'The Servers are Overloaded, This will be fixed shortly',
        details: 'All configured API keys failed to return a valid response. Please check your YouTube API keys and quotas in Google Cloud Console.'
      });
    } catch (error) {
      console.error('YouTube API Error:', error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env['NODE_ENV'] !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
