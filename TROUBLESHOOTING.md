# Troubleshooting Guide

## Common Issues & Solutions

### 1. API Key Errors

#### Error: "ANTHROPIC_API_KEY is not set"
**Cause**: Missing environment variable

**Solutions**:
```bash
# 1. Check .env exists
ls -la .env

# 2. Verify key is set
grep ANTHROPIC_API_KEY .env

# 3. Recreate .env from template
cp .env.example .env
# Edit and add real API key

# 4. Restart server
npm start
```

**Prevention**:
- Never commit .env to Git
- Use .env.example as template
- Add .env to .gitignore

---

#### Error: "Invalid API Key"
**Cause**: API key is wrong or expired

**Solutions**:
```bash
# 1. Get new key from https://console.anthropic.com
# 2. Update .env
ANTHROPIC_API_KEY=sk-ant-your-new-key

# 3. Restart server
docker-compose restart api  # or: npm start
```

**Check Key Validity**:
```bash
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/models
```

---

### 2. Database Connection Errors

#### Error: "connect ECONNREFUSED 127.0.0.1:5432"
**Cause**: PostgreSQL is not running

**Solutions**:

With Docker:
```bash
# Start PostgreSQL
docker-compose up postgres -d

# Check status
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

Without Docker:
```bash
# macOS
brew services start postgresql

# Ubuntu/Debian
sudo systemctl start postgresql

# Windows
# Use PostgreSQL installer or pgAdmin
```

**Test Connection**:
```bash
psql -h localhost -U postgres -d ad_creator

# If works, you'll see prompt: ad_creator=#
```

---

#### Error: "FATAL: role 'postgres' does not exist"
**Cause**: Database user not created

**Solutions**:
```bash
# With Docker Compose
docker-compose down -v  # Reset everything
docker-compose up       # Start fresh

# Without Docker
createuser postgres
createdb -O postgres ad_creator
```

---

#### Error: "Database does not exist"
**Cause**: Database schema not initialized

**Solutions**:
```bash
# Initialize database
psql -h localhost -U postgres -d ad_creator < schema.sql

# Or through the app
npm run init:db
```

---

### 3. Redis Connection Errors

#### Error: "connect ECONNREFUSED 127.0.0.1:6379"
**Cause**: Redis is not running

**Solutions**:

With Docker:
```bash
docker-compose up redis -d
docker-compose ps redis
docker-compose logs redis
```

Without Docker:
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server

# Test connection
redis-cli ping
# Response: PONG
```

---

### 4. Image Generation Errors

#### Error: "Hugging Face API key not configured"
**Cause**: Missing or invalid HUGGINGFACE_API_KEY

**Solutions**:
```bash
# 1. Get free API key
# Visit: https://huggingface.co/settings/tokens
# Click: New token
# Name: ai-ad-creator
# Type: Read

# 2. Update .env
HUGGINGFACE_API_KEY=hf_your_token_here

# 3. Restart server
docker-compose restart api
```

**Test Key**:
```bash
curl -X POST \
  -H "Authorization: Bearer $HUGGINGFACE_API_KEY" \
  https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0
```

---

#### Error: "Model is currently loading"
**Cause**: First request to model takes time to load

**Solution**: Wait 60 seconds and try again (automatic retry in system)

---

#### Error: "Rate limit exceeded"
**Cause**: Too many requests to Hugging Face API

**Solutions**:
```bash
# Wait before creating more ads
# Add delay in code
await new Promise(r => setTimeout(r, 5000));

# Upgrade Hugging Face account for higher limits
# https://huggingface.co/pricing
```

---

### 5. Video Generation Errors

#### Error: "FFmpeg not found"
**Cause**: FFmpeg not installed

**Solutions**:

macOS:
```bash
brew install ffmpeg
```

Ubuntu/Debian:
```bash
sudo apt-get install ffmpeg
```

Windows:
```bash
# Download from https://ffmpeg.org/download.html
# Or use: choco install ffmpeg
```

Docker:
```bash
# Already included in Dockerfile
docker-compose up
```

