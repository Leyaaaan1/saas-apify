import { NextResponse } from 'next/server';
import {supabase} from "../../../lib/supabase/Supabase";

export async function GET() {
    try {
        // Get total analyzed records
        const { count: analyzedCount, error: analyzedError } = await supabase
            .from('reddit_posts')
            .select('*', { count: 'exact', head: true })
            .not('analysis', 'is', null);

        if (analyzedError) {
            throw analyzedError;
        }

        // Get total records
        const { count: totalCount, error: totalError } = await supabase
            .from('reddit_posts')
            .select('*', { count: 'exact', head: true });

        if (totalError) {
            throw totalError;
        }

        // Get last analyzed post
        const { data: lastAnalyzed, error: lastError } = await supabase
            .from('reddit_posts')
            .select('created_at, scraped_at, analysis')
            .not('analysis', 'is', null)
            .order('scraped_at', { ascending: false })
            .limit(1);

        if (lastError) {
            throw lastError;
        }

        const lastAnalysisTime = lastAnalyzed && lastAnalyzed.length > 0
            ? lastAnalyzed[0].scraped_at
            : null;

        return NextResponse.json({
            status: 'healthy',
            database: 'connected',
            statistics: {
                totalRecords: totalCount || 0,
                analyzedRecords: analyzedCount || 0,
                pendingAnalysis: (totalCount || 0) - (analyzedCount || 0),
                lastAnalysisTimestamp: lastAnalysisTime
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Health check error:', error);

        return NextResponse.json({
            status: 'unhealthy',
            database: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}