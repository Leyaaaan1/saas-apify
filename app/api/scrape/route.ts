import { NextResponse } from 'next/server';
import {apifyService} from "../../../lib/services/RedditScrape";
import {dbService} from "../../../lib/supabase/DbService";
import {delay, RateLimiter} from "../../../lib/utils/ErrorHandler";
import {geminiService} from "../../../lib/services/GemeniService";


const rateLimiter = new RateLimiter(1); // 1 call per second for Gemini

export async function POST(request: Request) {
  try {
    const { subreddits, postsPerSubreddit } = await request.json();

    const subredditsToScrape = subreddits || [
      'socialmedia',
      'marketing',
      'digitalmarketing',
      'socialmediamarketing',
      'Instagram'
    ];

    const postsLimit = postsPerSubreddit || 5;

    console.log('Starting scrape process...');
    console.log(`Subreddits: ${subredditsToScrape.join(', ')}`);
    console.log(`Posts per subreddit: ${postsLimit}`);

    // Step 1: Scrape Reddit posts using Apify
    const posts = await apifyService.scrapeRedditPosts(subredditsToScrape, postsLimit);

    if (posts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No posts scraped from Apify',
        scraped: 0,
        stored: 0,
        analyzed: 0
      }, { status: 500 });
    }

    console.log(`Scraped ${posts.length} posts from Apify`);

    // Step 2: Store posts in Supabase
    let storedCount = 0;
    const storedPosts = [];

    for (const post of posts) {
      // Check if post already exists
      const exists = await dbService.postExists(post.post_id);

      if (exists) {
        console.log(`Post ${post.post_id} already exists, skipping...`);
        continue;
      }

      const result = await dbService.insertPost(post);

      if (result.success) {
        storedCount++;
        storedPosts.push(post);
        console.log(`Stored post: ${post.title.substring(0, 50)}...`);
      } else {
        console.error(`Failed to store post: ${result.error}`);
      }

      // Small delay between database operations
      await delay(100);
    }

    console.log(`Stored ${storedCount} new posts in database`);

    // Step 3: Analyze posts with Gemini
    let analyzedCount = 0;

    for (const post of storedPosts) {
      try {
        // Rate limit Gemini API calls
        await rateLimiter.wait();

        console.log(`Analyzing post: ${post.title.substring(0, 50)}...`);

        const analysis = await geminiService.analyzeText(post.title, post.content);

        if (analysis) {
          const updateResult = await dbService.updateAnalysis(post.post_id, analysis);

          if (updateResult.success) {
            analyzedCount++;
            console.log(`✓ Analyzed: ${analysis.sentiment} - ${analysis.summary.substring(0, 50)}...`);
          } else {
            console.error(`Failed to update analysis: ${updateResult.error}`);
          }
        } else {
          console.error('Analysis returned null');
        }
      } catch (error) {
        console.error(`Error analyzing post ${post.post_id}:`, error);
      }
    }

    console.log(`Analysis complete: ${analyzedCount}/${storedPosts.length} posts analyzed`);

    return NextResponse.json({
      success: true,
      message: 'Scrape and analysis complete',
      scraped: posts.length,
      stored: storedCount,
      analyzed: analyzedCount
    });

  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}