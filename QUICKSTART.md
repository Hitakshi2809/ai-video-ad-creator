# Quick Start Guide - Get Running in 30 Seconds (100% FREE)

## 🚀 Instant 1-Command Startup (Zero Setup Required)

You don't need to install PostgreSQL, Redis, or pay for API keys! The app includes:
- **Built-in Smart Free AI**: Generates storyboards with **0 API keys required**.
- **Pollinations.ai**: Generates high-quality AI images **100% free with 0 API keys**.
- **In-Memory Fallback**: Works instantly with zero database setup.

```bash
# 1. Install dependencies
npm install

# 2. Run the application!
npm start

# 3. Open http://localhost:3000 in your browser!
```

---

## 🔑 How to Use Free AI Keys (Optional)

If you want to use external LLMs for free:

### 1. Google Gemini (100% Free Tier - Recommended)
- Go to: [Google AI Studio](https://aistudio.google.com/app/apikey)
- Click **Create API Key** (No credit card needed!)
- Either set `GEMINI_API_KEY=your-key` in `.env` OR paste it directly into the web dashboard!

### 2. OpenRouter Free Models
- Go to: [OpenRouter Keys](https://openrouter.ai/keys)
- Get a free key to access open-source models like Llama 3 & Gemma 2!

### 3. Pollinations.ai (Free AI Images)
- Automatically enabled! Generates crisp HD visuals for every scene with **0 API keys**.

---

## 🌐 Easy 1-Click Cloud Deployment

### Deploy to Render (Free Web Service)
1. Push this repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Web Service**.
4. Connect your repo and set build command to `npm install` and start command to `npm start`.
5. Done! Your app is live with 100% Free AI!

### Deploy with Docker
```bash
docker-compose up
```

---

## 📁 Environment Setup (`.env`)

```env
# Optional: Google Gemini Free API Key
GEMINI_API_KEY=

# Optional: OpenRouter Free Key
OPENROUTER_API_KEY=

# Optional: HuggingFace Token
HUGGINGFACE_API_KEY=
```
