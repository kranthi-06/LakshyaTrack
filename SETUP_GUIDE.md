# LakshyaTrack Setup Guide

## Quick Start

### 1. Backend Setup

The backend uses SQLite for local development. The database has been migrated to the correct schema.

**Required for local development:**
- Python 3.9+
- No additional configuration needed (uses SQLite)

**To start the backend:**
```bash
cd backend
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

**Required:**
- Node.js 18+
- npm

**To start the frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Environment variables (frontend/.env):**
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_APP_URL=http://localhost:5173
```

**Note:** Google OAuth requires Supabase configuration. For email/password login only, you can leave Supabase fields empty.

### 3. Test Accounts

The database has been seeded with test accounts:

**Admin Account:**
- Email: `23x51a3325@srecnandyal.edu.in`
- Role: `admin`
- Status: Verified and active

**Regular Users:**
- `test_user_5@example.com`
- `kasakk2006@gmail.com`
- `23x51a3365@srecnandyal.edu.in`
- `rohith@gmail.com`
- `yeddulaashok78@gmail.com`

**Note:** You'll need to reset passwords or create new accounts via the registration flow since passwords are hashed.

### 4. Admin Access

To set up a black_admin (super admin), add the email to `BLACK_ADMIN_EMAILS` in the backend `.env` file:

```env
BLACK_ADMIN_EMAILS=your-email@example.com
```

## Troubleshooting

### Login Fails with "Incorrect email or password"
- Ensure the user exists in the database
- Check that `is_verified = 1` (run `py seed_admin.py` if needed)
- Verify the password is correct (you may need to reset via registration)

### Admin Dashboard Not Accessible
- Check that the user's `role` column is set to `'admin'` or `'black_admin'`
- Verify the backend is returning the role in `/users/me` response
- Check browser console for auth errors

### Database Schema Errors
- Run `py migrate_sqlite.py` to update the schema
- Run `py seed_admin.py` to verify and update user accounts

## Production Deployment

For production, you must:
1. Set `APP_ENV=production`
2. Use PostgreSQL instead of SQLite
3. Set a strong `SECRET_KEY`
4. Configure MongoDB Atlas
5. Set up Supabase for OAuth
6. Configure SMTP for email OTP
7. Set `BLACK_ADMIN_EMAILS` for super admin access

See `.env.example` for all required environment variables.
