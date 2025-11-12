import { NextResponse } from 'next/server';
import {RateLimiter} from "../../../lib/utils/ErrorHandler";
import {geminiService} from "../../../lib/services/GemeniService";
import {dbService} from "../../../lib/supabase/DbService";


const rateLimiter = new RateLimiter(0.25);

export async function POST() {
    try {

        // Get posts that don't have analysis yet
        const posts = await dbService.getPostsWithoutAnalysis();

        if (posts.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No posts to analyze',
                analyzed: 0
            });
        }

        console.log(`Found ${posts.length} posts without analysis`);

        let analyzedCount = 0;
        const errors = [];

        for (const post of posts) {
            try {
                // Rate limit API calls
                await rateLimiter.wait();

                console.log(`Analyzing: ${post.title.substring(0, 50)}...`);

                const analysis = await geminiService.analyzeText(post.title, post.content);

                if (analysis) {
                    const result = await dbService.updateAnalysis(post.post_id, analysis);

                    if (result.success) {
                        analyzedCount++;
                        console.log(`✓ Success: ${analysis.sentiment}`);
                    } else {
                        errors.push({ post_id: post.post_id, error: result.error });
                        console.error(`Failed to update: ${result.error}`);
                    }
                } else {
                    errors.push({ post_id: post.post_id, error: 'Analysis returned null' });
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ post_id: post.post_id, error: errorMsg });
                console.error(`Error analyzing post ${post.post_id}:`, errorMsg);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Analyzed ${analyzedCount}/${posts.length} posts`,
            analyzed: analyzedCount,
            total: posts.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Analysis API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}