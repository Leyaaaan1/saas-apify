import axios from 'axios';
import dotenv from 'dotenv';
import { RedditPost } from '../types';

dotenv.config();

export class RedditScrape {
    private baseUrl = 'https://www.reddit.com';
    private userAgent = process.env.REDDIT_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    private requestDelay = 2000; // 2 seconds between requests to avoid rate limiting

    constructor() {
        console.log('Reddit Scraper initialized (no API key needed!)');
    }


    async scrapeRedditPosts(subreddits: string[], postsPerSubreddit: number = 5): Promise<RedditPost[]> {
        try {

            const allPosts: RedditPost[] = [];

            for (let i = 0; i < subreddits.length; i++) {
                const subreddit = subreddits[i].trim();

                try {

                    // Fetch posts from Reddit's public JSON API
                    const response = await axios.get(
                        `${this.baseUrl}/r/${subreddit}/top.json`,
                        {
                            params: {
                                limit: postsPerSubreddit,
                                t: 'week' // top posts from this week
                            },
                            headers: {
                                'User-Agent': this.userAgent
                            },
                            timeout: 10000 // 10 second timeout
                        }
                    );

                    // Check if subreddit exists and has data
                    if (!response.data?.data?.children) {
                        console.warn(`⚠No data found for r/${subreddit}`);
                        continue;
                    }

                    const children = response.data.data.children;

                    if (children.length === 0) {
                        console.warn(`⚠r/${subreddit} has no posts`);
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
                    console.log(`✓ Scraped ${posts.length} posts from r/${subreddit}`);

                    // Rate limiting: wait before next request (except for last subreddit)
                    if (i < subreddits.length - 1) {
                        console.log(`⏳ Waiting ${this.requestDelay / 1000}s before next request...`);
                        await this.delay(this.requestDelay);
                    }

                } catch (error: any) {
                    if (error.response?.status === 404) {
                        console.error(`Subreddit r/${subreddit} not found`);
                    } else if (error.response?.status === 429) {
                        console.error(`Rate limited by Reddit. Waiting 60s...`);
                        await this.delay(60000); // Wait 1 minute if rate limited
                    } else if (error.code === 'ECONNABORTED') {
                        console.error(`Request timeout for r/${subreddit}`);
                    } else {
                        console.error(`Error scraping r/${subreddit}:`, error.message);
                    }
                    // Continue with next subreddit even if one fails
                    continue;
                }
            }

            return allPosts;

        } catch (error: any) {
            return [];
        }
    }


    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const apifyService = new RedditScrape();