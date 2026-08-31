# 🎬 FREE AI Ad Creator - Professional Product Videos in Seconds

> Automatically generate compelling product advertisements using 100% Free AI. Describe your product, and watch as Free AI creates storyboards, Pollinations.ai generates visuals, and everything is assembled in real time.

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node->=18.0.0-blue)
![Cost](https://img.shields.io/badge/cost-100%25%20FREE-brightgreen)
![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)

## ✨ Features

- 🌟 **100% Free Built-in AI**: Works out of the box with **ZERO API keys required**!
- ⚡ **Google Gemini Free Tier Support**: Use Google AI Studio's 100% free Gemini 2.5 / 1.5 Flash key (No credit card needed).
- 🎨 **Pollinations.ai Free Image Generator**: Generates HD product visuals with **0 API keys**.
- 🦙 **OpenRouter Free Tier Support**: Access open-source models (Llama 3, Gemma 2).
- 🚀 **Zero-Dependency Instant Deployment**: Automatically falls back to In-Memory DB & Queue if Postgres or Redis are not running.
- 📱 **Interactive Web Dashboard**: Built-in visual editor, live progress bar, and scene previews.
- 🐳 **Docker & Render Ready**: Deploy anywhere with 1 click!

---

## ⚡ Quick Start (Instant Setup)

### 1. Run Locally (Zero Database / Zero Key Required)

```bash
# Clone repository & enter directory
cd ai-ad-creator

# Install dependencies
npm install

# Start application!
npm start

# Open browser: http://localhost:3000
```

---

## 🔑 AI Options & Free Keys

| AI Provider | Free Tier | API Key Required? | Get Key Link |
|---|---|---|---|
| **Built-in Smart AI** | 100% Free | ❌ **NO** (Works out of box) | Built-in |
| **Pollinations.ai Visuals** | 100% Free | ❌ **NO** (Works out of box) | Built-in |
| **Google Gemini API** | 100% Free | ⚡ Yes (No credit card) | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **OpenRouter Free** | 100% Free | 🦙 Yes | [OpenRouter Keys](https://openrouter.ai/keys) |
| **HuggingFace Tokens** | Free | 🎨 Yes | [HuggingFace Settings](https://huggingface.co/settings/tokens) |
| **Anthropic Claude** | Optional | 🤖 Yes | [Anthropic Console](https://console.anthropic.com) |

---

## 🌐 1-Click Cloud Deployment

### Deploy to Render (Free Tier)
1. Push this repository to GitHub.
2. Go to [Render.com](https://render.com) -> New Web Service.
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Click Deploy!

### Deploy with Docker
```bash
docker-compose up
```

---

## 📋 API Usage

```bash
# Create an ad for free
curl -X POST http://localhost:3000/api/create-ad \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "UltraFit Earbuds",
    "features": "Noise cancellation, 40-hour battery, waterproof",
    "targetAudience": "Athletes and commuters",
    "tone": "energetic",
    "duration": 15
  }'

# Check project status
curl http://localhost:3000/api/project/1
```

See [API.md](API.md) for full endpoint specifications.
