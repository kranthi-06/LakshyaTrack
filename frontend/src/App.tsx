import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { Suspense, lazy } from 'react';
import AuthLoadingScreen from './components/AuthLoadingScreen';

// ── Eagerly loaded (needed immediately on first paint) ──
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';

// ── Lazily loaded (code-split per route) ──
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const ResumeBuilder = lazy(() => import('./pages/ResumeBuilder'));
const CareerIntelligence = lazy(() => import('./pages/CareerIntelligence'));
const LearningHub = lazy(() => import('./pages/LearningHub'));
const Evaluate = lazy(() => import('./pages/Evaluate'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Interview = lazy(() => import('./pages/Interview'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Progress = lazy(() => import('./pages/Progress'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminInactivity = lazy(() => import('./pages/AdminInactivity'));
const AdminCommandCentre = lazy(() => import('./pages/AdminCommandCentre'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<AuthLoadingScreen />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume-builder"
              element={
                <ProtectedRoute>
                  <ResumeBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluate"
              element={
                <ProtectedRoute>
                  <Evaluate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/career"
              element={
                <ProtectedRoute>
                  <CareerIntelligence />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learning"
              element={
                <ProtectedRoute>
                  <LearningHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz"
              element={
                <ProtectedRoute>
                  <Quiz />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  <Interview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <Jobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* ── Admin Routes ── */}
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/inactivity"
              element={
                <AdminRoute>
                  <AdminInactivity />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/command-centre"
              element={
                <AdminRoute requireBlackAdmin>
                  <AdminCommandCentre />
                </AdminRoute>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
