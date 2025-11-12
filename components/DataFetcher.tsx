import React, { useState } from 'react';
import axios from 'axios';
import {ScrapeResponse} from "./types";

interface DataFetcherProps {
    onSuccess: () => void;
}

const DataFetcher: React.FC<DataFetcherProps> = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScrapeResponse | null>(null);
    const [subreddits, setSubreddits] = useState('socialmedia,marketing,SocialMediaMarketing,digital_marketing,socialmediamanagers');
    const [postsPerSubreddit, setPostsPerSubreddit] = useState(5);
    const [clearBeforeScrape, setClearBeforeScrape] = useState(true);

    const handleClearDatabase = async () => {
        if (!confirm('Are you sure you want to delete all posts from the database? This action cannot be undone.')) {
            return;
        }

        setClearing(true);
        setError(null);

        try {
            const response = await axios.delete('/api/clear');
            if (response.data.success) {
                alert('Database cleared successfully!');
                onSuccess(); // Refresh the UI
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || err.message);
            } else {
                setError('Failed to clear database');
            }
        } finally {
            setClearing(false);
        }
    };

    const handleScrape = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // Clear database first if option is checked
            if (clearBeforeScrape) {
                console.log('Clearing database before scraping...');
                await axios.delete('/api/clear');
                console.log('Database cleared');
            }

            const subredditArray = subreddits.split(',').map(s => s.trim()).filter(s => s);
            const response = await axios.post<ScrapeResponse>('/api/scrape', {
                subreddits: subredditArray,
                postsPerSubreddit: postsPerSubreddit
            });
            setResult(response.data);
            if (response.data.success) {
                onSuccess();
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || err.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            padding: '1.5rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{
                    background: '#dbeafe',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    marginRight: '0.75rem'
                }}>
                    <svg style={{ width: '1.5rem', height: '1.5rem', color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                </div>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                         Scrape Reddit Posts
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Fetch data from Reddit and store in Supabase
                    </p>
                </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.25rem'
                    }}>
                        Subreddits (comma-separated)
                    </label>
                    <input
                        type="text"
                        value={subreddits}
                        onChange={(e) => setSubreddits(e.target.value)}
                        disabled={loading}
                        placeholder="socialmedia,marketing,digitalmarketing"
                        style={{
                            width: '100%',
                            padding: '0.5rem 1rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.25rem'
                    }}>
                        Posts per subreddit
                    </label>
                    <input
                        type="number"
                        value={postsPerSubreddit}
                        onChange={(e) => setPostsPerSubreddit(Number(e.target.value))}
                        disabled={loading}
                        min="1"
                        max="50"
                        style={{
                            width: '100%',
                            padding: '0.5rem 1rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '0.5rem'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#92400e',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="checkbox"
                            checked={clearBeforeScrape}
                            onChange={(e) => setClearBeforeScrape(e.target.checked)}
                            disabled={loading}
                            style={{
                                marginRight: '0.5rem',
                                width: '1rem',
                                height: '1rem',
                                cursor: 'pointer'
                            }}
                        />
                        Clear old data before scraping new subreddits
                    </label>
                    <p style={{
                        fontSize: '0.75rem',
                        color: '#78350f',
                        marginTop: '0.25rem',
                        marginLeft: '1.5rem'
                    }}>
                        Recommended: This will delete all previous posts to show only new results
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                    onClick={handleScrape}
                    disabled={loading || clearing}
                    style={{
                        flex: 1,
                        background: loading ? '#9ca3af' : '#2563eb',
                        color: 'white',
                        fontWeight: '600',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        cursor: loading || clearing ? 'not-allowed' : 'pointer',
                        fontSize: '1rem'
                    }}
                    onMouseEnter={(e) => !loading && !clearing && (e.currentTarget.style.background = '#1d4ed8')}
                    onMouseLeave={(e) => !loading && !clearing && (e.currentTarget.style.background = '#2563eb')}
                >
                    {loading ? 'Scraping... This may take a few minutes' : 'Start Scraping'}
                </button>

                <button
                    onClick={handleClearDatabase}
                    disabled={loading || clearing}
                    style={{
                        background: clearing ? '#9ca3af' : '#dc2626',
                        color: 'white',
                        fontWeight: '600',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        cursor: loading || clearing ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => !loading && !clearing && (e.currentTarget.style.background = '#b91c1c')}
                    onMouseLeave={(e) => !loading && !clearing && (e.currentTarget.style.background = '#dc2626')}
                    title="Clear all posts from database"
                >
                    {clearing ? 'Clearing...' : '🗑️ Clear All'}
                </button>
            </div>

            {error && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '0.5rem'
                }}>
                    <p style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: '500' }}>
                        Error: {error}
                    </p>
                </div>
            )}

            {result && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: result.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: '0.5rem'
                }}>
                    <h3 style={{
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: result.success ? '#166534' : '#991b1b'
                    }}>
                        {result.message}
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '1rem',
                        fontSize: '0.875rem'
                    }}>
                        <div>
                            <span style={{ color: '#4b5563' }}>Scraped:</span>
                            <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>{result.scraped}</span>
                        </div>
                        <div>
                            <span style={{ color: '#4b5563' }}>Stored:</span>
                            <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>{result.stored}</span>
                        </div>
                        <div>
                            <span style={{ color: '#4b5563' }}>Analyzed:</span>
                            <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>{result.analyzed}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataFetcher;