import { NextResponse } from 'next/server';
import {dbService} from "../../../lib/supabase/DbService";

export async function GET() {
    try {
        const posts = await dbService.getAllAnalyzedPosts();

        return NextResponse.json(posts);
    } catch (error) {
        console.error('Posts API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}