import api from './api';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface UsageCounter {
    current: number;
    limit: number;       // -1 = unlimited
    remaining: number;   // -1 = unlimited
    exceeded: boolean;
}

export interface UsageResets {
    weekly_resets_at: string | null;
    monthly_resets_at: string | null;
}

export interface UsageStatus {
    stage: number;
    plan: 'free' | 'starter' | 'professional' | 'ultimate';
    is_admin: boolean;
    counters: {
        resume_count: UsageCounter;
        interview_count_weekly: UsageCounter;
        plan_count: UsageCounter;
        resume_edit_monthly: UsageCounter;
    };
    resets: UsageResets;
}

export interface PlanLimits {
    plans: Record<string, Record<string, number>>;
}

// ══════════════════════════════════════════════════════════════
// API CALLS
// ══════════════════════════════════════════════════════════════

/**
 * GET /usage/status — the user's current usage counters + limits.
 * The frontend uses this to decide whether to show lock icons and
 * disable/enable feature buttons.
 */
export const getUsageStatus = async (): Promise<UsageStatus> => {
    const response = await api.get('/usage/status');
    return response.data;
};

/**
 * GET /usage/limits — public plan limit definitions.
 * Used on the pricing page to show what each plan offers.
 */
export const getPlanLimits = async (): Promise<PlanLimits> => {
    const response = await api.get('/usage/limits');
    return response.data;
};

/**
 * POST /usage/upgrade-plan — upgrade plan (redirects to checkout).
 */
export const requestUpgrade = async (
    targetPlan: string,
    couponCode?: string,
): Promise<any> => {
    const response = await api.post('/usage/upgrade-plan', {
        target_plan: targetPlan,
        coupon_code: couponCode || null,
    });
    return response.data;
};
