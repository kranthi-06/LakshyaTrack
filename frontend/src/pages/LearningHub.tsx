import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen,
    Calendar,
    CheckCircle2,
    PlayCircle,
    ArrowRight,
    ChevronRight,
    Star,
    Video,
    Book,
    Code,
    Sparkles,
    Search,
    Clock,
    Library,
    Users
} from 'lucide-react';
const roadmapData = [
    {
        week: 'W1',
        title: 'JavaScript',
        id: 'javascript',
        description: 'Master JavaScript to excel as a Software Engineer. This week focuses on beginner-level concepts essential for your target role.',
        tasks: [
            'Study JavaScript fundamentals through interactive tutorials and documentation',
            'Complete 5-7 beginner-level JavaScript coding exercises on platforms like LeetCode/HackerRank',
            'Build a simple starter project implementing JavaScript concepts',
            'Document your learning journey, challenges faced, and solutions found',
            'Watch at least 3 comprehensive video tutorials on JavaScript'
        ],
        resource: {
            title: 'JavaScript Tutorial Full Course - Beginner to Pro',
            desc: 'Get a certificate for this course: Master JavaScript basics, DOM manipulation, and modern ES6+ features.',
            channel: 'SuperSimpleDev',
            duration: '11:57:12',
            level: 'Beginner Level',
            url: 'https://www.youtube.com/watch?v=EerdGm-1TPU',
            thumbnail: 'https://img.youtube.com/vi/EerdGm-1TPU/maxresdefault.jpg'
        },
        learn: [
            'Understand core JavaScript concepts and principles',
            'Implement JavaScript in practical projects',
            'Master JavaScript best practices for Software Engineer',
            'Build confidence to use JavaScript in real-world scenarios'
        ]
    },
    {
        week: 'W2',
        title: 'React',
        id: 'react',
        description: 'Master React to excel as a Software Engineer. This week focuses on beginner-level concepts essential for your target role.',
        tasks: [
            'Study React fundamentals through interactive tutorials and documentation',
            'Complete 5-7 beginner-level React coding exercises on platforms like LeetCode/HackerRank',
            'Build a simple starter project implementing React concepts',
            'Document your learning journey, challenges faced, and solutions found',
            'Watch at least 3 comprehensive video tutorials on React'
        ],
        resource: {
            title: 'React Full Course for Beginners 2025',
            desc: 'Comprehensive guide to building modern user interfaces with React, Hooks, and State Management.',
            channel: 'Programming with Mosh',
            duration: '2:35:12',
            level: 'Beginner Level',
            url: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
            thumbnail: 'https://img.youtube.com/vi/SqcY0GlETPk/maxresdefault.jpg'
        },
        learn: [
            'Understand React component architecture',
            'Manage state and props effectively',
            'Handle side effects with useEffect',
            'Build responsive and interactive UIs'
        ]
    },
    {
        week: 'W3',
        title: 'Node.js',
        id: 'nodejs',
        description: 'Master Node.js to excel as a Software Engineer. This week focuses on beginner-level concepts essential for your target role.',
        tasks: [
            'Study Node.js fundamentals through interactive tutorials and documentation',
            'Complete 5-7 beginner-level Node.js coding exercises on platforms like LeetCode/HackerRank',
            'Build a simple starter project implementing Node.js concepts',
            'Document your learning journey, challenges faced, and solutions found',
            'Watch at least 3 comprehensive video tutorials on Node.js'
        ],
        resource: {
            title: "Node.js Ultimate Beginner's Guide in 7 Easy Steps",
            desc: 'Why learn Node.js in 2025? Master the fundamentals of Node in 7 easy steps, then build a fullstack web app and deploy it to a ...',
            channel: 'Fireship',
            duration: '16:19',
            level: 'Beginner Level',
            url: 'https://www.youtube.com/watch?v=ENrzD9HAZK4',
            thumbnail: 'https://img.youtube.com/vi/ENrzD9HAZK4/maxresdefault.jpg'
        },
        learn: [
            'Understand core Node.js concepts and principles',
            'Implement Node.js in practical projects',
            'Master Node.js best practices for Software Engineer',
            'Build confidence to use Node.js in real-world scenarios'
        ]
    },
    {
        week: 'W4',
        title: 'Python',
        id: 'python',
        description: 'Master Python to excel as a Software Engineer. This week focuses on beginner-level concepts essential for your target role.',
        tasks: [
            'Study Python fundamentals through interactive tutorials and documentation',
            'Complete 5-7 beginner-level Python coding exercises on platforms like LeetCode/HackerRank',
            'Build a simple starter project implementing Python concepts',
            'Document your learning journey, challenges faced, and solutions found',
            'Watch at least 3 comprehensive video tutorials on Python'
        ],
        resource: {
            title: 'Python Full Course for Beginners [2025]',
            desc: 'Master Python from scratch! No fluff—just clear, practical coding skills to kickstart your journey! ❤️',
            channel: 'Programming with Mosh',
            duration: '6:14:07',
            level: 'Beginner Level',
            url: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
            thumbnail: 'https://img.youtube.com/vi/_uQrJ0TkZlc/maxresdefault.jpg'
        },
        learn: [
            'Understand core Python concepts and principles',
            'Implement Python in practical projects',
            'Master Python best practices for Software Engineer',
            'Build confidence to use Python in real-world scenarios'
        ]
    }
];

