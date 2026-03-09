import React, { useEffect, useState } from 'react';
import { getAdminCommandCentre, AdminUser } from '../services/admin';
import { Shield, Users, Activity, UserMinus, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminCommandCentre: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCommandCentre = async () => {
            try {
                const data = await getAdminCommandCentre();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch command centre:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCommandCentre();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-red-500/30">
<main className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10">
                <div className="mb-8">
                    <Link to="/admin/users" className="inline-flex items-center text-slate-400 hover:text-white transition-colors mb-6 group">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to User Management
                    </Link>

                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 flex items-center gap-3">
                            <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
                            Command Centre
                        </span>
                    </h1>
                    <p className="text-xl text-gray-400 font-light max-w-2xl">
                        Super Administrator Overview. Access highly sensitive platform metrics and audit logs.
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm group hover:border-blue-500/50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl">
                                <Users className="w-6 h-6 text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Total Users</span>
                        </div>
                        <h3 className="text-4xl font-bold font-mono text-white group-hover:text-blue-400 transition-colors">
                            {stats?.total_users || 0}
                        </h3>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm group hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-emerald-500/20 p-3 rounded-xl">
                                <Activity className="w-6 h-6 text-emerald-400" />
                            </div>
                            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active (7d)</span>
                        </div>
                        <h3 className="text-4xl font-bold font-mono text-white group-hover:text-emerald-400 transition-colors">
                            {stats?.active_users_7d || 0}
                        </h3>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-red-900/30 backdrop-blur-sm group hover:border-red-500/50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-red-500/20 p-3 rounded-xl">
                                <UserMinus className="w-6 h-6 text-red-400 group-hover:animate-pulse" />
                            </div>
                            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Blacklisted</span>
                        </div>
                        <h3 className="text-4xl font-bold font-mono text-white group-hover:text-red-400 transition-colors">
                            {stats?.blacklisted_users || 0}
                        </h3>
                    </div>

                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-purple-900/50 backdrop-blur-sm group hover:border-purple-500/50 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-purple-500/20 p-3 rounded-xl border border-purple-500/30">
                                <Shield className="w-6 h-6 text-purple-400" />
                            </div>
                            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Admins</span>
                        </div>
                        <h3 className="text-4xl font-bold font-mono text-white group-hover:text-purple-400 transition-colors">
                            {stats?.admin_count || 0}
                        </h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Registrations Log */}
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-200">Recent Registrations</h2>
                        </div>
                        <div className="p-6">
                            <ul className="space-y-4">
                                {stats?.recent_registrations?.map((u: any, i: number) => (
                                    <li key={i} className="flex justify-between items-center bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                                        <div>
                                            <p className="font-medium text-slate-200">{u.email}</p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(u.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <span className="text-xs font-medium px-2 py-1 bg-slate-800 rounded text-slate-400 border border-slate-700 uppercase">
                                            {u.role}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Blacklist Audit Log */}
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-red-900/20 rounded-3xl overflow-hidden shadow-2xl relative">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0"></div>
                        <div className="p-6 border-b border-slate-800 bg-red-900/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-red-200 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-red-500" />
                                Blacklist Audit Log
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                                {stats?.blacklist_records?.length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">No blacklist records found.</p>
                                ) : (
                                    <ul className="space-y-3">
                                        {stats?.blacklist_records?.map((record: any, i: number) => (
                                            <li key={i} className="bg-black/40 border border-red-900/30 p-4 rounded-xl hover:border-red-500/30 transition-colors">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-medium text-red-200 truncate pr-4">{record.email}</span>
                                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                                        {new Date(record.blacklisted_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 italic">
                                                    Reason: "{record.reason}"
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 1); }
            `}</style>
        </div>
    );
};

export default AdminCommandCentre;
