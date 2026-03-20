import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getAdminUsers, blacklistUser, unblacklistUser, promoteUser, demoteUser, deleteUser, AdminUser } from '../services/admin';
import { useAuth } from '../context/AuthContext';
import { Shield, AlertTriangle, UserX, Crown, Search, Settings, Trash2, X, BarChart, Calendar, Loader2, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const isBlackAdmin = user?.role === 'black_admin';
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce search input to avoid firing on every keystroke
    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(value);
        }, 400);
    }, []);

    const fetchUsers = async (searchQuery: string) => {
        setLoading(true);
        try {
            const data = await getAdminUsers(0, 50, searchQuery);
            setUsers(data.users);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers(debouncedSearch);
    }, [debouncedSearch]);

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, []);

    const handleAction = async (actionFn: (id: string) => Promise<any>, id: string, email: string, actionName: string) => {
        if (!window.confirm(`Are you sure you want to ${actionName} user ${email}?`)) return;

        setActionLoadingId(id);
        try {
            await actionFn(id);

            // Optimistic UI update — mutate local state instead of refetching
            setUsers(prev => {
                if (actionName === 'delete') {
                    return prev.filter(u => u.id !== id);
                }
                return prev.map(u => {
                    if (u.id !== id) return u;
                    switch (actionName) {
                        case 'blacklist':
                            return { ...u, is_blacklisted: true };
                        case 'unblacklist':
                            return { ...u, is_blacklisted: false };
                        case 'promote':
                            return { ...u, role: 'admin' as const };
                        case 'demote':
                            return { ...u, role: 'user' as const };
                        default:
                            return u;
                    }
                });
            });

            // Close modal if the acted-upon user was selected
            if (selectedUser?.id === id) {
                if (actionName === 'delete') {
                    setSelectedUser(null);
                } else {
                    setSelectedUser(prev => {
                        if (!prev || prev.id !== id) return prev;
                        switch (actionName) {
                            case 'blacklist':
                                return { ...prev, is_blacklisted: true };
                            case 'unblacklist':
                                return { ...prev, is_blacklisted: false };
                            case 'promote':
                                return { ...prev, role: 'admin' as const };
                            case 'demote':
                                return { ...prev, role: 'user' as const };
                            default:
                                return prev;
                        }
                    });
                }
            }
        } catch (error: any) {
            alert(error.response?.data?.detail || `Failed to ${actionName}`);
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
<main className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 w-full overflow-hidden">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-purple-500 to-indigo-500">
                                User Management
                            </span>
                        </h1>
                        <p className="text-xl text-gray-400 font-light">
                            {isBlackAdmin ? 'Super admin access granted.' : 'Read-only admin view.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4 w-full md:w-auto">
                        <Link
                            to="/admin/inactivity"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 transition-colors"
                        >
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            <span>Inactivity</span>
                        </Link>
                        <Link
                            to="/admin/subscriptions"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 transition-colors"
                        >
                            <Crown className="w-4 h-4 text-amber-400" />
                            <span>Subscriptions</span>
                        </Link>
                        <Link
                            to="/admin/questions"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800/50 border border-slate-700 hover:bg-slate-700/50 transition-colors"
                        >
                            <BrainCircuit className="w-4 h-4 text-[#8B83FF]" />
                            <span>Questions</span>
                        </Link>
                        {isBlackAdmin && (
                            <Link
                                to="/admin/command-centre"
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-900/40 border border-red-500/50 hover:bg-red-800/50 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                            >
                                <Shield className="w-4 h-4 text-red-400" />
                                <span className="text-red-100 font-medium">Command Centre</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div className="mb-8 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by email..."
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-light tracking-wide backdrop-blur-sm"
                    />
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-800/30 text-xs uppercase tracking-wider text-slate-400">
                                    <th className="p-5 font-semibold">User</th>
                                    <th className="p-5 font-semibold">Role</th>
                                    <th className="p-5 font-semibold">Status</th>
                                    <th className="p-5 font-semibold">Progress</th>
                                    <th className="p-5 font-semibold">Last Active</th>
                                    {isBlackAdmin && <th className="p-5 font-semibold text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            <div className="flex items-center justify-center gap-3">
                                                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                                                Loading users...
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/20 transition-colors cursor-pointer" onClick={() => setSelectedUser(u)}>
                                        <td className="p-5">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-200">{u.full_name}</span>
                                                <span className="text-sm text-slate-500">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="p-5" onClick={(e) => e.stopPropagation()}>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${u.role === 'black_admin' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                                                u.role === 'admin' ? 'bg-purple-900/30 text-purple-400 border-purple-800/50' :
                                                    'bg-slate-800 text-slate-300 border-slate-700'
                                                }`}>
                                                {u.role === 'black_admin' && <Crown className="w-3 h-3" />}
                                                {u.role.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-5" onClick={(e) => e.stopPropagation()}>
                                            {u.is_blacklisted ? (
                                                <span className="inline-flex items-center text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded">
                                                    Blacklisted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <span className="inline-flex items-center text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded whitespace-nowrap">
                                                {u.progress_status || 'No Roadmap'}
                                            </span>
                                        </td>
                                        <td className="p-5 text-sm text-slate-400">
                                            {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}
                                        </td>
                                        {isBlackAdmin && (
                                            <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                                {u.role !== 'black_admin' && (
                                                    <div className="flex justify-end gap-2">
                                                        {actionLoadingId === u.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                                        ) : (
                                                            <>
                                                                {u.role === 'user' ? (
                                                                    <button disabled={!!actionLoadingId} onClick={() => handleAction(promoteUser, u.id, u.email, 'promote')} className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors border border-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed" title="Promote to Admin">
                                                                        <Crown className="w-4 h-4" />
                                                                    </button>
                                                                ) : (
                                                                    <button disabled={!!actionLoadingId} onClick={() => handleAction(demoteUser, u.id, u.email, 'demote')} className="p-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg transition-colors border border-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed" title="Demote to User">
                                                                        <Settings className="w-4 h-4" />
                                                                    </button>
                                                                )}

                                                                {u.is_blacklisted ? (
                                                                    <button disabled={!!actionLoadingId} onClick={() => handleAction(unblacklistUser, u.id, u.email, 'unblacklist')} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition-colors border border-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                                                                        Unblock
                                                                    </button>
                                                                ) : (
                                                                    <button disabled={!!actionLoadingId} onClick={() => handleAction(blacklistUser, u.id, u.email, 'blacklist')} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed" title="Blacklist User">
                                                                        <UserX className="w-4 h-4" />
                                                                    </button>
                                                                )}

                                                                <button disabled={!!actionLoadingId} onClick={() => handleAction(deleteUser, u.id, u.email, 'delete')} className="p-2 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded-lg transition-colors border border-red-800/50 disabled:opacity-40 disabled:cursor-not-allowed" title="Permanently Delete">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in-up">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                            <div>
                                <h3 className="text-xl font-bold text-white">{selectedUser.full_name}</h3>
                                <p className="text-sm text-slate-400">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    <div className="flex items-center gap-2 mb-1 text-slate-400 text-sm">
                                        <Calendar className="w-4 h-4" />
                                        Profile Created
                                    </div>
                                    <p className="font-semibold text-white">
                                        {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    <div className="flex items-center gap-2 mb-1 text-slate-400 text-sm">
                                        <Settings className="w-4 h-4" />
                                        Status
                                    </div>
                                    <p className="font-semibold text-white">
                                        {selectedUser.is_blacklisted ? (
                                            <span className="text-red-400">Blacklisted</span>
                                        ) : selectedUser.last_active_at ? (
                                            <span className="text-emerald-400">Active</span>
                                        ) : (
                                            <span className="text-slate-400">Inactive</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h4 className="flex items-center gap-2 font-medium text-slate-300 mb-3 border-b border-slate-800 pb-2">
                                    <BarChart className="w-4 h-4" />
                                    Progress & Achievements
                                </h4>
                                <ul className="space-y-3">
                                    <li className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg">
                                        <span className="text-slate-400">Roadmap Phase</span>
                                        <span className="font-medium text-blue-400">{selectedUser.progress_status || 'N/A'}</span>
                                    </li>
                                    <li className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg">
                                        <span className="text-slate-400">Career Readiness Score</span>
                                        <span className="font-medium text-emerald-400">
                                            {selectedUser.career_score ? `${Math.round(selectedUser.career_score)}%` : '0%'}
                                        </span>
                                    </li>
                                    <li className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg">
                                        <span className="text-slate-400">Quizzes Passed</span>
                                        <span className="font-medium text-purple-400">{selectedUser.quizzes_passed || 0}</span>
                                    </li>
                                    <li className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg">
                                        <span className="text-slate-400">Interviews Completed</span>
                                        <span className="font-medium text-orange-400">{selectedUser.interviews_done || 0}</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
