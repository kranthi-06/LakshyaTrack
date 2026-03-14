# VidyaMitra Premium - AI Career Intelligence Platform

## 🌟 Premium Features

This is the **ULTIMATE PRE-RELEASE** of VidyaMitra with advanced AI-UX and cinematic interactive features!

### ✨ What Makes This Premium?

1. **Cinematic Hero Experience** - Animated gradient backgrounds with `framer-motion` and `tsparticles`.
2. **AI Career Brain** - Proprietary career pathing and resume optimization engines.
3. **Dynamic Feature Ecosystem** - Interactive module switching with real-time AI previews.
4. **Glassmorphism 2.0** - High-fidelity glazed UI components using Tailwind CSS and Radix UI.
5. **Floating Intelligence** - Multilayered animated background shapes for a deep, modern feel.
6. **Toast Notification System** - Global real-time feedback for all user interactions.
7. **StatPulse Architecture** - Animated numerical counters showing platform growth.
8. **Advanced Security** - Industry-standard JWT authentication with encrypted session handling.
9. **Visual Excellence** - Optimized for 4K displays and mobile-first responsiveness.
10. **Smooth Transitions** - Fluid page redirects and micro-interactions.

## 📁 Project Structure

```
vidyamitra-premium/
├── frontend/                    # React + Vite + TypeScript (Ultimate UI)
│   ├── src/pages/               # Premium Landing, Login, Dashboard
│   ├── src/components/          # Glassmorphism & Particle components
│   └── tailwind.config.js       # Premium color system configuration
│
├── backend/                     # FastAPI + SQLAlchemy Core
│   ├── app/api/                 # AI Engine & Auth Endpoints
│   ├── app/core/                # Security & Configuration
│   └── app/db/                  # SQLite/PostgreSQL Persistence
│
└── README.md                    # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ 
- Python 3.9+ 

### 1. Start Intelligence Backend (Terminal 1)

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend will run on `http://localhost:8000`

### 2. Start Premium Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

### 3. Access the Application

- **Home Page**: http://localhost:5173/
- **Login/Signup**: http://localhost:5173/login
- **Intelligence Dashboard**: http://localhost:5173/dashboard (Secure access)

## 🎯 Features Overview

### Home Page (Landing.tsx)
- ✅ **Dynamic Hero**: Animated "Career Agent" typing effects.
- ✅ **StatCounter**: High-speed numerical animations for user metrics.
- ✅ **Feature Tabs**: Instant switching between Resume, Skills, and Interview previews.
- ✅ **Live Demo**: Cinematic pulse effects for the product showcase.
- ✅ **Pricing System**: Three-tiered premium plans with glassmorphism spotlighting.

### Login & Security (Login.tsx / Register.tsx)
- ✅ **Cinematic Entry**: Split-screen design with floating geometric shapes.
- ✅ **Social Bridge**: Optimized Google and GitHub authentication placeholders.
- ✅ **Session Lock**: Secure JWT issuance with "Trust Device" functionality.
- ✅ **Visual Feedback**: Real-time validation with toast notifications.

### Professional Dashboard (Dashboard.tsx)
- ✅ **Greeting Matrix**: Time-aware personalized user greetings.
- ✅ **Quick Actions**: Gradient-driven access to all AI tools.
- ✅ **Modular Hub**: Integrated Resume Builder, Career Engine, and Learning Hub.

## 🔧 Backend Intelligence

The FastAPI backend provides:

- **Neural Auth**: Secure user onboarding and stateful identity management.
- **AI Failover Architecture**: Automatic switching between OpenAI and Google Gemini with an intelligent "Mock Mode" for development/quota-safe testing.
- **Resume Insight**: Advanced document parsing and ATS score generation.
- **Skill Matrix**: Dynamic tracking of technical and behavioral benchmarks.
- **Interview Simulator**: Endpoint architecture for mock interview logic.
- **SQL Persistence**: Reliable storage for your professional evolution.

## 🛠️ Infrastructure Verification

To ensure all external services (Databases, AI Providers, Storage) are correctly configured and reachable from your environment, run the diagnostics tool:

```bash
# From the project root
python verify_all_connections.py
```

This will check:
- **Supabase PostgreSQL** (Primary DB)
- **MongoDB Atlas** (Document Store)
- **Supabase Auth & Storage API**
- **Groq AI** (Primary Provider)
- **OpenAI API** (Failover)
- **Cloudinary** (Media Assets)

### 💡 Troubleshooting
If a service fails:
1. Verify your credentials in `backend/.env`.
2. Check your internet connection and DNS resolution.
3. Ensure your local IP is whitelisted in MongoDB Atlas or Supabase if restricted.

---

**Crafted for the future of career development.**

🌟 **This is the ULTIMATE VidyaMitra Experience!** 🌟
