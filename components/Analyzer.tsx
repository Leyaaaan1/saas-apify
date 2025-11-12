// src/components/Analyzer.tsx
import React, { useState } from 'react';
import axios from 'axios';
import {AnalyzeResponse} from "./types";

interface AnalyzerProps {
    onSuccess: () => void;
}

const Analyzer: React.FC<AnalyzerProps> = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AnalyzeResponse | null>(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await axios.post<AnalyzeResponse>('/api/analyze');
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
                    background: '#f3e8ff',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    marginRight: '0.75rem'
                }}>
                    <svg style={{ width: '1.5rem', height: '1.5rem', color: '#9333ea' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                        Analyze with Gemini AI
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Process unanalyzed posts and extract insights
                    </p>
                </div>
            </div>

            <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem'
            }}>
                <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                    This will analyze all posts in the database that don't have analysis yet.
                    The AI will extract sentiment, generate summaries, and identify keywords.
                </p>
            </div>

            <button
                onClick={handleAnalyze}
                disabled={loading}
                style={{
                    width: '100%',
                    background: loading ? '#9ca3af' : '#9333ea',
                    color: 'white',
                    fontWeight: '600',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem'
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#7e22ce')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#9333ea')}
            >
                {loading ? 'Analyzing with Gemini AI...' : 'Analyze Unprocessed Posts'}
            </button>

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
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '1rem',
                        fontSize: '0.875rem'
                    }}>
                        <div>
                            <span style={{ color: '#4b5563' }}>Analyzed:</span>
                            <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>{result.analyzed}</span>
                        </div>
                        <div>
                            <span style={{ color: '#4b5563' }}>Total:</span>
                            <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>{result.total}</span>
                        </div>
                    </div>

                    {result.errors && result.errors.length > 0 && (
                        <div style={{
                            marginTop: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px solid #bbf7d0'
                        }}>
                            <p style={{
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}>
                                Errors ({result.errors.length}):
                            </p>
                            <div style={{
                                maxHeight: '8rem',
                                overflowY: 'auto'
                            }}>
                                {result.errors.slice(0, 5).map((err, idx) => (
                                    <p key={idx} style={{ fontSize: '0.75rem', color: '#4b5563', marginBottom: '0.25rem' }}>
                                        Post {err.post_id}: {err.error}
                                    </p>
                                ))}
                                {result.errors.length > 5 && (
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                                        ...and {result.errors.length - 5} more
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Analyzer;