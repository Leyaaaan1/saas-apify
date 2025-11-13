import dotenv from 'dotenv';
import { RedditPost } from '../types';

dotenv.config();

export class RedditScrape {
    private baseUrl = 'https://www.reddit.com';
    private requestDelay = 2000;

    constructor() {
        console.log('✓ Reddit Scraper initialized (RSS method)');
    }

    async scrapeRedditPosts(subreddits: string[], postsPerSubreddit: number = 5): Promise<RedditPost[]> {
        try {
            const allPosts: RedditPost[] = [];

            for (let i = 0; i < subreddits.length; i++) {
                const subreddit = subreddits[i].trim();

                try {
                    console.log(`🔍 Fetching r/${subreddit}...`);

                    // Use RSS feed instead of JSON API
                    const url = `${this.baseUrl}/r/${subreddit}/top.rss?t=week&limit=${postsPerSubreddit}`;

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/rss+xml, application/xml, text/xml',
                        },
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        if (response.status === 404) {
                            console.error(`❌ Subreddit r/${subreddit} not found (404)`);
                        } else if (response.status === 429) {
                            console.error(`⚠️ Rate limited (429). Waiting 60s...`);
                            await this.delay(60000);
                            i--;
                        } else if (response.status === 403) {
                            console.error(`❌ Access forbidden to r/${subreddit} (403)`);
                        } else {
                            console.error(`❌ HTTP ${response.status} for r/${subreddit}`);
                        }
                        continue;
                    }

                    const xmlText = await response.text();
                    const posts = this.parseRSS(xmlText, subreddit);

                    allPosts.push(...posts.slice(0, postsPerSubreddit));
                    console.log(`✅ Scraped ${posts.length} posts from r/${subreddit}`);

                    if (i < subreddits.length - 1) {
                        console.log(`⏳ Waiting ${this.requestDelay / 1000}s before next request...`);
                        await this.delay(this.requestDelay);
                    }

                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        console.error(`⏱️ Request timeout for r/${subreddit}`);
                    } else {
                        console.error(`❌ Error scraping r/${subreddit}:`, error.message || error);
                    }
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

    private parseRSS(xmlText: string, subreddit: string): RedditPost[] {
        const posts: RedditPost[] = [];

        // Simple XML parsing (you can use a library like 'fast-xml-parser' for better parsing)
        const items = xmlText.split('<entry>').slice(1);

        for (const item of items) {
            try {
                // Extract data using regex
                const titleMatch = item.match(/<title>(.*?)<\/title>/);
                const linkMatch = item.match(/<link href="(.*?)"/);
                const contentMatch = item.match(/<content type="html">(.*?)<\/content>/s);
                const authorMatch = item.match(/<name>(.*?)<\/name>/);
                const updatedMatch = item.match(/<updated>(.*?)<\/updated>/);
                const idMatch = item.match(/<id>t3_(.*?)<\/id>/);

                if (!titleMatch || !linkMatch) continue;

                const title = this.decodeHTML(titleMatch[1]);
                const url = linkMatch[1];
                const rawContent = contentMatch ? contentMatch[1] : '';

                // Clean HTML content
                const content = this.stripHTML(this.decodeHTML(rawContent));
                const author = authorMatch ? authorMatch[1].replace('/u/', '') : 'unknown';
                const created_at = updatedMatch ? new Date(updatedMatch[1]).toISOString() : new Date().toISOString();
                const post_id = idMatch ? `reddit_${idMatch[1]}` : `reddit_${Date.now()}_${Math.random()}`;

                posts.push({
                    post_id,
                    source: subreddit,
                    title,
                    content: content.substring(0, 1000), // Limit content length
                    author,
                    score: 0, // RSS doesn't include score
                    num_comments: 0, // RSS doesn't include comment count
                    url,
                    created_at,
                });
            } catch (error) {
                console.warn('Failed to parse RSS item:', error);
                continue;
            }
        }

        return posts;
    }

    private decodeHTML(html: string): string {
        return html
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'");
    }

    private stripHTML(html: string): string {
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const apifyService = new RedditScrape();