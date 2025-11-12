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

    constructor() {
        const key = process.env.gemini_api_key;
        if (!key) {
            throw new Error('Missing gemini_api_key environment variable');
        }
        this.apiKey = key;
        console.log('✓ Gemini AI Service initialized');
        console.log('⏱️  Rate limit: 30 requests per minute (free tier)');
    }


    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();

        // Reset counter every minute
        if (now >= this.resetTime) {
            this.requestCount = 0;
            this.resetTime = now + 60000;
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


    async analyzeText(title: string, content: string, retryCount: number = 0): Promise<AnalysisResult | null> {
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

            console.log(` AI MODEL: Calling Gemini AI (Request ${this.requestCount}/30)...`);

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
                console.error(' Gemini returned empty response');
                throw new Error('Empty response from Gemini API');
            }

            // Parse the JSON response
            const cleanedText = this.extractJSON(generatedText);
            const analysis = JSON.parse(cleanedText);

            // Validate the response structure
            if (!this.isValidAnalysis(analysis)) {
                console.error(' Invalid analysis structure from Gemini:', analysis);
                throw new Error('Invalid analysis structure');
            }

            console.log(` AI MODEL: ${analysis.sentiment.toUpperCase()} | Keywords: ${analysis.keywords.slice(0, 3).join(', ')}`);

            return analysis;

        } catch (error) {
            if (axios.isAxiosError(error)) {
                const status = error.response?.status;

                if (status === 429) {
                    // Rate limit hit - calculate wait time and retry
                    const retryAfter = error.response?.headers['retry-after'];
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default to 60 seconds

                    console.log(` Waiting ${Math.ceil(waitTime / 1000)} seconds before retry...`);


                    // Wait for the specified time
                    await new Promise(resolve => setTimeout(resolve, waitTime));

                    // Reset counters after waiting
                    this.requestCount = 0;
                    this.resetTime = Date.now() + 60000;

                    console.log(' Retrying API call...');
                    return this.analyzeText(title, content, retryCount + 1);

                } else if (status === 400) {
                    console.error(' Bad Request - Invalid input format');
                    throw new Error('Bad Request: Invalid input format');
                } else if (status === 403) {
                    console.error(' API Key Invalid or Unauthorized');
                    throw new Error('API Key Invalid or Unauthorized');
                } else {
                    console.error(' Gemini API Error:', {
                        status: status,
                        message: error.response?.data?.error?.message || error.message
                    });
                    throw error;
                }
            } else if (error instanceof SyntaxError) {
                console.error(' JSON Parse Error - Gemini response was not valid JSON');
                throw new Error('JSON Parse Error');
            } else {
                console.error(' Unexpected error:', error);
                throw error;
            }
        }
    }


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


}

export const geminiService = new GeminiService();