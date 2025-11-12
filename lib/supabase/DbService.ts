import { supabase } from './Supabase';
import { RedditPost, AnalysisResult } from '../types';

export class DbService {

    async insertPost(post: RedditPost): Promise<{ success: boolean; id?: string; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('reddit_posts')
                .insert([{
                    post_id: post.post_id,
                    source: post.source,
                    title: post.title,
                    content: post.content,
                    author: post.author,
                    score: post.score,
                    num_comments: post.num_comments,
                    url: post.url,
                    created_at: post.created_at,
                    scraped_at: new Date().toISOString(),
                    analysis: null
                }])
                .select('id')
                .single();

            if (error) {
                console.error('Error inserting post:', error);
                return { success: false, error: error.message };
            }

            return { success: true, id: data.id };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error('Insert post exception:', errorMsg);
            return { success: false, error: errorMsg };
        }
    }


    async updateAnalysis(postId: string, analysis: AnalysisResult): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('reddit_posts')
                .update({ analysis })
                .eq('post_id', postId);

            if (error) {
                console.error('Error updating analysis:', error);
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error('Update analysis exception:', errorMsg);
            return { success: false, error: errorMsg };
        }
    }


    async getPostsWithoutAnalysis(): Promise<RedditPost[]> {
        try {
            const { data, error } = await supabase
                .from('reddit_posts')
                .select('*')
                .is('analysis', null)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching posts:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Get posts exception:', err);
            return [];
        }
    }


    async postExists(postId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('reddit_posts')
                .select('id')
                .eq('post_id', postId)
                .single();

            return !error && data !== null;
        } catch {
            return false;
        }
    }




    async getAllAnalyzedPosts(): Promise<RedditPost[]> {
        try {
            const { data, error } = await supabase
                .from('reddit_posts')
                .select('*')
                .not('analysis', 'is', null)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching analyzed posts:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Get analyzed posts exception:', err);
            return [];
        }
    }


}

export const dbService = new DbService();