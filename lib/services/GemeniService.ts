import axios from 'axios';
import dotenv from 'dotenv';
import { AnalysisResult } from '../types';

dotenv.config();

export class GeminiService {
    private apiKey: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    private lastCallTime: number = 0;
    private minInterval: number = 2000; // 2 seconds between calls (30 requests per minute)
    private requestCount: number = 0;
    private resetTime: number = Date.now() + 60000; // Reset counter every minute
    private rateLimitExceeded: boolean = false; // Track if rate limit is hit
    private rateLimitRetries: number = 0;
    private maxRateLimitRetries: number = 1; // Only retry once before switching to fallback

    constructor() {
        const key = process.env.gemini_api_key;
        if (!key) {
            throw new Error('Missing gemini_api_key environment variable');
        }
        this.apiKey = key;
        console.log('✓ Gemini AI Service initialized');
        console.log('⏱️  Rate limit: 30 requests per minute (free tier)');
    }

    /**
     * Wait before making API call to respect rate limits
     */
    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();

        // Reset counter every minute
        if (now >= this.resetTime) {
            this.requestCount = 0;
            this.resetTime = now + 60000;
            this.rateLimitRetries = 0; // Reset retry count
            console.log('🔄 Rate limit counter reset');
        }

        // Check if we've hit the per-minute limit
        if (this.requestCount >= 30) {
            const waitTime = this.resetTime - now;
            if (waitTime > 0) {
                console.log(`⏸️  Rate limit reached (30/30). Waiting ${Math.ceil(waitTime / 1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
                this.requestCount = 0;
                this.resetTime = Date.now() + 60000;
            }
        }

        // Ensure minimum time between requests
        const timeSinceLastCall = now - this.lastCallTime;
        if (timeSinceLastCall < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastCallTime = Date.now();
        this.requestCount++;
    }

    /**
     * Analyze text using Gemini AI
     * This is the PRIMARY analysis method - uses actual AI model
     * Automatically switches to keyword fallback if rate limit is exceeded
     */
    async analyzeText(title: string, content: string): Promise<AnalysisResult | null> {
        // If rate limit is already exceeded, use fallback immediately
        if (this.rateLimitExceeded) {
            console.log('⚡ Rate limit active - using keyword-based analysis');
            return this.createFallbackAnalysis(title, content);
        }

        try {
            // Apply rate limiting before API call
            await this.waitForRateLimit();

            const textToAnalyze = `Title: ${title}\n\nContent: ${content || 'No additional content'}`;

            const prompt = `You are an expert AI analyzer. Analyze the following Reddit post and provide a structured JSON response.

Your analysis should include:
1. **Sentiment Analysis**: Determine if the overall tone is positive, neutral, or negative
2. **Summary Generation**: Create a concise 1-2 sentence summary capturing the main point
3. **Keyword Extraction**: Extract 3-5 most relevant and meaningful keywords

Reddit Post:
${textToAnalyze}

Respond with ONLY a valid JSON object in this exact format (no markdown, no explanations):
{
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "your concise summary here",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

            console.log(`🤖 Calling Gemini AI (Request ${this.requestCount}/30)...`);

            const response = await axios.post(
                `${this.baseUrl}/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
                {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 512,
                        responseMimeType: "application/json"
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) {
                console.error('❌ Gemini returned empty response');
                throw new Error('Empty response from Gemini API');
            }

            // Parse the JSON response
            const cleanedText = this.extractJSON(generatedText);
            const analysis = JSON.parse(cleanedText);

            // Validate the response structure
            if (!this.isValidAnalysis(analysis)) {
                console.error('❌ Invalid analysis structure from Gemini:', analysis);
                throw new Error('Invalid analysis structure');
            }

            console.log(`✅ AI MODEL: ${analysis.sentiment.toUpperCase()} | Keywords: ${analysis.keywords.slice(0, 3).join(', ')}`);

            // Reset retry counter on success
            this.rateLimitRetries = 0;

            return analysis;

        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;

                if (status === 429) {
                    console.error('🚫 Rate Limit Exceeded!');
                    this.rateLimitRetries++;

                    // If we've already retried, switch to fallback mode
                    if (this.rateLimitRetries > this.maxRateLimitRetries) {
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('🔄 SWITCHING TO KEYWORD-BASED MODE');
                        console.log('   All remaining posts will use fallback analysis');
                        console.log('   This ensures uninterrupted processing');
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        this.rateLimitExceeded = true;
                        return this.createFallbackAnalysis(title, content);
                    }

                    // First retry: wait and try again
                    console.log('💡 Retrying once with exponential backoff...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    return this.analyzeText(title, content);

                } else if (status === 400) {
                    console.error('❌ Bad Request - Invalid input format');
                } else if (status === 403) {
                    console.error('❌ API Key Invalid or Unauthorized');
                } else {
                    console.error('❌ Gemini API Error:', {
                        status: status,
                        message: error.response?.data?.error?.message || error.message
                    });
                }
            } else if (error instanceof SyntaxError) {
                console.error('❌ JSON Parse Error - Gemini response was not valid JSON');
            } else {
                console.error('❌ Unexpected error:', error);
            }

            // Use fallback for any other errors
            console.warn('⚠️  Using fallback analysis (keyword-based)');
            return this.createFallbackAnalysis(title, content);
        }
    }

    /**
     * Check if currently in fallback mode
     */
    public isInFallbackMode(): boolean {
        return this.rateLimitExceeded;
    }

    /**
     * Reset rate limit state (useful for testing or manual reset)
     */
    public resetRateLimitState(): void {
        this.rateLimitExceeded = false;
        this.rateLimitRetries = 0;
        this.requestCount = 0;
        this.resetTime = Date.now() + 60000;
        console.log('🔄 Rate limit state reset - AI mode re-enabled');
    }

    /**
     * Extract JSON from text that might have markdown or other formatting
     */
    private extractJSON(text: string): string {
        let cleaned = text.trim();

        // Remove markdown code blocks
        cleaned = cleaned.replace(/```json\s*/gi, '');
        cleaned = cleaned.replace(/```\s*/g, '');

        // Find JSON object
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        return cleaned;
    }

    /**
     * Validate that the analysis matches expected structure
     */
    private isValidAnalysis(analysis: any): analysis is AnalysisResult {
        const isValid = (
            typeof analysis === 'object' &&
            analysis !== null &&
            ['positive', 'neutral', 'negative'].includes(analysis.sentiment) &&
            typeof analysis.summary === 'string' &&
            analysis.summary.length > 0 &&
            analysis.summary.length < 500 &&
            Array.isArray(analysis.keywords) &&
            analysis.keywords.length >= 3 &&
            analysis.keywords.length <= 10 &&
            analysis.keywords.every((k: any) => typeof k === 'string' && k.length > 0)
        );

        if (!isValid) {
            console.log('⚠️  Validation Details:', {
                isObject: typeof analysis === 'object' && analysis !== null,
                sentiment: analysis?.sentiment,
                validSentiment: ['positive', 'neutral', 'negative'].includes(analysis?.sentiment),
                hasSummary: typeof analysis?.summary === 'string' && analysis?.summary.length > 0,
                summaryLength: analysis?.summary?.length,
                hasKeywords: Array.isArray(analysis?.keywords),
                keywordCount: analysis?.keywords?.length,
                allStrings: analysis?.keywords?.every((k: any) => typeof k === 'string')
            });
        }

        return isValid;
    }


    private createFallbackAnalysis(title: string, content: string): AnalysisResult {
        console.log('🔧 KEYWORD BASE: Using keyword-based analysis (AI unavailable)');

        const text = `${title} ${content}`.toLowerCase();

        // Sentiment detection
        const positiveWords = ['great', 'amazing', 'excellent', 'love', 'best', 'awesome', 'good', 'happy', 'success', 'win', 'beautiful', 'perfect', 'wonderful'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'sad', 'fail', 'problem', 'issue', 'error', 'broken', 'poor', 'disappointed'];

        let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        const positiveCount = positiveWords.filter(w => text.includes(w)).length;
        const negativeCount = negativeWords.filter(w => text.includes(w)).length;

        if (positiveCount > negativeCount && positiveCount > 0) {
            sentiment = 'positive';
        } else if (negativeCount > positiveCount && negativeCount > 0) {
            sentiment = 'negative';
        }

        // Generate summary
        const summary = title.length > 100
            ? `${title.substring(0, 97)}...`
            : title || 'No title provided';

        // Extract keywords
        const keywords = this.extractSimpleKeywords(title, content);

        return {
            sentiment,
            summary,
            keywords
        };
    }

    /**
     * Simple keyword extraction for fallback
     */
    private extractSimpleKeywords(title: string, content: string): string[] {
        const text = `${title} ${content}`.toLowerCase();

        const stopWords = [
            'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have',
            'been', 'your', 'what', 'about', 'which', 'their', 'would',
            'there', 'could', 'should', 'will', 'into', 'just', 'like'
        ];

        const words = text
            .split(/\s+/)
            .map(word => word.replace(/[^a-z0-9]/g, ''))
            .filter(word => word.length > 4)
            .filter(word => !/^(https?|www)/.test(word))
            .filter(word => !stopWords.includes(word))
            .filter(word => word.length > 0);

        // Get unique words and return top 5
        const uniqueWords = [...new Set(words)];
        return uniqueWords.slice(0, 5);
    }

    /**
     * Get current statistics
     */
    public getStats() {
        return {
            requestCount: this.requestCount,
            maxRequests: 30,
            rateLimitExceeded: this.rateLimitExceeded,
            inFallbackMode: this.rateLimitExceeded,
            timeUntilReset: Math.max(0, this.resetTime - Date.now()),
            currentMode: this.rateLimitExceeded ? 'keyword-fallback' : 'ai-model'
        };
    }
}


export const geminiService = new GeminiService();