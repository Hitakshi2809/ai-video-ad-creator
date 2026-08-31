# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently, the API is open (no authentication required). For production, add JWT authentication.

---

## Endpoints

### Health Checks

#### GET `/health`
Check API health status

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "database": "connected",
  "redis": "connected",
  "environment": "development"
}
```

---

### Projects

#### POST `/create-ad`
Create a new advertisement project

**Request Body:**
```json
{
  "productName": "Wireless Headphones Pro",
  "features": "30-hour battery, noise cancellation, premium sound",
  "targetAudience": "Music producers and travelers",
  "tone": "professional",
  "duration": 15
}
```

**Parameters:**
- `productName` (string, required) - Name of the product
- `features` (string, required) - Key features of the product
- `targetAudience` (string, optional) - Who the product is for
- `tone` (string, optional) - Video tone: 'professional', 'casual', 'energetic', 'luxury', 'playful'
- `duration` (number, optional) - Video duration in seconds: 15, 30, or 60 (default: 15)

**Response:**
```json
{
  "projectId": 1,
  "status": "queued",
  "message": "Your ad is being created. Check back in a moment!"
}
```

**Status Codes:**
- `201` - Project created successfully
- `400` - Invalid request (missing required fields)
- `500` - Server error

**Example:**
```bash
curl -X POST http://localhost:3000/api/create-ad \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Coffee Maker",
    "features": "Quick brew, quiet operation",
    "targetAudience": "Busy professionals",
    "tone": "energetic",
    "duration": 30
  }'
```

---

#### GET `/projects`
Get all projects

**Query Parameters:**
- `limit` (number, optional) - Limit results (default: 50)
- `offset` (number, optional) - Skip results (default: 0)
- `status` (string, optional) - Filter by status

**Response:**
```json
[
  {
    "id": 1,
    "product_name": "Wireless Headphones Pro",
    "features": "30-hour battery...",
    "target_audience": "Music producers",
    "tone": "professional",
    "duration": 15,
    "status": "completed",
    "video_url": "http://localhost:3000/videos/project-1.mp4",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z"
  }
]
```

**Example:**
```bash
curl http://localhost:3000/api/projects
```

---

#### GET `/project/:projectId`
Get a specific project with all details

**Response:**
```json
{
  "id": 1,
  "product_name": "Wireless Headphones Pro",
  "features": "30-hour battery...",
  "target_audience": "Music producers",
  "tone": "professional",
  "duration": 15,
  "status": "completed",
  "video_url": "http://localhost:3000/videos/project-1.mp4",
  "storyboard": {
    "title": "Immersive Sound Experience",
    "hook": "Experience music like never before",
    "scenes": [
      {
        "scene_number": 1,
        "duration": 3,
        "visual_description": "Dark background with product glowing",
        "voiceover_script": "Introducing Wireless Headphones Pro",
        "music_mood": "Energetic"
      }
    ],
    "key_messages": ["Long battery life", "Premium sound"],
    "color_palette": ["#FF6B6B", "#4ECDC4"]
  },
  "scenes": [
    {
      "id": 1,
      "project_id": 1,
      "scene_number": 1,
      "duration": 3,
      "visual_description": "...",
      "voiceover_script": "...",
      "music_mood": "Energetic",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "assets": [
    {
      "id": 1,
      "project_id": 1,
      "scene_id": 1,
      "asset_type": "graphic",
      "url": "http://localhost:3000/images/project-1-scene-1.png",
      "status": "ready",
      "created_at": "2024-01-15T10:32:00Z"
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/project/1
```

---

#### GET `/project/:projectId/storyboard`
Get just the storyboard for a project

**Response:**
```json
{
  "title": "Immersive Sound Experience",
  "hook": "Experience music like never before",
  "scenes": [...],
  "key_messages": [...],
  "color_palette": [...]
}
```

**Example:**
```bash
curl http://localhost:3000/api/project/1/storyboard
```

---

#### DELETE `/project/:projectId`
Delete a project and all associated data

**Response:**
```json
{
  "message": "Project deleted",
  "projectId": 1
}
```

**Status Codes:**
- `200` - Project deleted successfully
- `404` - Project not found
- `500` - Server error

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/project/1
```

---

## Project Status

### Status Flow
```
processing 
  → generating_storyboard 
    → generating_graphics 
      → assembling_video 
        → completed
        
Or at any point → error
```

### Status Values

| Status | Description | Progress |
|--------|-------------|----------|
| `processing` | Job queued, waiting to start | 0% |
| `generating_storyboard` | Creating video outline with Claude | 25% |
| `generating_graphics` | Creating scene images with AI | 50% |
| `assembling_video` | Combining assets into final video | 75% |
| `completed` | Ready for download | 100% |
| `error` | Failed (check error_message) | 0% |

---

## Error Handling

### Error Response Format
```json
{
  "error": "Error message describing what went wrong",
  "details": "Additional technical details (in development mode)"
}
```

### Common Errors

#### 400 Bad Request
```json
{
  "error": "Product name is required"
}
```

#### 404 Not Found
```json
{
  "error": "Project not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to create ad",
  "details": "Database connection error"
}
```

---

## Rate Limiting

Current rate limiting (to be implemented):
- 10 requests per minute for `/create-ad`
- 100 requests per minute for other endpoints

---

## Examples

### Example 1: Create and Monitor Ad

```bash
#!/bin/bash

# Step 1: Create ad
RESPONSE=$(curl -s -X POST http://localhost:3000/api/create-ad \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Wireless Headphones Pro",
    "features": "30-hour battery, noise cancellation",
    "targetAudience": "Musicians",
    "tone": "professional",
    "duration": 30
  }')

PROJECT_ID=$(echo $RESPONSE | grep -o '"projectId":[0-9]*' | grep -o '[0-9]*')
echo "Created project: $PROJECT_ID"

# Step 2: Monitor progress
for i in {1..30}; do
  STATUS=$(curl -s http://localhost:3000/api/project/$PROJECT_ID | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "[$i/30] Status: $STATUS"
  
  if [ "$STATUS" == "completed" ]; then
    echo "✅ Video ready!"
    curl -s http://localhost:3000/api/project/$PROJECT_ID | grep -o '"video_url":"[^"]*'
    break
  fi
  
  if [ "$STATUS" == "error" ]; then
    echo "❌ Error occurred"
    curl -s http://localhost:3000/api/project/$PROJECT_ID | grep -o '"error_message":"[^"]*'
    break
  fi
  
  sleep 2
done
```

### Example 2: Batch Create Ads

```javascript
const API_URL = 'http://localhost:3000/api';

const products = [
  { productName: 'Coffee Maker', features: 'Quick brew' },
  { productName: 'Wireless Mouse', features: 'Long battery' },
  { productName: 'USB Hub', features: '4 ports' },
];

async function batchCreate() {
  const projects = [];

  for (const product of products) {
    const response = await fetch(`${API_URL}/create-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...product,
        tone: 'professional',
        duration: 15,
      }),
    });

    const data = await response.json();
    projects.push(data.projectId);
    console.log(`Created project ${data.projectId}`);

    // Rate limiting - wait 1 second between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('All projects created:', projects);
  return projects;
}

