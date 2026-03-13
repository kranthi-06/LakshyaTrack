import { createClient } from '@supabase/supabase-js';

// These should be in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Use PKCE flow instead of implicit grant.
        // Implicit grant puts tokens in the URL hash (#access_token=...),
        // which causes the landing page to flash before the callback page loads.
        // PKCE uses a proper ?code= query parameter that goes directly to /auth/callback.
        flowType: 'pkce',
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

