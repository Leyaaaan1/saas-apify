// src/app/api/clear/route.ts
import { NextResponse } from 'next/server';
import { supabase } from "../../../lib/supabase/Supabase";

export async function DELETE() {
    try {
        console.log('Clearing all posts from database...');

        // Delete all posts from the reddit_posts table
        // First, get all post IDs
        const { data: posts, error: fetchError } = await supabase
            .from('reddit_posts')
            .select('id');

        if (fetchError) {
            throw fetchError;
        }

        if (!posts || posts.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Database is already empty'
            });
        }

        console.log(`Found ${posts.length} posts to delete`);

        // Get all UUIDs
        const ids = posts.map(p => p.id);

        // Delete all records using their UUIDs
        const { error } = await supabase
            .from('reddit_posts')
            .delete()
            .in('id', ids);

        if (error) {
            throw error;
        }

        console.log('✓ Database cleared successfully');

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${posts.length} posts`
        });

    } catch (error) {
        console.error('Clear database error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}