batchCreate();
```

### Example 3: Download Video

```bash
#!/bin/bash

PROJECT_ID=$1

# Get project details
PROJECT=$(curl -s http://localhost:3000/api/project/$PROJECT_ID)

# Check if completed
STATUS=$(echo $PROJECT | grep -o '"status":"[^"]*' | grep -o '"[^"]*' | tail -1)

if [ "$STATUS" == "completed" ]; then
  VIDEO_URL=$(echo $PROJECT | grep -o '"video_url":"[^"]*' | cut -d'"' -f4)
  echo "Downloading from: $VIDEO_URL"
  curl -o "video-$PROJECT_ID.mp4" "$VIDEO_URL"
  echo "✅ Downloaded to video-$PROJECT_ID.mp4"
else
  echo "Video not ready yet. Status: $STATUS"
fi
```

---

## Webhooks (Future)

Planned webhook support for project completion:

```json
{
  "event": "project.completed",
  "projectId": 1,
  "videoUrl": "http://...",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

---

## Response Times

Typical processing times:

| Stage | Time | Notes |
|-------|------|-------|
| Storyboard | 3-5s | Claude API |
| Graphics (per scene) | 10-20s | Hugging Face API |
| Video Assembly | 5-10s | FFmpeg |
| **Total** | **30-60s** | For 15s video with 3-4 scenes |

---

## Pagination

List endpoints support pagination:

```bash
curl "http://localhost:3000/api/projects?limit=10&offset=20"
```

- `limit`: Items per page (default: 50, max: 100)
- `offset`: Number of items to skip (default: 0)

---

## API Versioning

Current API version: `v1` (implicit)

Future versions will use:
```
/api/v2/projects
```

---

## Support

For API issues:
1. Check `/health` endpoint
2. Review logs: `docker-compose logs -f api`
3. Check TROUBLESHOOTING.md
4. Open GitHub issue
