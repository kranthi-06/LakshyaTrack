import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Mail,
    Lock,
    Eye,
    EyeOff,
    CheckCircle2,
    ShieldCheck,
    GraduationCap,
    ArrowRight,
    Sparkles
} from 'lucide-react';

// Simple Google Icon Component
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState(''); // Kept for backend compatibility if needed

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { register, signInWithGoogle, resendOtp } = useAuth();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const navigate = useNavigate();

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            showToast('Passwords do not match', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // Construct full name
            const fullName = `${firstName} ${lastName}`.trim();

            // If username is optional in UI but required by backend, generator or use email prefix
            const finalUsername = username || email.split('@')[0];

            const response = await register({
                email,
                password,
                full_name: fullName,
                username: finalUsername
            });

            // OTP is sent by the signup endpoint automatically
            if (response.warning) {
                showToast(response.message || 'Account created. Check server logs for OTP.', 'info');
                // Give them more time to read it
            } else {
                showToast('Account created & OTP sent! Please verify your email.', 'success');
            }

            // Navigate to verify page with email in state
            setTimeout(() => navigate('/verify-email', { state: { email } }), 1500);
        } catch (err: any) {
            console.error('Registration Error:', err);
            let errorMsg = 'Registration failed. Please try again.';

            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                if (typeof detail === 'string') {
                    errorMsg = detail;
                } else if (Array.isArray(detail)) {
                    errorMsg = detail.map((e: any) => e.msg).join(', ');
                } else {
                    errorMsg = JSON.stringify(detail);
                }
            } else if (err.response?.data) {
                // Catch-all for other JSON errors
                errorMsg = `Server Error: ${JSON.stringify(err.response.data)}`;
            } else if (err.message) {
                errorMsg = err.message;
            }

            setError(errorMsg);
            showToast(errorMsg, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-sans">

            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className={`fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl text-white z-[100] font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500' :
                            toast.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
                            }`}
                    >
                        {toast.type === 'success' && <CheckCircle2 size={18} />}
                        {toast.type === 'error' && <ShieldCheck size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-6xl bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col md:flex-row min-h-[750px]"
            >

                {/* LEFT SIDE - BRANDING */}
                <div className="md:w-5/12 lg:w-1/2 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] p-12 text-white flex flex-col justify-between relative overflow-hidden order-last md:order-first">
                    {/* Background decorations */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
                        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
                        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-900 rounded-full mix-blend-overlay filter blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <Link to="/" className="flex items-center gap-3 mb-2 w-fit hover:opacity-80 transition-opacity">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white">
                                <GraduationCap size={24} />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">Vidorya</span>
                        </Link>
                    </div>

                    <div className="relative z-10 space-y-8 my-10">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-sm font-semibold mb-6 text-yellow-300">
                                <Sparkles size={14} />
                                <span>Join 15,000+ Professionals</span>
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
                                Start Your Journey to Success Today 🚀
                            </h1>
                            <p className="text-indigo-100 text-lg leading-relaxed opacity-90">
                                Create your account to unlock AI-powered career tools, personalized learning paths, and mock interviews.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { title: "Smart Resume Builder", desc: "Create ATS-friendly resumes in minutes" },
                                { title: "Career Roadmap", desc: "Step-by-step guide to your dream job" },
                                { title: "Skill Analytics", desc: "Track your progress relative to industry standards" }
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                                    <div className="mt-1 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-base">{item.title}</h3>
                                        <p className="text-indigo-100 text-sm">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* RIGHT SIDE - FORM */}
                <div className="md:w-7/12 lg:w-1/2 bg-white p-8 md:p-12 flex flex-col justify-center overflow-y-auto max-h-[90vh] md:max-h-auto">
                    <div className="max-w-md mx-auto w-full space-y-6">

                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-bold text-slate-900">Create Account</h2>
                            <p className="text-slate-500">Enter your details to get started</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="text-sm font-semibold text-slate-700">First Name</Label>
                                    <Input
                                        id="firstName"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="py-6 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                                        placeholder="John"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="text-sm font-semibold text-slate-700">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="py-6 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <Input
                                        type="email"
                                        id="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-11 py-6 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" title="Password" className="text-sm font-semibold text-slate-700">Password</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-11 pr-11 py-6 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                                        placeholder="Create a password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" title="Confirm Password" className="text-sm font-semibold text-slate-700">Confirm Password</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <Input
                                        type={showConfirmPassword ? "text" : "password"}
                                        id="confirmPassword"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-11 pr-11 py-6 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                                        placeholder="Confirm your password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 font-medium bg-red-50 p-3 rounded-lg flex items-center gap-2">
                                    <ShieldCheck size={16} /> {error}
                                </p>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all mt-4 group"
                            >
                                {isLoading ? "Creating Account..." : (
                                    <span className="flex items-center justify-center gap-2">
                                        Create Account <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                )}
                            </Button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-200"></span>
                                </div>
                                <div className="relative flex justify-center text-sm uppercase">
                                    <span className="bg-white px-4 text-slate-500 font-medium">Or continue with</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        await signInWithGoogle();
                                    } catch (err) {
                                        showToast('Google sign-in failed', 'error');
                                    }
                                }}
                                className="w-full py-6 rounded-xl border-2 border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-center gap-3 text-slate-700 font-bold text-lg"
                            >
                                <GoogleIcon />
                                <span>Sign up with Google</span>
                            </Button>
                        </form>

                        <div className="text-center space-y-6">
                            <p className="text-slate-600">
                                Already have an account?{' '}
                                <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
                                    Sign in instead
                                </Link>
                            </p>


                        </div>

                    </div>
                </div>

            </motion.div>
        </div>
    );
}
