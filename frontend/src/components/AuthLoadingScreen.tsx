import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import logoUrl from '../assets/logo.png';

const statusMessages = [
    'Checking your session...',
    'Verifying your identity...',
    'Connecting to your account...',
    'Loading your dashboard...',
    'Almost there...',
];

export default function AuthLoadingScreen() {
    const [messageIndex, setMessageIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    // Cycle through status messages
    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % statusMessages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Animate progress bar
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return 90; // Cap at 90 until actually done
                return prev + Math.random() * 8 + 2;
            });
        }, 400);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="auth-loading-screen">
            {/* Animated background */}
            <div className="auth-loading-bg" />

            {/* Floating orbs */}
            <div className="auth-loading-orb auth-loading-orb-1" />
            <div className="auth-loading-orb auth-loading-orb-2" />
            <div className="auth-loading-orb auth-loading-orb-3" />

            {/* Center content */}
            <div className="auth-loading-content">
                {/* Logo with glow */}
                <div className="auth-loading-logo-wrapper" style={{ width: '134px', height: '134px' }}>
                    <div className="auth-loading-logo-glow" style={{ inset: '-20px' }} />
                    <div className="auth-loading-logo-ring" style={{ inset: '-8px' }}>
                        <div className="auth-loading-logo-ring-spinner" />
                    </div>
                    <div className="auth-loading-logo" style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', backdropFilter: 'none', padding: 0 }}>
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
                    </div>
                </div>

                {/* Brand name */}
                <h1 className="auth-loading-brand">LakshyaTrack</h1>

                {/* Status message with fade */}
                <div className="auth-loading-message-container">
                    <p
                        className="auth-loading-message"
                        key={messageIndex}
                    >
                        {statusMessages[messageIndex]}
                    </p>
                </div>

                {/* Progress bar */}
                <div className="auth-loading-progress-track">
                    <div
                        className="auth-loading-progress-fill"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                    <div className="auth-loading-progress-shimmer" />
                </div>

                {/* Subtle dots animation */}
                <div className="auth-loading-dots">
                    <span className="auth-loading-dot" style={{ animationDelay: '0s' }} />
                    <span className="auth-loading-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="auth-loading-dot" style={{ animationDelay: '0.4s' }} />
                </div>
            </div>

            <style>{`
                .auth-loading-screen {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    z-index: 9999;
                    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
                }

                .auth-loading-bg {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 50%, #6366f1 75%, #818cf8 100%);
                    background-size: 400% 400%;
                    animation: authBgShift 8s ease infinite;
                }

                @keyframes authBgShift {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }

                /* Floating orbs */
                .auth-loading-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    opacity: 0.3;
                    animation: authOrbFloat 6s ease-in-out infinite;
                }

                .auth-loading-orb-1 {
                    width: 300px;
                    height: 300px;
                    background: radial-gradient(circle, #a78bfa, #7c3aed);
                    top: 10%;
                    left: 15%;
                    animation-duration: 7s;
                }

                .auth-loading-orb-2 {
                    width: 250px;
                    height: 250px;
                    background: radial-gradient(circle, #f0abfc, #c026d3);
                    bottom: 15%;
                    right: 10%;
                    animation-duration: 9s;
                    animation-delay: -2s;
                }

                .auth-loading-orb-3 {
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, #67e8f9, #0891b2);
                    top: 50%;
                    left: 60%;
                    animation-duration: 8s;
                    animation-delay: -4s;
                }

                @keyframes authOrbFloat {
                    0%, 100% { transform: translateY(0) translateX(0); }
                    33% { transform: translateY(-30px) translateX(20px); }
                    66% { transform: translateY(20px) translateX(-15px); }
                }

                /* Center content */
                .auth-loading-content {
                    position: relative;
                    z-index: 10;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 24px;
                    animation: authContentFadeIn 0.8s ease-out;
                }

                @keyframes authContentFadeIn {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* Logo */
                .auth-loading-logo-wrapper {
                    position: relative;
                    width: 88px;
                    height: 88px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .auth-loading-logo-glow {
                    position: absolute;
                    inset: -16px;
                    background: radial-gradient(circle, rgba(139, 92, 246, 0.5), transparent 70%);
                    border-radius: 50%;
                    animation: authGlowPulse 2s ease-in-out infinite;
                }

                @keyframes authGlowPulse {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.15); }
                }

                .auth-loading-logo-ring {
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    overflow: hidden;
                }

                .auth-loading-logo-ring-spinner {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    border: 3px solid transparent;
                    border-top-color: rgba(255, 255, 255, 0.8);
                    border-right-color: rgba(167, 139, 250, 0.4);
                    animation: authRingSpin 1.5s linear infinite;
                }

                @keyframes authRingSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .auth-loading-logo {
                    width: 72px;
                    height: 72px;
                    background: rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    animation: authLogoPulse 3s ease-in-out infinite;
                }

                @keyframes authLogoPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }

                /* Brand */
                .auth-loading-brand {
                    font-size: 32px;
                    font-weight: 800;
                    color: white;
                    letter-spacing: -0.5px;
                    text-shadow: 0 2px 20px rgba(99, 102, 241, 0.5);
                    margin: 0;
                }

                /* Message */
                .auth-loading-message-container {
                    height: 24px;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                }

                .auth-loading-message {
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 16px;
                    font-weight: 500;
                    letter-spacing: 0.3px;
                    animation: authMessageFade 2s ease-in-out;
                    margin: 0;
                }

                @keyframes authMessageFade {
                    0% { opacity: 0; transform: translateY(8px); }
                    15% { opacity: 1; transform: translateY(0); }
                    85% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-8px); }
                }

                /* Progress bar */
                .auth-loading-progress-track {
                    width: 240px;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 100px;
                    overflow: hidden;
                    position: relative;
                }

                .auth-loading-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #818cf8, #c084fc, #f0abfc);
                    border-radius: 100px;
                    transition: width 0.4s ease-out;
                    position: relative;
                }

                .auth-loading-progress-shimmer {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        90deg,
                        transparent 0%,
                        rgba(255, 255, 255, 0.3) 50%,
                        transparent 100%
                    );
                    animation: authShimmer 1.5s ease-in-out infinite;
                }

                @keyframes authShimmer {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }

                /* Dots */
                .auth-loading-dots {
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                }

                .auth-loading-dot {
                    width: 6px;
                    height: 6px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 50%;
                    animation: authDotBounce 1.4s ease-in-out infinite;
                }

                @keyframes authDotBounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
