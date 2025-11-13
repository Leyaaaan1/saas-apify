import dotenv from 'dotenv';
import { RedditPost } from '../types';

dotenv.config();

export class RedditScrape {
    private baseUrl = 'https://old.reddit.com';
    private userAgent = process.env.REDDIT_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    private requestDelay = 2000;

    constructor() {
        console.log('✓ Reddit Scraper initialized (using fetch API)');
    }

    async scrapeRedditPosts(subreddits: string[], postsPerSubreddit: number = 5): Promise<RedditPost[]> {
        try {
            const allPosts: RedditPost[] = [];

            for (let i = 0; i < subreddits.length; i++) {
                const subreddit = subreddits[i].trim();

                try {
                    console.log(`🔍 Fetching r/${subreddit}...`);

                    const url = new URL(`${this.baseUrl}/r/${subreddit}/top.json`);
                    url.searchParams.append('limit', postsPerSubreddit.toString());
                    url.searchParams.append('t', 'week');

                    // Use fetch with AbortController for timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

                    const response = await fetch(url.toString(), {
                        method: 'GET',
                        headers: {
                            'User-Agent': this.userAgent,
                            'Accept': 'application/json',
                        },
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    // Handle HTTP errors
                    if (!response.ok) {
                        if (response.status === 404) {
                            console.error(`❌ Subreddit r/${subreddit} not found (404)`);
                        } else if (response.status === 429) {
                            console.error(`⚠️ Rate limited by Reddit (429). Waiting 60s...`);
                            await this.delay(60000);
                            // Retry this subreddit
                            i--;
                        } else if (response.status === 403) {
                            console.error(`❌ Access forbidden to r/${subreddit} (403)`);
                        } else {
                            console.error(`❌ HTTP ${response.status} for r/${subreddit}`);
                        }
                        continue;
                    }

                    const data = await response.json();

                    // Validate response structure
                    if (!data?.data?.children) {
                        console.warn(`⚠️ No data found for r/${subreddit}`);
                        continue;
                    }

                    const children = data.data.children;

                    if (children.length === 0) {
                        console.warn(`⚠️ r/${subreddit} has no posts`);
                        continue;
                    }

                    // Map Reddit data to our format
                    const posts = children.map((child: any) => {
                        const post = child.data;
                        return {
                            post_id: `reddit_${post.id}`,
                            source: subreddit,
                            title: post.title || '',
                            content: post.selftext || '',
                            author: post.author || 'unknown',
                            score: post.score || 0,
                            num_comments: post.num_comments || 0,
                            url: post.url || `https://reddit.com${post.permalink}`,
                            created_at: new Date(post.created_utc * 1000).toISOString(),
                        };
                    });

                    allPosts.push(...posts);
                    console.log(`✅ Scraped ${posts.length} posts from r/${subreddit}`);

                    // Delay between requests to avoid rate limiting
                    if (i < subreddits.length - 1) {
                        console.log(`⏳ Waiting ${this.requestDelay / 1000}s before next request...`);
                        await this.delay(this.requestDelay);
                    }

                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        console.error(`⏱️ Request timeout for r/${subreddit}`);
                    } else if (error instanceof TypeError && error.message.includes('fetch')) {
                        console.error(`🌐 Network error fetching r/${subreddit}:`, error.message);
                    } else {
                        console.error(`❌ Error scraping r/${subreddit}:`, error.message || error);
                    }
                    // Continue with next subreddit
                    continue;
                }
            }

            console.log(`📊 Total posts scraped: ${allPosts.length}`);
            return allPosts;

        } catch (error: any) {
            console.error('💥 Fatal error in scrapeRedditPosts:', error);
            return [];
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const apifyService = new RedditScrape();