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
                    className="m-4 flex min-h-52 flex-col items-center justify-center rounded-2xl border border-rose-200/80 bg-rose-50/70 p-8 text-center shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="mb-2 text-3xl" aria-hidden="true">⚠️</div>
                    <h3 className="mb-2 text-lg font-semibold text-rose-700 dark:text-rose-300">
                        {moduleName ? `${moduleName} encountered an error` : 'Something went wrong'}
                    </h3>
                    <p className="mb-4 max-w-md text-sm text-slate-600 dark:text-slate-300">
                        {showReload
                            ? 'This error keeps occurring. Try reloading the entire page.'
                            : 'Don\'t worry — the rest of the app is still working. Click retry to try again.'}
                    </p>
                    {error && (
                        <p className="mb-4 max-w-md break-words font-mono text-xs text-slate-500 dark:text-slate-400">
                            {error.message?.slice(0, 200)}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            onClick={this.handleRetry}
                            className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                        >
                            Retry
                        </button>
                        {showReload && (
                            <button
                                onClick={this.handleReload}
                                className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
