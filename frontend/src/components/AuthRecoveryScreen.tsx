import { useState } from 'react';
import loadingLogoUrl from '../assets/favicon.png';
import { useAuth } from '../context/AuthContext';

export default function AuthRecoveryScreen({ reloadOnRetry = false }: { reloadOnRetry?: boolean }) {
    const { refreshUser, logout } = useAuth();
    const [pending, setPending] = useState(false);
    const [retryError, setRetryError] = useState('');

    const handleTryAgain = async () => {
        if (pending) return;

        setPending(true);
        setRetryError('');
        try {
            await refreshUser();
        } catch {
            setRetryError("We couldn't restore your session. Please try again.");
        } finally {
            if (reloadOnRetry) {
                window.location.reload();
            } else {
                setPending(false);
            }
        }
    };

    return (
        <div className="auth-recovery-screen">
            <div className="auth-recovery-background" aria-hidden="true" />
            <main className="auth-recovery-card" aria-busy={pending}>
                <img src={loadingLogoUrl} alt="LakshyaTrack" className="auth-recovery-logo" />
                <h1>LakshyaTrack</h1>
                <p role="alert">
                    We couldn&apos;t reach LakshyaTrack to restore your session. Check your connection and try again.
                </p>
                {retryError && <p className="auth-recovery-error" role="alert">{retryError}</p>}
                <div className="auth-recovery-actions">
                    <button type="button" onClick={handleTryAgain} disabled={pending}>
                        {pending ? 'Trying again...' : 'Try again'}
                    </button>
                    <button type="button" className="auth-recovery-signout" onClick={() => { void logout(); }} disabled={pending}>
                        Sign out
                    </button>
                </div>
            </main>
            <style>{`
                .auth-recovery-screen {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    overflow: auto;
                    padding: 24px;
                    color: white;
                    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 50%, #6366f1 75%, #818cf8 100%);
                }

                .auth-recovery-background {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    background:
                        radial-gradient(circle at 18% 20%, rgba(167, 139, 250, 0.24), transparent 30%),
                        radial-gradient(circle at 82% 78%, rgba(240, 171, 252, 0.2), transparent 32%);
                }

                .auth-recovery-card {
                    position: relative;
                    width: min(100%, 440px);
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    padding: clamp(24px, 7vw, 40px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 24px;
                    background: rgba(30, 27, 75, 0.55);
                    box-shadow: 0 24px 80px rgba(15, 23, 42, 0.3);
                    text-align: center;
                }

                .auth-recovery-logo {
                    width: 84px;
                    height: 84px;
                    object-fit: contain;
                    border-radius: 20px;
                    filter: drop-shadow(0 8px 24px rgba(15, 23, 42, 0.3));
                }

                .auth-recovery-card h1 {
                    margin: 0;
                    color: white;
                    font-size: clamp(26px, 7vw, 32px);
                    font-weight: 800;
                    letter-spacing: -0.5px;
                    text-shadow: 0 2px 20px rgba(99, 102, 241, 0.5);
                }

                .auth-recovery-card p {
                    margin: 0;
                    color: rgba(255, 255, 255, 0.86);
                    font-size: 16px;
                    line-height: 1.6;
                }

                .auth-recovery-card .auth-recovery-error {
                    color: #fecaca;
                }

                .auth-recovery-actions {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 12px;
                    width: 100%;
                }

                .auth-recovery-actions button {
                    min-height: 44px;
                    flex: 1 1 140px;
                    padding: 10px 18px;
                    border: 1px solid transparent;
                    border-radius: 12px;
                    background: #c084fc;
                    color: #1e1b4b;
                    font: inherit;
                    font-weight: 700;
                    cursor: pointer;
                }

                .auth-recovery-actions button:hover:not(:disabled) {
                    background: #d8b4fe;
                }

                .auth-recovery-actions button:focus-visible {
                    outline: 3px solid white;
                    outline-offset: 3px;
                }

                .auth-recovery-actions button:disabled {
                    cursor: wait;
                    opacity: 0.7;
                }

                .auth-recovery-actions .auth-recovery-signout {
                    border-color: rgba(255, 255, 255, 0.4);
                    background: transparent;
                    color: white;
                }

                .auth-recovery-actions .auth-recovery-signout:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.12);
                }
            `}</style>
        </div>
    );
}