export default function LearningHub() {
    return (
        <div className="min-h-screen font-sans pb-20 overflow-x-hidden relative bg-slate-50 dark:bg-[#050510]">
                <main className="max-w-5xl mx-auto px-6 pt-16 space-y-12">

                    {/* Header Banner */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/90 backdrop-blur-sm border border-white/20 rounded-[2.5rem] p-10 md:p-14 flex flex-col md:flex-row items-center gap-10 shadow-xl"
                    >
                        <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200 shrink-0">
                            <Calendar className="w-10 h-10" />
                        </div>
                        <div className="space-y-3 text-center md:text-left">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">4-Week Learning Journey</h1>
                            <p className="text-slate-500 text-lg font-medium">Structured plan with curated resources and practical exercises</p>
                        </div>
                    </motion.div>

                    {/* Subtitle */}
                    <div className="flex items-center gap-4 ml-2">
                        <BookOpen className="w-6 h-6 text-[#5c52d2]" />
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Weekly Schedule</h2>
                    </div>

                    {/* Weekly Cards */}
                    <div className="space-y-10">
                        {roadmapData.map((week, index) => (
                            <motion.div
                                key={week.id}
                                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className="border-none shadow-xl bg-white/90 backdrop-blur-sm rounded-[3.5rem] p-10 md:p-16 space-y-12 overflow-hidden relative group border border-white/20">
                                    {/* Week Badge */}
                                    <div className="flex items-start gap-8">
                                        <div className="w-16 h-16 bg-[#5c52d2] rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-lg shadow-purple-100 transition-transform group-hover:scale-110">
                                            {week.week}
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{week.title}</h3>
                                            <p className="text-slate-400 font-bold leading-relaxed max-w-2xl">
                                                {week.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tasks Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-[#5c52d2]">
                                            <div className="w-1.5 h-1.5 bg-[#5c52d2] rounded-full" />
                                            <h4 className="text-xs font-black uppercase tracking-widest">Tasks</h4>
                                        </div>
                                        <ul className="space-y-4 ml-2">
                                            {week.tasks.map((task, i) => (
                                                <li key={i} className="flex font-bold text-slate-500 text-sm leading-relaxed group/task">
                                                    <span className="mr-3 text-slate-300 group-hover/task:text-[#5c52d2]">•</span>
                                                    <div className="flex items-center gap-2">
                                                        {i === 0 && '📖'}
                                                        {i === 1 && '📊'}
                                                        {i === 2 && '🏃'}
                                                        {i === 3 && '📝'}
                                                        {i === 4 && '📽️'}
                                                        <span className="group-hover/task:text-slate-900 transition-colors">{task}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Resource Section */}
                                    <div className="bg-[#eff6ff]/60 border border-blue-100/50 rounded-[2.5rem] p-10 space-y-8">
                                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div className="flex items-center gap-3 text-[#5c52d2]">
                                                <Library className="w-5 h-5" />
                                                <h4 className="text-xs font-black uppercase tracking-widest">Primary Learning Resource</h4>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <span className="text-xs font-black uppercase tracking-widest">Redirecting to Youtube:</span>
                                                <div className="w-6 h-6 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                                                    <Video className="w-3 h-3" />
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => window.open(week.resource.url, '_blank')}
                                            className="bg-white rounded-[2rem] p-4 border border-blue-100/30 shadow-sm group/res cursor-pointer hover:shadow-2xl hover:shadow-blue-200/50 transition-all overflow-hidden"
                                        >
                                            <div className="relative aspect-video rounded-3xl overflow-hidden mb-8 shadow-inner bg-slate-100">
                                                <img
                                                    src={week.resource.thumbnail}
                                                    alt={week.resource.title}
                                                    className="w-full h-full object-cover group-hover/res:scale-105 transition-transform duration-700 opacity-90 group-hover/res:opacity-100"
                                                />
                                                <div className="absolute inset-0 bg-black/5 group-hover/res:bg-black/0 transition-colors" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-16 h-16 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-red-600 shadow-xl transform group-hover/res:scale-110 transition-all">
                                                        <PlayCircle className="w-10 h-10 fill-red-600/10" />
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-4 right-4 bg-black/80 text-white text-[10px] font-black px-3 py-1.5 rounded-lg backdrop-blur-md">
                                                    {week.resource.duration}
                                                </div>
                                            </div>

                                            <div className="px-4 pb-4 space-y-4 text-center md:text-left">
                                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                                    <div className="flex-1 space-y-2">
                                                        <h5 className="text-2xl font-black text-slate-900 leading-tight group-hover/res:text-[#5c52d2] transition-colors">{week.resource.title}</h5>
                                                        <p className="text-slate-400 font-bold text-sm leading-relaxed max-w-xl">{week.resource.desc}</p>
                                                    </div>
                                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover/res:bg-[#5c52d2] group-hover/res:text-white transition-all transform group-hover/res:translate-x-1 shadow-sm">
                                                        <ArrowRight className="w-6 h-6" />
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-4 border-t border-slate-50">
                                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#5c52d2] bg-purple-50 px-4 py-2 rounded-xl">
                                                        <Users className="w-4 h-4" />
                                                        {week.resource.channel}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-4 py-2 rounded-xl">
                                                        <Clock className="w-4 h-4" />
                                                        {week.resource.duration} Video
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-50 px-4 py-2 rounded-xl">
                                                        <Library className="w-4 h-4" />
                                                        {week.resource.level}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Learn Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-blue-500">
                                            <Sparkles className="w-5 h-5 rotate-12" />
                                            <h4 className="text-xs font-black uppercase tracking-widest">What You'll Learn</h4>
                                        </div>
                                        <ul className="space-y-4 ml-2">
                                            {week.learn.map((item, i) => (
                                                <li key={i} className="flex font-bold text-slate-500 text-sm leading-relaxed">
                                                    <span className="mr-3 text-blue-400 group-hover:text-blue-600 transition-colors tracking-widest">~~</span>
                                                    <span className="hover:text-slate-900 transition-colors">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Decorative Elements */}
                </main>        </div>
    );
}