**Test Installation**:
```bash
ffmpeg -version
```

---

#### Error: "Video assembly timeout"
**Cause**: Video processing taking too long

**Solutions**:
```bash
# Increase timeout in server.js
videoQueue.process(async (job) => {
  // Add timeout config
}, {
  timeout: 600000 // 10 minutes
});

# Reduce video quality/duration
# Use smaller image sizes
# Process fewer scenes
```

---

### 6. Server & Startup Errors

#### Error: "Port 3000 already in use"
**Cause**: Another process using port 3000

**Solutions**:
```bash
# Find process using port
lsof -i :3000
# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

---

#### Error: "Cannot find module 'express'"
**Cause**: Dependencies not installed

**Solutions**:
```bash
# Install dependencies
npm install

# Or clean and reinstall
rm -rf node_modules package-lock.json
npm install

# With Docker
docker-compose down
docker-compose up
```

---

#### Error: "ReferenceError: process is not defined"
**Cause**: Code running in browser instead of Node.js

**Solution**: This shouldn't happen in production. Check you're running `npm start`, not opening index.html in browser.

---

### 7. Project/Ad Creation Errors

#### Error: "Product name is required"
**Cause**: Empty form submission

**Solution**: Fill in all required fields:
- Product Name (required)
- Features (required)
- Everything else optional

---

#### Error: "Project not found"
**Cause**: Invalid project ID

**Solutions**:
```bash
# Get list of projects
curl http://localhost:3000/api/projects

# Check specific project
curl http://localhost:3000/api/project/1
```

---

#### Error: "Job failed after 3 retries"
**Cause**: API rate limit or transient error

**Solutions**:
1. Wait a few minutes
2. Check API credits/quotas
3. Verify API keys
4. Check internet connection
5. Restart with `docker-compose restart api`

---

### 8. Frontend Issues

#### Problem: "Dashboard not loading"
**Cause**: Server not running or incorrect URL

**Solutions**:
```bash
# Check server is running
curl http://localhost:3000/health

# Check frontend file exists
ls -la index.html

# Try different port if 3000 in use
PORT=3001 npm start
# Then open http://localhost:3001
```

---

#### Problem: "Form doesn't submit"
**Cause**: Browser console errors or network issue

**Solutions**:
```bash
# Open DevTools (F12) → Console
# Look for JavaScript errors

# Test API directly
curl -X POST http://localhost:3000/api/create-ad \
  -H "Content-Type: application/json" \
  -d '{"productName":"Test","features":"Test"}'
```

---

#### Problem: "Video preview won't play"
**Cause**: Video URL incorrect or file doesn't exist

**Solutions**:
```bash
# Check video file exists
ls -la public/videos/

# Check project status
curl http://localhost:3000/api/project/1 | grep status
```

---

### 9. Docker Issues

#### Error: "docker: command not found"
**Cause**: Docker not installed

**Solution**: Install Docker from https://docker.com

---

#### Error: "Cannot connect to Docker daemon"
**Cause**: Docker daemon not running

**Solutions**:

macOS:
```bash
# Start Docker Desktop from Applications
# Or via command line:
open /Applications/Docker.app
```

Linux:
```bash
sudo systemctl start docker
```

Windows:
```bash
# Start Docker Desktop
# Or use PowerShell as Administrator:
start-service Docker
```

---

#### Error: "docker-compose: command not found"
**Cause**: Docker Compose not installed

**Solution**:
```bash
# Install Docker Compose
# macOS (included with Docker Desktop)
# Ubuntu/Debian:
sudo apt-get install docker-compose

# Or upgrade:
pip install --upgrade docker-compose
```

---

### 10. Performance Issues

#### Problem: "Slow image generation"
**Cause**: Hugging Face model loading or free tier limits

**Solutions**:
1. First request loads model (60s+)
2. Subsequent requests are faster
3. Upgrade Hugging Face account for higher quotas
4. Use different image generation service

---

#### Problem: "High CPU usage"
**Cause**: Video encoding or multiple jobs processing

**Solutions**:
```bash
# Monitor CPU
docker stats

