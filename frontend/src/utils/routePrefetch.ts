import type { ComponentType } from 'react';

type PageModule = { default: ComponentType<any> };
type Importer = () => Promise<PageModule>;

const pageImporters: Record<string, Importer> = {
    '/dashboard': () => import('../pages/Dashboard'),
    '/resume-builder': () => import('../pages/ResumeBuilder'),
    '/career': () => import('../pages/CareerIntelligence'),
    '/quiz': () => import('../pages/Quiz'),
    '/progress': () => import('../pages/Progress'),
    '/profile': () => import('../pages/Profile'),
    '/evaluate': () => import('../pages/Evaluate'),
    '/interview': () => import('../pages/Interview'),
    '/jobs': () => import('../pages/Jobs'),
    '/learning': () => import('../pages/LearningHub'),
    '/admin/users': () => import('../pages/AdminDashboard'),
    '/admin/inactivity': () => import('../pages/AdminInactivity'),
    '/admin/command-centre': () => import('../pages/AdminCommandCentre'),
    '/verify-email': () => import('../pages/VerifyEmail'),
    '/auth/callback': () => import('../pages/AuthCallback'),
    '/plans': () => import('../pages/Plans'),
    '/admin/subscriptions': () => import('../pages/AdminSubscriptionPanel'),
    '/english': () => import('../pages/EnglishSpeaking'),
    '/reasoning': () => import('../pages/Reasoning'),
    '/admin/questions': () => import('../pages/AdminQuestionUpload'),
    '/progress-dashboard': () => import('../progress-system/ProgressDashboard'),
};

const preloadedRoutes = new Set<string>();

export function getPageImporter(path: string): Importer | null {
    return pageImporters[path] || null;
}

export function prefetchRoute(path: string) {
    const importer = getPageImporter(path);
    if (!importer || preloadedRoutes.has(path)) return;

    preloadedRoutes.add(path);
    importer().catch(() => {
        preloadedRoutes.delete(path);
    });
}

export function prefetchRoutes(paths: string[]) {
    paths.forEach(prefetchRoute);
}

export function injectRoutePrefetchHints(paths: string[]) {
    const head = document.head;
    if (!head) return;

    paths.forEach((path) => {
        const id = `prefetch-${path.replace(/[^\w-]/g, '_')}`;
        if (document.getElementById(id)) return;

        const link = document.createElement('link');
        link.id = id;
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = path;
        head.appendChild(link);
    });
}
