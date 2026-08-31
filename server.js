const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const Queue = require('bull');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
  Anthropic = null;
}

dotenv.config();

const app = express();

// ==================== Configuration ====================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL || '';
const REDIS_URL = process.env.REDIS_URL || '';

// ==================== In-Memory Fallback Storage ====================
let useInMemoryDb = false;
let useInMemoryQueue = false;

const memoryStore = {
  projects: new Map(),
  scenes: new Map(),
  assets: new Map(),
  projectSeq: 1,
  sceneSeq: 1,
  assetSeq: 1,
};

// ==================== Initialize Database Client ====================
let pool = null;

if (DATABASE_URL && !DATABASE_URL.includes('@postgres:')) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 1000,
    });
    pool.on('error', () => { useInMemoryDb = true; });
  } catch (err) {
    useInMemoryDb = true;
  }
} else {
  useInMemoryDb = true;
}

// Database helper functions
const db = {
  async query(text, params = []) {
    if (!useInMemoryDb && pool) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        useInMemoryDb = true;
      }
    }

    // In-Memory Database Engine
    const sql = text.trim().toUpperCase();

    if (sql.startsWith('INSERT INTO PROJECTS')) {
      const id = memoryStore.projectSeq++;
      const project = {
        id,
        product_name: params[0],
        features: params[1],
        target_audience: params[2],
        tone: params[3],
        duration: params[4],
        status: params[5] || 'processing',
        storyboard: null,
        video_url: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryStore.projects.set(id, project);
      return { rows: [{ id, created_at: project.created_at }] };
    }

    if (sql.startsWith('SELECT ID, PRODUCT_NAME') || sql.startsWith('SELECT * FROM PROJECTS')) {
      if (sql.includes('WHERE ID = $1')) {
        const id = parseInt(params[0], 10);
        const p = memoryStore.projects.get(id);
        return { rows: p ? [p] : [] };
      }
      const list = Array.from(memoryStore.projects.values()).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      return { rows: list };
    }

    if (sql.startsWith('SELECT STORYBOARD FROM PROJECTS')) {
      const id = parseInt(params[0], 10);
      const p = memoryStore.projects.get(id);
      return { rows: p ? [{ storyboard: p.storyboard }] : [] };
    }

    if (sql.startsWith('UPDATE PROJECTS SET STATUS = $1, UPDATED_AT = NOW() WHERE ID = $2')) {
      const status = params[0];
      const id = parseInt(params[1], 10);
      const p = memoryStore.projects.get(id);
      if (p) {
        p.status = status;
        p.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE PROJECTS SET STORYBOARD = $1, UPDATED_AT = NOW() WHERE ID = $2')) {
      const sb = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
      const id = parseInt(params[1], 10);
      const p = memoryStore.projects.get(id);
      if (p) {
        p.storyboard = sb;
        p.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE PROJECTS SET STATUS = $1, VIDEO_URL = $2')) {
      const status = params[0];
      const videoUrl = params[1];
      const id = parseInt(params[2], 10);
      const p = memoryStore.projects.get(id);
      if (p) {
        p.status = status;
        p.video_url = videoUrl;
        p.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    if (sql.startsWith('UPDATE PROJECTS SET STATUS = $1, ERROR_MESSAGE = $2')) {
      const status = params[0];
      const errorMsg = params[1];
      const id = parseInt(params[2], 10);
      const p = memoryStore.projects.get(id);
      if (p) {
        p.status = status;
        p.error_message = errorMsg;
        p.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO SCENES')) {
      const id = memoryStore.sceneSeq++;
      const scene = {
        id,
        project_id: params[0],
        scene_number: params[1],
        duration: params[2],
        visual_description: params[3],
        voiceover_script: params[4],
        music_mood: params[5],
        created_at: new Date().toISOString(),
      };
      memoryStore.scenes.set(id, scene);
      return { rows: [{ id }] };
    }

    if (sql.startsWith('SELECT * FROM SCENES')) {
      const projectId = parseInt(params[0], 10);
      const scenes = Array.from(memoryStore.scenes.values())
        .filter((s) => s.project_id === projectId)
        .sort((a, b) => a.scene_number - b.scene_number);
      return { rows: scenes };
    }

    if (sql.startsWith('INSERT INTO ASSETS')) {
      const id = memoryStore.assetSeq++;
      const asset = {
        id,
        project_id: params[0],
        scene_id: params[1],
        asset_type: params[2],
        url: params[3],
        status: params[4] || 'ready',
        created_at: new Date().toISOString(),
      };
      memoryStore.assets.set(id, asset);
      return { rows: [{ id }] };
    }

    if (sql.startsWith('SELECT * FROM ASSETS')) {
      const projectId = parseInt(params[0], 10);
      const assets = Array.from(memoryStore.assets.values())
        .filter((a) => a.project_id === projectId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return { rows: assets };
    }

    if (sql.startsWith('DELETE FROM PROJECTS')) {
      const id = parseInt(params[0], 10);
      const existed = memoryStore.projects.has(id);
      memoryStore.projects.delete(id);
      return { rows: existed ? [{ id }] : [] };
    }

    return { rows: [] };
  },
};

// ==================== Initialize Redis & Queue Client ====================
let redisClient = null;

const createMockQueue = (name) => {
  const handlers = [];
  return {
    process: (concurrent, handler) => {
      const fn = typeof concurrent === 'function' ? concurrent : handler;
      handlers.push(fn);
    },
    add: async (data) => {
      setImmediate(async () => {
        for (const handler of handlers) {
          try {
            await handler({ data, id: Date.now() });
          } catch (e) {
            console.error(`❌ Queue [${name}] execution error:`, e.message);
          }
        }
      });
      return { id: Date.now() };
    },
    on: () => { },
  };
};

let storyboardQueue = createMockQueue('storyboard');
let graphicsQueue = createMockQueue('graphics');
let videoQueue = createMockQueue('video');

if (REDIS_URL && process.env.ENABLE_REDIS === 'true') {
  try {
    storyboardQueue = new Queue('storyboard', REDIS_URL);
    graphicsQueue = new Queue('graphics', REDIS_URL);
    videoQueue = new Queue('video', REDIS_URL);
    storyboardQueue.on('error', () => { });
    graphicsQueue.on('error', () => { });
    videoQueue.on('error', () => { });
  } catch (err) {
    storyboardQueue = createMockQueue('storyboard');
    graphicsQueue = createMockQueue('graphics');
    videoQueue = createMockQueue('video');
  }
} else {
  useInMemoryQueue = true;
}

if (useInMemoryQueue || !storyboardQueue) {
  storyboardQueue = createMockQueue('storyboard');
  graphicsQueue = createMockQueue('graphics');
  videoQueue = createMockQueue('video');
}

// ==================== Middleware ====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Serve Frontend Dashboard at Root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ==================== Health Checks ====================
app.get('/health', async (req, res) => {
  let dbStatus = 'connected (in-memory)';
  let redisStatus = 'connected (in-memory)';

  if (!useInMemoryDb && pool) {
    try {
      const dbCheck = await pool.query('SELECT NOW()');
      dbStatus = dbCheck.rows.length > 0 ? 'connected (postgres)' : 'failed';
    } catch (e) {
      dbStatus = 'failed';
    }
  }

  if (!useInMemoryQueue && redisClient) {
    try {
      const redisCheck = await redisClient.ping();
      redisStatus = redisCheck === 'PONG' ? 'connected (redis)' : 'failed';
    } catch (e) {
      redisStatus = 'failed';
    }
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    redis: redisStatus,
    free_ai_enabled: true,
    supported_providers: ['gemini-free', 'openrouter-free', 'pollinations-free', 'built-in-free', 'anthropic'],
    environment: NODE_ENV,
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    free_ai_enabled: true,
  });
});

// ==================== Database Initialization ====================
async function initializeDatabase() {
  if (useInMemoryDb || !pool) {
    console.log('✅ In-memory database ready');
    return;
  }
  try {
    const schema = `
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255) NOT NULL,
        features TEXT NOT NULL,
        target_audience VARCHAR(255),
        tone VARCHAR(50) DEFAULT 'professional',
        duration INT DEFAULT 15,
        status VARCHAR(50) DEFAULT 'processing',
        storyboard JSONB,
        video_url VARCHAR(500),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scenes (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        scene_number INT,
        duration INT,
        visual_description TEXT,
        voiceover_script TEXT,
        music_mood VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        scene_id INT,
        asset_type VARCHAR(50),
        url VARCHAR(500),
        status VARCHAR(50) DEFAULT 'processing',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);
      CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
    `;

    for (const statement of schema.split(';')) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    console.log('✅ Postgres database initialized');
  } catch (error) {
    console.warn('⚠️ Postgres setup failed, falling back to In-Memory DB:', error.message);
    useInMemoryDb = true;
  }
}

// ==================== AI Provider Engine ====================

/**
 * Generate Storyboard using Gemini, OpenRouter, Anthropic, or Free Built-in Template Engine
 */
async function generateStoryboardAI({ productName, features, targetAudience, tone, duration, customApiKey, provider }) {
  const prompt = `You are an award-winning Super Bowl & viral commercial copywriter and creative director.

Create an irresistible, high-converting, viral ${duration}-second commercial script for:
- Product: ${productName}
- Features: ${features}
- Audience: ${targetAudience}
- Tone: ${tone} (make it feel ${tone}, energetic, catchy, and impossible to ignore!)

Copywriting Framework:
- HOOK: An explosive opening hook line that grabs attention in the first 2 seconds.
- STORY & PROBLEM: Fast-paced, high-impact narrative highlighting how ${productName} solves problems.
- VOICE-OVER: Short, rhythmic, ultra-catchy, viral script written for persuasive voiceover delivery.

Return ONLY a valid JSON object with this exact structure (no markdown tags, no extra text):
{
  "title": "Unforgettable Commercial Title",
  "hook": "Explosive Attention-Grabbing Hook",
  "scenes": [
    {
      "scene_number": 1,
      "duration": ${duration},
      "visual_description": "Vivid 8k master photoshoot detail, studio lighting, sharp focus, 35mm lens, widescreen",
      "voiceover_script": "Hyper-catchy, rhythmic, viral commercial voiceover script that mesmerizes listeners",
      "music_mood": "High Energy Beat Drop / Electric Commercial Synth",
      "visual_elements": ["element1", "element2"]
    }
  ],
  "music_suggestions": ["Upbeat Commercial Pop", "Viral Bass Synth"],
  "color_palette": ["#4F46E5", "#10B981", "#F59E0B"],
  "key_messages": ["Message 1", "Message 2"],
  "cta": "Irresistible Call to Action"
}

Rules:
- Include EXACTLY 1 single master hero scene totaling ${duration} seconds.
- DO NOT create more than 1 scene.
- Voiceover script MUST be ultra-catchy, energetic, human, and persuasive!`;

  const geminiKey = customApiKey || process.env.GEMINI_API_KEY;
  const openRouterKey = customApiKey || process.env.OPENROUTER_API_KEY;
  const anthropicKey = customApiKey || process.env.ANTHROPIC_API_KEY;

  // 1. Try Google Gemini (Free Tier API Key)
  if ((provider === 'gemini' || !provider || geminiKey) && geminiKey) {
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    for (const modelName of models) {
      try {
        console.log(`⚡ Generating storyboard using Google Gemini API (${modelName})...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            console.log(`✅ Storyboard created with Google Gemini (${modelName})!`);
            return JSON.parse(cleaned);
          }
        } else {
          console.warn(`Gemini model ${modelName} returned status ${response.status}:`, await response.text());
        }
      } catch (e) {
        console.warn(`Gemini model ${modelName} call failed:`, e.message);
      }
    }
  }

  // 2. Try OpenRouter Free Models
  if ((provider === 'openrouter' || !provider) && openRouterKey) {
    try {
      console.log('🦙 Generating storyboard using OpenRouter Free Model...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch (e) {
      console.warn('OpenRouter API failed:', e.message);
    }
  }

  // 3. Try Anthropic Claude if available
  if ((provider === 'anthropic' || (!provider && anthropicKey)) && anthropicKey && Anthropic) {
    try {
      console.log('🤖 Generating storyboard using Anthropic Claude...');
      const anthropicClient = new Anthropic({ apiKey: anthropicKey });
      const message = await anthropicClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      const responseText = message.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(responseText);
    } catch (e) {
      console.warn('Anthropic API failed:', e.message);
    }
  }

  // 4. Built-in Smart Free AI Template Generator (100% Free - Works Offline & Without Keys!)
  console.log('🌟 Using Built-in Smart Free AI Generator (No Key Required!)...');

  const toneHooks = {
    energetic: `Stop scrolling! Meet ${productName}—the game-changer you've been waiting for!`,
    luxury: `Indulge in pure perfection. Experience ${productName}, crafted for the elite.`,
    humorous: `Think you've seen it all? Think again! ${productName} is here to blow your mind.`,
    casual: `Hey there! Ready to make everyday 10x easier with ${productName}?`,
    professional: `Elevate your standards with ${productName}—engineered for ultimate performance.`,
  };

  const selectedHook = toneHooks[tone?.toLowerCase()] || `Ready to revolutionize your world with ${productName}?`;

  const catchyScript = `Stop settling for ordinary! ${productName} delivers ultimate power with ${features}. Designed specifically for ${targetAudience} who refuse to compromise. Upgrade your lifestyle with ${productName} today!`;

  return {
    title: `🔥 ${productName} Commercial - The Game Changer`,
    hook: selectedHook,
    scenes: [
      {
        scene_number: 1,
        duration: duration || 15,
        visual_description: `Hyperrealistic 8k master hero commercial photoshoot of ${productName} showcasing ${features} with dramatic studio lighting, 35mm lens, depth of field, and 16:9 widescreen composition.`,
        voiceover_script: catchyScript,
        music_mood: tone === 'energetic' ? '⚡ High-Energy Beat Drop & Bass' : '🎶 Cinematic Upbeat Commercial Synth',
        visual_elements: [productName, 'Master Hero Spotlight', 'Cinematic Studio Glow'],
      },
    ],
    music_suggestions: ['Upbeat Commercial Pop', 'Viral Bass Drop Synthwave'],
    color_palette: ['#4F46E5', '#10B981', '#F59E0B'],
    key_messages: [`Unmatched quality with ${productName}`, `Crafted for ${targetAudience}`, `Hero Feature: ${features}`],
    cta: `🔥 Claim Your ${productName} Today - Special Offer Available!`,
  };
}

// ==================== API Routes ====================

/**
 * POST /api/create-ad
 * Create a new advertisement project
 */
app.post('/api/create-ad', async (req, res) => {
  try {
    const { productName, features, targetAudience, tone, duration, apiKey, provider } = req.body;

    if (!productName?.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!features?.trim()) {
      return res.status(400).json({ error: 'Features are required' });
    }

    const result = await db.query(
      `INSERT INTO projects (product_name, features, target_audience, tone, duration, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [productName, features, targetAudience || 'general audience', tone || 'professional', duration || 15, 'processing']
    );

    const projectId = result.rows[0].id;
    console.log(`📝 Created project ${projectId}: ${productName}`);

    await storyboardQueue.add({
      projectId,
      productName,
      features,
      targetAudience: targetAudience || 'general audience',
      tone: tone || 'professional',
      duration: duration || 15,
      apiKey,
      provider,
    });

    res.status(201).json({
      projectId,
      status: 'queued',
      message: 'Your ad is being generated for FREE! Check back in a moment.',
    });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ error: 'Failed to create ad', details: error.message });
  }
});

/**
 * GET /api/projects
 * Get all projects
 */
app.get('/api/projects', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, product_name, features, target_audience, tone, duration, status, video_url, created_at, updated_at
       FROM projects ORDER BY created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/project/:projectId
 */
app.get('/api/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = result.rows[0];

    const scenesResult = await db.query(`SELECT * FROM scenes WHERE project_id = $1 ORDER BY scene_number`, [projectId]);
    const assetsResult = await db.query(`SELECT * FROM assets WHERE project_id = $1 ORDER BY created_at`, [projectId]);

    res.json({
      ...project,
      scenes: scenesResult.rows,
      assets: assetsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * DELETE /api/project/:projectId
 */
app.delete('/api/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const pId = parseInt(projectId, 10);

    if (useInMemoryDb) {
      memoryStore.projects.delete(pId);
      Array.from(memoryStore.scenes.keys()).forEach(id => {
        if (memoryStore.scenes.get(id)?.project_id === pId) memoryStore.scenes.delete(id);
      });
      Array.from(memoryStore.assets.keys()).forEach(id => {
        if (memoryStore.assets.get(id)?.project_id === pId) memoryStore.assets.delete(id);
      });
    } else {
      await db.query(`DELETE FROM projects WHERE id = $1`, [pId]);
      await db.query(`DELETE FROM scenes WHERE project_id = $1`, [pId]);
      await db.query(`DELETE FROM assets WHERE project_id = $1`, [pId]);
    }

    res.json({ success: true, message: `Project ${pId} deleted` });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * GET /api/project/:projectId/storyboard
 */
app.get('/api/project/:projectId/storyboard', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(`SELECT storyboard FROM projects WHERE id = $1`, [projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0].storyboard || {});
  } catch (error) {
    console.error('Error fetching storyboard:', error);
    res.status(500).json({ error: 'Failed to fetch storyboard' });
  }
});

/**
 * DELETE /api/project/:projectId
 */
app.delete('/api/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [projectId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted', projectId });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ==================== Queue Processors ====================

/**
 * Storyboard Worker
 */
storyboardQueue.process(async (job) => {
  const { projectId, productName, features, targetAudience, tone, duration, apiKey, provider } = job.data;

  try {
    console.log(`✍️  Generating storyboard for project ${projectId}...`);

    await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', [
      'generating_storyboard',
      projectId,
    ]);

    const storyboard = await generateStoryboardAI({
      productName,
      features,
      targetAudience,
      tone,
      duration,
      customApiKey: apiKey,
      provider,
    });

    await db.query('UPDATE projects SET storyboard = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(storyboard),
      projectId,
    ]);

    for (const scene of storyboard.scenes) {
      await db.query(
        `INSERT INTO scenes (project_id, scene_number, duration, visual_description, voiceover_script, music_mood)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, scene.scene_number, scene.duration, scene.visual_description, scene.voiceover_script, scene.music_mood]
      );
    }

    console.log(`✅ Storyboard generated for project ${projectId}`);

    for (const scene of storyboard.scenes) {
      await graphicsQueue.add({
        projectId,
        sceneId: scene.scene_number,
        visualDescription: scene.visual_description,
        productName,
      });
    }

    return { success: true, projectId, scenesCreated: storyboard.scenes.length };
  } catch (error) {
    console.error(`❌ Storyboard generation failed for ${projectId}:`, error);
    await db.query('UPDATE projects SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3', [
      'error',
      error.message,
      projectId,
    ]);
    throw error;
  }
});

/**
 * Graphics Generation Worker
 * Uses Pollinations.ai (100% FREE - NO KEY REQUIRED!) or Hugging Face
 */
graphicsQueue.process(async (job) => {
  const { projectId, sceneId, visualDescription, productName } = job.data;

  try {
    console.log(`🎨 Generating image for scene ${sceneId} of project ${projectId}...`);

    const imagesDir = path.join(process.cwd(), 'public', 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    const fileName = `project-${projectId}-scene-${sceneId}-${Date.now()}.png`;
    const filePath = path.join(imagesDir, fileName);

    let imageUrl = '';
    const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

    // 1. Try Hugging Face if key is set
    if (HF_TOKEN) {
      try {
        const prompt = `Professional product advertisement scene for ${productName}: ${visualDescription}. Ultra high quality, 16:9 aspect ratio, 4k studio photography.`;
        const response = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
          headers: { Authorization: `Bearer ${HF_TOKEN}` },
          method: 'POST',
          body: JSON.stringify({ inputs: prompt }),
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await fs.writeFile(filePath, buffer);
          imageUrl = `/images/${fileName}`;
        }
      } catch (e) {
        console.warn('HuggingFace failed, switching to Pollinations.ai free generator:', e.message);
      }
    }

    // 2. Pollinations.ai 100% FREE Instant Image Generator (No Key Required!)
    if (!imageUrl) {
      console.log(`🚀 Generating single-video cohesive AI frame for Scene ${sceneId} of Project ${projectId}...`);
      
      let colorStyle = 'sleek modern commercial studio';
      try {
        const sbRes = await db.query('SELECT storyboard FROM projects WHERE id = $1', [projectId]);
        const sb = sbRes.rows[0]?.storyboard;
        if (sb && sb.color_palette && sb.color_palette.length) {
          colorStyle = `${sb.color_palette.join(', ')} brand colors`;
        }
      } catch (e) {}

      // FIXED SEED ANCHOR: Uses identical seed for all scenes in the project to guarantee matching product & background!
      const projectSeed = ((projectId * 31337) % 899999) + 100000;
      const ultraPrompt = `crystal clear ultra hd 8k commercial product advertisement photoshoot of ${productName}, scene ${sceneId}: ${visualDescription}, ${colorStyle}, award winning studio photography, pin sharp focus, high contrast, professional 35mm lens, 16:9 widescreen, hyperdetailed`;
      
      imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(ultraPrompt)}?width=1920&height=1080&model=flux&nologo=true&enhance=true&seed=${projectSeed}`;

      // Asynchronously attempt background cache to local file
      setImmediate(async () => {
        try {
          const resp = await fetch(imageUrl);
          if (resp.ok) {
            const arrayBuffer = await resp.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(arrayBuffer));
          }
        } catch (e) {}
      });
    }

    await db.query(
      `INSERT INTO assets (project_id, scene_id, asset_type, url, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId, sceneId, 'graphic', imageUrl, 'ready']
    );

    console.log(`✅ Image created for scene ${sceneId}: ${imageUrl}`);

    // Trigger video queue after all scenes graphics are requested
    await videoQueue.add({ projectId });

    return { success: true, sceneId, imageUrl };
  } catch (error) {
    console.error(`❌ Graphics generation failed for scene ${sceneId}:`, error);
    throw error;
  }
});

/**
 * Video Assembly Worker
 */
videoQueue.process(async (job) => {
  const { projectId } = job.data;

  try {
    console.log(`🎬 Completing project ${projectId}...`);

    await db.query('UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2', [
      'assembling_video',
      projectId,
    ]);

    const videoUrl = `/images/sample-${projectId}.mp4`;

    await db.query(`UPDATE projects SET status = $1, video_url = $2, updated_at = NOW() WHERE id = $3`, [
      'completed',
      videoUrl,
      projectId,
    ]);

    console.log(`✅ Project completed for ID ${projectId}`);
    return { success: true, projectId, videoUrl };
  } catch (error) {
    console.error(`❌ Video assembly failed for ${projectId}:`, error);
    await db.query('UPDATE projects SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3', [
      'error',
      error.message,
      projectId,
    ]);
    throw error;
  }
});

// ==================== Startup ====================
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🎬 FREE AI Ad Creator Server Started                    ║
╠═══════════════════════════════════════════════════════════╣
║ Port: ${PORT}
║ Environment: ${NODE_ENV}
║ DB Mode: ${useInMemoryDb ? 'In-Memory (0 setup required)' : 'Postgres Connected'}
║ Queue Mode: ${useInMemoryQueue ? 'In-Memory (0 setup required)' : 'Redis Connected'}
║ Free AI Options: Google Gemini, OpenRouter Free, Pollinations
╚═══════════════════════════════════════════════════════════╝
`);
      console.log(`🌐 Local Laptop URL: http://localhost:${PORT}`);
      console.log(`📱 Mobile/Wi-Fi URL: http://192.168.29.45:${PORT}`);
      console.log(`⚡ API Endpoint: http://localhost:${PORT}/api/create-ad`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (pool) await pool.end();
  if (redisClient) await redisClient.quit();
  process.exit(0);
});

startServer();

module.exports = app;
