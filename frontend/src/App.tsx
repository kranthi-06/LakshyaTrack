import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';
import { Suspense, lazy, memo, useEffect } from 'react';
import RouteSkeleton from './components/RouteSkeleton';
import {
  getPageImporter,
  injectRoutePrefetchHints,
  prefetchRoutes,
} from './utils/routePrefetch';

// ── Eagerly loaded (needed immediately on first paint) ──
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';

// ── Lazily loaded (code-split per route) ──
const lazyPage = (path: string) =>
  lazy(() => {
    const importer = getPageImporter(path);
    if (!importer) return import('./pages/Dashboard');
    return importer();
  });

const VerifyEmail = lazyPage('/verify-email');
const Dashboard = lazyPage('/dashboard');
const AuthCallback = lazyPage('/auth/callback');
const ResumeBuilder = lazyPage('/resume-builder');
const CareerIntelligence = lazyPage('/career');
const LearningHub = lazyPage('/learning');
const Evaluate = lazyPage('/evaluate');
const Quiz = lazyPage('/quiz');
const Interview = lazyPage('/interview');
const Jobs = lazyPage('/jobs');
const Progress = lazyPage('/progress');
const Profile = lazyPage('/profile');
const AdminDashboard = lazyPage('/admin/users');
const AdminInactivity = lazyPage('/admin/inactivity');
const AdminCommandCentre = lazyPage('/admin/command-centre');

/** Wrap a page with AppLayout + ProtectedRoute */
const ProtectedPage = memo(function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
});

/** Wrap an admin page with AppLayout + AdminRoute */
const AdminPage = memo(function AdminPage({ children, requireBlackAdmin }: { children: React.ReactNode; requireBlackAdmin?: boolean }) {
  return (
    <AdminRoute requireBlackAdmin={requireBlackAdmin}>
      <AppLayout>{children}</AppLayout>
    </AdminRoute>
  );
});

/** Prefetch commonly visited routes during idle time */
function usePrefetchRoutes() {
  useEffect(() => {
    const criticalRoutes = ['/dashboard', '/resume-builder', '/career', '/quiz', '/progress', '/profile'];
    injectRoutePrefetchHints(criticalRoutes);

    const prefetch = () => {
      prefetchRoutes(criticalRoutes);
    };
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(prefetch, 2000);
      return () => clearTimeout(id);
    }
  }, []);
}

function App() {
  // Prefetch commonly visited routes during idle time
  usePrefetchRoutes();

  return (
    <ThemeProvider>
    <Router>
      <AuthProvider>
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            {/* Public routes — no layout */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* /begin — Google OAuth landing point */}
            <Route
              path="/begin"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />

            {/* ── Authenticated routes with sidebar layout ── */}
            <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
            <Route path="/resume-builder" element={<ProtectedPage><ResumeBuilder /></ProtectedPage>} />
            <Route path="/evaluate" element={<ProtectedPage><Evaluate /></ProtectedPage>} />
            <Route path="/career" element={<ProtectedPage><CareerIntelligence /></ProtectedPage>} />
            <Route path="/learning" element={<ProtectedPage><LearningHub /></ProtectedPage>} />
            <Route path="/quiz" element={<ProtectedPage><Quiz /></ProtectedPage>} />
            <Route path="/interview" element={<ProtectedPage><Interview /></ProtectedPage>} />
            <Route path="/jobs" element={<ProtectedPage><Jobs /></ProtectedPage>} />
            <Route path="/progress" element={<ProtectedPage><Progress /></ProtectedPage>} />
            <Route path="/profile" element={<ProtectedPage><Profile /></ProtectedPage>} />

            {/* ── Admin Routes ── */}
            <Route path="/admin/users" element={<AdminPage><AdminDashboard /></AdminPage>} />
            <Route path="/admin/inactivity" element={<AdminPage><AdminInactivity /></AdminPage>} />
            <Route path="/admin/command-centre" element={<AdminPage requireBlackAdmin><AdminCommandCentre /></AdminPage>} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
    </ThemeProvider>
  );
}

export default App;
