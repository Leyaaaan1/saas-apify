export interface RedditPost {
    post_id: string;
    source: string;
    title: string;
    content: string;
    author: string;
    score: number;
    num_comments: number;
    url: string;
    created_at: string;
}

export interface ApifyDatasetItem {
    // Not needed anymore but keep for compatibility
    id?: string;
    subreddit?: string;
    title?: string;
    selftext?: string;
    author?: string;
    score?: number;
    numComments?: number;
    url?: string;
    createdAt?: string;
}

export interface AnalysisResult {
    sentiment: 'positive' | 'neutral' | 'negative';
    summary: string;
    keywords: string[];
}