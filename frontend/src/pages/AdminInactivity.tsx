import React, { useEffect, useState } from 'react';
import { getAdminInactivity } from '../services/admin';
import { Clock, Filter, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminInactivity: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);

    const fetchInactivity = async () => {
        setLoading(true);
        try {
            const data = await getAdminInactivity(days);
            setUsers(data.inactive_users);
        } catch (error) {
            console.error('Failed to fetch inactivity:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInactivity();
    }, [days]);

    return (
        <div className="min-h-screen bg-black text-white selection:bg-yellow-500/30">
<main className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10">
                <div className="mb-8">
                    <Link to="/admin/users" className="inline-flex items-center text-slate-400 hover:text-white transition-colors mb-6 group">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to User Management
                    </Link>

                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 flex items-center gap-3">
                            <Clock className="w-10 h-10 text-yellow-500" />
                            Inactivity Dashboard
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 font-light max-w-2xl">
                        Monitor users who haven't logged in for a specified period and track engagement.
                    </p>
                </div>

                <div className="flex items-center justify-between mb-8 bg-slate-900/50 p-4 rounded-2xl border border-slate-800 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-500/20 p-2 rounded-lg border border-yellow-500/30">
                            <Filter className="w-5 h-5 text-yellow-400" />
                        </div>
                        <span className="font-medium text-slate-300">Filter Inactive Threshold:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {[7, 14, 30].map(d => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${days === d
                                    ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                                    }`}
                            >
                                {d} Days
                            </button>
                        ))}

                        <div className="relative ml-2">
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={days}
                                onChange={(e) => setDays(parseInt(e.target.value) || 7)}
                                className="w-24 bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                                placeholder="Custom"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">days</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/30 text-xs uppercase tracking-wider text-slate-400">
                                <th className="p-5 font-semibold">User</th>
                                <th className="p-5 font-semibold">Role</th>
                                <th className="p-5 font-semibold">Status</th>
                                <th className="p-5 font-semibold">Last Active</th>
                                <th className="p-5 font-semibold">Registered</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-slate-400">Loading inactivity data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <AlertCircle className="w-12 h-12 text-emerald-500/50" />
                                            <p className="text-lg font-medium text-slate-300">All users are active!</p>
                                            <p className="text-slate-500">No users found inactive for {days}+ days.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="p-5">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-200">{u.full_name}</span>
                                                <span className="text-sm text-slate-500">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${u.role === 'black_admin' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                                                u.role === 'admin' ? 'bg-purple-900/30 text-purple-400 border-purple-800/50' :
                                                    'bg-slate-800 text-slate-300 border-slate-700'
                                                }`}>
                                                {u.role.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            {u.is_blacklisted ? (
                                                <span className="text-xs font-medium text-red-500">Blacklisted</span>
                                            ) : (
                                                <span className="text-xs font-medium text-slate-400">Active</span>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 font-medium">
                                                    {u.last_active_at === 'Never' ? 'Never' : new Date(u.last_active_at).toLocaleDateString()}
                                                </span>
                                                {u.last_active_at !== 'Never' && (
                                                    <span className="text-xs text-orange-400/80">
                                                        {Math.floor((new Date().getTime() - new Date(u.last_active_at).getTime()) / (1000 * 3600 * 24))} days ago
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-sm text-slate-400">
                                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default AdminInactivity;
