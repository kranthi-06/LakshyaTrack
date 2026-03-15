import React from 'react';

/**
 * Global Error Boundary — catches any unhandled React rendering errors
 * and prevents the entire application from crashing.
 *
 * Shows a user-friendly fallback UI with a retry button.
 */

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    moduleName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorCount: number;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorCount: 0,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        const { onError, moduleName } = this.props;

        console.error(
            `[ErrorBoundary${moduleName ? `:${moduleName}` : ''}] Caught error:`,
            error,
            errorInfo,
        );

        this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));

        if (onError) {
            try {
                onError(error, errorInfo);
            } catch {
                // Never let the error handler itself crash
            }
        }
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { moduleName } = this.props;
            const { error, errorCount } = this.state;
            const showReload = errorCount > 2;

            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '200px',
                        padding: '2rem',
                        textAlign: 'center',
                        background: 'rgba(239, 68, 68, 0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        margin: '1rem',
                    }}
                >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                    <h3 style={{ margin: '0 0 0.5rem', color: '#ef4444', fontWeight: 600 }}>
                        {moduleName ? `${moduleName} encountered an error` : 'Something went wrong'}
                    </h3>
                    <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.9rem', maxWidth: '400px' }}>
                        {showReload
                            ? 'This error keeps occurring. Try reloading the entire page.'
                            : 'Don\'t worry — the rest of the app is still working. Click retry to try again.'}
                    </p>
                    {error && (
                        <p style={{ margin: '0 0 1rem', color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                            {error.message?.slice(0, 200)}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={this.handleRetry}
                            style={{
                                padding: '0.5rem 1.5rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#3b82f6',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '0.9rem',
                            }}
                        >
                            Retry
                        </button>
                        {showReload && (
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '0.5rem 1.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    background: 'transparent',
                                    color: '#374151',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontSize: '0.9rem',
                                }}
                            >
                                Reload Page
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