# Limit concurrent jobs in server.js
graphicsQueue.process(1, async (job) => {
  // Process one at a time instead of 2
});

# Reduce video resolution/quality
```

---

#### Problem: "Out of memory error"
**Cause**: Processing large videos or too many concurrent jobs

**Solutions**:
```bash
# Increase memory in Docker
# Edit docker-compose.yml:
api:
  mem_limit: 4g  # Increase from 2g

# Or reduce video size/duration
```

---

## Debugging Tips

### Enable Debug Logging

```bash
# Node.js debug mode
DEBUG=* npm start

# See specific module
DEBUG=express:* npm start
```

### Check Logs

```bash
# Docker logs
docker-compose logs -f api      # Follow API logs
docker-compose logs api --tail=100  # Last 100 lines

# Local logs
tail -f ~/.pm2/logs/api-out.log  # If using PM2
```

### Database Debugging

```bash
# Connect to database
psql -h localhost -U postgres -d ad_creator

# View tables
\dt

# Check project status
SELECT id, product_name, status FROM projects;

# Check errors
SELECT id, product_name, error_message FROM projects WHERE status = 'error';

# Exit
\q
```

### Redis Debugging

```bash
# Connect to Redis
redis-cli

# Check keys
KEYS *

# View project queue
LLEN bull:storyboard:1  # Queue length

# Check job
HGETALL bull:storyboard:1:<job-id>

# Clear queue
FLUSHDB  # Clear all (careful!)

# Exit
EXIT
```

### API Testing

```bash
# Test API health
curl http://localhost:3000/health

# Test with verbose output
curl -v http://localhost:3000/api/projects

# Test with different content type
curl -H "Content-Type: application/json" \
  http://localhost:3000/api/projects

# Test POST request
curl -X POST http://localhost:3000/api/create-ad \
  -H "Content-Type: application/json" \
  -d '{"productName":"Test","features":"Features"}' \
  -w "\nStatus: %{http_code}\n"
```

---

## Getting Help

### Before asking for help:

1. **Check the logs**
   ```bash
   docker-compose logs -f api
   ```

2. **Test connectivity**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Verify configuration**
   ```bash
   cat .env
   docker-compose ps
   ```

4. **Search issues** on GitHub

### When asking for help, provide:

1. Error message (full text)
2. Steps to reproduce
3. Environment (OS, Node version, Docker version)
4. Relevant logs (from docker-compose logs, console, etc.)
5. What you've already tried

### Resources

- 📖 [README.md](README.md)
- 🔗 [API.md](API.md)
- 🐛 [GitHub Issues](https://github.com/your-repo/issues)
- 💬 [GitHub Discussions](https://github.com/your-repo/discussions)

---

## Performance Optimization

### Reduce API Costs

```javascript
// Cache prompt responses
const cache = new Map();

async function generateStoryboard(productData) {
  const cacheKey = JSON.stringify(productData);
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const result = await callClaudeAPI(productData);
  cache.set(cacheKey, result);
  return result;
}
```

### Batch Processing

```javascript
// Process multiple ads together
const ads = [
  { productName: 'Coffee Maker', features: '...' },
  { productName: 'Headphones', features: '...' },
];

for (const ad of ads) {
  await createAd(ad);
  // Rate limit - wait between requests
  await sleep(2000);
}
```

### Monitor Performance

```bash
# Check response times
curl -w "Time: %{time_total}s\n" http://localhost:3000/api/projects

# Monitor database
EXPLAIN ANALYZE SELECT * FROM projects;

# Check Redis memory
redis-cli INFO memory
```

---

## Safe Recovery

### Database Backup

```bash
# Create backup
docker-compose exec postgres \
  pg_dump -U postgres ad_creator > backup.sql

# Restore from backup
docker-compose exec -T postgres \
  psql -U postgres ad_creator < backup.sql
```

### Clean Reset

```bash
# ⚠️  WARNING: Deletes all data!
docker-compose down -v
docker-compose up
```

---

Keep this guide handy! Most issues have been solved here. 🚀
