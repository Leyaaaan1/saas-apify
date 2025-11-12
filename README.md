# Reddit  Analytics Platform

A SaaS application that scrapes Reddit data, analyzes it using AI, and presents insights through a clean web interface.

##  Live Demo
- **Application**:
- **GitHub Repository**:

##  Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI Analysis**: Google Gemini AI (Free Tier)
- **Data Source**: Reddit Public JSON API
- **Hosting**: Vercel

##  Architecture Overview

### Data Flow
```
Reddit API → RedditScrape Service → Supabase Storage → Gemini AI Analysis → Database Update → UI Display
```

### Key Components
1. **RedditScrape.ts**: Fetches posts from Reddit's public API (no authentication needed)
2. **GeminiService.ts**: Analyzes text using Google Gemini AI with rate limiting
3. **DbService.ts**: Handles all database operations with Supabase
4. **API Routes**: RESTful endpoints for scraping, analysis, and data retrieval

##  Database Schema

### Table: `reddit_posts`
```sql
- id (uuid, primary key)
- post_id (text, unique) - Format: "reddit_{id}"
- source (text) - Subreddit name
- title (text) - Post title
- content (text) - Post body/selftext
- author (text) - Reddit username
- score (integer) - Upvote count
- num_comments (integer) - Comment count
- url (text) - Post URL
- created_at (timestamp) - Post creation time
- scraped_at (timestamp) - When we scraped it
- analysis (jsonb) - AI analysis result
  {
    sentiment: 'positive' | 'neutral' | 'negative',
    summary: string,
    keywords: string[]
  }
```

**Schema Reasoning:**
- **Single table design** for simplicity and faster queries
- **JSONB for analysis** allows flexible schema evolution without migrations.
- **Indexed post_id** prevents duplicate scraping.
- **Timestamps** enable time-based queries and analytics.
- **Trade-off**: Chose denormalization over normalization for read performance.

##  Workflow Explanation

### End-to-End Flow

1. **Data Collection** (`/api/scrape` POST)
    - Accept subreddit list and post count from request
    - Use Reddit's public JSON API to fetch top weekly posts
    - Apply 2-second rate limiting between requests
    - Handle 404s (invalid subreddits) and 429s (rate limits) gracefully

2. **Storage** (`DbService.insertPost`)
    - Check if post already exists using `post_id`
    - Insert only new posts to avoid duplicates
    - Return success/failure status for each operation

3. **AI Analysis** (`GeminiService.analyzeText`)
    - Rate limit: 30 requests/minute (free tier)
    - Send structured prompt requesting JSON response
    - Parse and validate AI response structure
    - Automatically retry on 429 rate limit errors

4. **Database Update** (`DbService.updateAnalysis`)
    - Store JSONB analysis result in the same record
    - Maintain referential integrity with post_id

5. **UI Display** (`/api/posts` GET)
    - Fetch all analyzed posts ordered by recency
    - Frontend maps and displays results

##  Scaling Considerations

### Current Bottlenecks (100K records/day)
1. **Sequential Processing**: Currently processes one post at a time
2. **API Rate Limits**:
    - Gemini: 30 req/min (free tier) = 43,200/day max
    - Reddit: ~60 req/min per IP

3. **Database Writes**: Supabase handles 500+ writes/sec (not a bottleneck)

### Scaling Solutions

**Immediate Changes:**
```typescript
// 1. Batch Processing with Worker Queues
- Implement Bull/BullMQ with Redis
- Process 10 posts concurrently
- Separate workers for scraping vs analysis

// 2. Upgrade API Tier
- Gemini Pro: 1000 req/min ($$$)
- Or distribute across multiple free accounts

// 3. Caching Layer
- Redis cache for duplicate detection
- Reduce Supabase read operations
```

**Architecture Evolution:**
```
Current: Next.js API → Direct Processing
Scaled:  Next.js API → Queue → Workers → Database
                      ↓
                    Redis Cache
```

## 🛡️ Failure Handling

### Strategy: Graceful Degradation + Retry Logic

**1. API Failures**
```typescript
// Gemini Rate Limits (429)
- Auto-retry with exponential backoff
- Wait for retry-after header duration
- Reset internal rate counter

// Reddit Failures
- 404: Log and skip invalid subreddit
- 429: Wait 60 seconds before retry
- Timeout: Skip and continue with next
```

**2. Malformed Responses**
```typescript
// Validation Layer
- Extract JSON from markdown wrappers
- Validate against TypeScript interface
- Reject invalid structures (return null)
- Never crash, always log
```

**3. Database Errors**
```typescript
// Transaction Safety
- Return {success, error} objects
- Caller decides whether to retry
```

**Why This Approach:**
- **User Experience**: Operations continue even if some fail
- **Cost Efficiency**: No wasted API calls on already-processed data
- **Production Ready**: Handles real-world API instability

### Future Enhancements
- Dead letter queue for repeated failures
- Webhook alerts on critical errors (Slack/Email)
- Automatic fallback to backup AI model
- tools for logging

##  System Health Monitoring

### Health Check Endpoint (`/api/health`)

**Metrics Provided:**
```json
{
  "status": "healthy",
  "database": "connected",
  "statistics": {
    "totalRecords": 150,
    "analyzedRecords": 145,
    "pendingAnalysis": 5,
    "lastAnalysisTimestamp": "2025-01-15T10:30:00Z"
  }
}
```


## 🚦 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scrape` | Scrape & analyze Reddit posts |
| GET | `/api/posts` | Retrieve all analyzed posts |
| GET | `/api/health` | System health check |
| POST | `/api/analyze` | Analyze unprocessed posts |
| DELETE | `/api/clear` | Clear all database records |

## 🔧 Setup Instructions

```bash
# 1. Clone repository
git clone [your-repo]
cd [project-name]

# 2. Install dependencies
npm install

# 3. Environment variables (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
gemini_api_key=your_gemini_key

# 4. Run development server
npm run dev

# 5. Trigger initial scrape
POST http://localhost:3000/api/scrape
{
  "subreddits": ["socialmedia", "marketing"],
  "postsPerSubreddit": 5
}
```

## 📸 Database Screenshots


## 💡 Key Decisions
**Zero Cost**
**Why Gemini instead of OpenAI?**
- Free tier: 30 req/min vs OpenAI's paid requirement
- JSON mode built-in for structured outputs
- Sufficient quality for sentiment analysis

**Why Reddit Public API?**

- No authentication required
- No Apify costs
- Real-time data access
- 60 req/min rate limit adequate for testing

**Why JSONB for analysis?**
- Schema flexibility for future analysis types
- Single query retrieval (no joins)
- Native PostgreSQL indexing support

---

