export default function RouteSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#050510] px-4 sm:px-6 py-8">
            <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
                <div className="h-10 w-56 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, index) => (
                        <div key={index} className="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800" />
                    ))}
                </div>
                <div className="h-64 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="h-56 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800" />
                    <div className="h-56 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800" />
                </div>
            </div>
        </div>
    );
}

