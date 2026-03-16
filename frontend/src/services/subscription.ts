import api from './api';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export interface SubscriptionPlan {
    id: string;
    name: string;
    stage: number;
    billing_cycle: 'monthly' | 'yearly';
    price: number;
    currency: string;
    features: string[];
    resume_limit: number;
    roadmap_limit: number;
    is_recommended: boolean;
    is_active: boolean;
}

export interface MicroPlan {
    id: string;
    name: string;
    feature_key: string;
    price: number;
    currency: string;
    duration_hours: number | null;
    usage_type: 'time_limited' | 'single_use';
    description: string | null;
    is_active: boolean;
}

export interface UserSubscription {
    id: string;
    user_id: string;
    plan_id: string;
    stage: number;
    status: string;
    started_at: string | null;
    expires_at: string | null;
    cancelled_at: string | null;
    amount_paid: number | null;
    plan?: SubscriptionPlan;
}

export interface UserMicroPurchase {
    id: string;
    user_id: string;
    micro_plan_id: string;
    feature_key: string;
    status: string;
    activated_at: string | null;
    expires_at: string | null;
    used: boolean;
    amount_paid: number | null;
    micro_plan?: MicroPlan;
}

export interface FeatureAccess {
    stage: number;
    is_admin: boolean;
    subscription: UserSubscription | null;
    active_micro_purchases: UserMicroPurchase[];
    features: Record<string, boolean>;
    feature_expires: Record<string, string | null>;
}

/**
 * Normalized subscription status — the SINGLE SOURCE OF TRUTH response.
 * This is the primary type the SubscriptionContext consumes.
 */
export interface SubscriptionStatus {
    plan: 'free' | 'starter' | 'professional' | 'ultimate';
    status: 'active' | 'expired' | 'cancelled' | 'none';
    stage: number;
    expires_at: string | null;
    is_admin: boolean;
    features: Record<string, boolean>;
    feature_expires: Record<string, string | null>;
    subscription_id: string | null;
    plan_name: string | null;
}

export interface CheckoutResponse {
    transaction_id: string;
    order_type: string;
    plan_name: string;
    amount: number;
    discount: number;
    final_amount: number;
    currency: string;
    status: string;
    demo_payment_url: string | null;
}

export interface ApplyCouponResponse {
    valid: boolean;
    discount: number;
    final_amount: number;
    message: string;
}

export interface VerifyPaymentResponse {
    success: boolean;
    message: string;
    subscription?: UserSubscription;
    micro_purchase?: UserMicroPurchase;
}

export interface Coupon {
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    max_uses: number | null;
    times_used: number;
    applicable_to: string;
    applicable_plan_id: string | null;
    min_amount: number;
    max_discount: number | null;
    expires_at: string | null;
    is_active: boolean;
    created_at: string | null;
}

export interface PaymentTransaction {
    id: string;
    user_id: string;
    order_type: string;
    plan_name: string | null;
    amount: number;
    discount: number;
    final_amount: number;
    currency: string;
    coupon_code: string | null;
    payment_gateway: string | null;
    status: string;
    created_at: string | null;
}

// ══════════════════════════════════════════════════════════════
// API CALLS — PRIMARY (Subscription Status)
// ══════════════════════════════════════════════════════════════

/**
 * GET /subscription/status — THE single source of truth.
 * This is the first and only call the SubscriptionContext makes on login.
 * The frontend MUST wait for this response before rendering any subscription UI.
 */
export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
    const response = await api.get('/subscription/status');
    return response.data;
};

// ══════════════════════════════════════════════════════════════
// API CALLS — PUBLIC
// ══════════════════════════════════════════════════════════════

export const getPlans = async (): Promise<SubscriptionPlan[]> => {
    const response = await api.get('/subscription/plans');
    return response.data;
};

export const getMicroPlans = async (): Promise<MicroPlan[]> => {
    const response = await api.get('/subscription/micro-plans');
    return response.data;
};

// ══════════════════════════════════════════════════════════════
// API CALLS — AUTHENTICATED
// ══════════════════════════════════════════════════════════════

export const getFeatureAccess = async (): Promise<FeatureAccess> => {
    const response = await api.get('/subscription/feature-access');
    return response.data;
};

export const getMySubscription = async (): Promise<UserSubscription | null> => {
    const response = await api.get('/subscription/my-subscription');
    return response.data;
};

export const getMyMicroPurchases = async (): Promise<UserMicroPurchase[]> => {
    const response = await api.get('/subscription/my-micro-purchases');
    return response.data;
};

export const checkout = async (
    planId: string,
    planType: 'subscription' | 'micro',
    couponCode?: string,
): Promise<CheckoutResponse> => {
    const response = await api.post('/subscription/checkout', {
        plan_id: planId,
        plan_type: planType,
        coupon_code: couponCode || null,
    });
    return response.data;
};

export const verifyPayment = async (
    transactionId: string,
): Promise<VerifyPaymentResponse> => {
    const response = await api.post('/subscription/verify-payment', {
        transaction_id: transactionId,
    });
    return response.data;
};

export const applyCoupon = async (
    couponCode: string,
    planType: string,
    planId: string,
    amount: number,
): Promise<ApplyCouponResponse> => {
    const response = await api.post('/subscription/apply-coupon', {
        coupon_code: couponCode,
        plan_type: planType,
        plan_id: planId,
        amount,
    });
    return response.data;
};

// ══════════════════════════════════════════════════════════════
// API CALLS — ADMIN
// ══════════════════════════════════════════════════════════════

export const adminGetCoupons = async (): Promise<Coupon[]> => {
    const response = await api.get('/subscription/admin/coupons');
    return response.data;
};

export const adminCreateCoupon = async (coupon: Partial<Coupon>): Promise<Coupon> => {
    const response = await api.post('/subscription/admin/coupons', coupon);
    return response.data;
};

export const adminUpdateCoupon = async (id: string, data: Partial<Coupon>): Promise<Coupon> => {
    const response = await api.put(`/subscription/admin/coupons/${id}`, data);
    return response.data;
};

export const adminDisableCoupon = async (id: string): Promise<void> => {
    await api.delete(`/subscription/admin/coupons/${id}`);
};

export const adminUpdatePlan = async (id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> => {
    const response = await api.put(`/subscription/admin/plans/${id}`, data);
    return response.data;
};

export const adminUpdateMicroPlan = async (id: string, data: Partial<MicroPlan>): Promise<MicroPlan> => {
    const response = await api.put(`/subscription/admin/micro-plans/${id}`, data);
    return response.data;
};

export const adminGetTransactions = async (status?: string): Promise<PaymentTransaction[]> => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/subscription/admin/transactions${params}`);
    return response.data;
};

export const adminManageSubscription = async (
    userId: string,
    action: string,
    stage?: number,
    days?: number,
): Promise<any> => {
    const response = await api.post('/subscription/admin/manage-subscription', {
        user_id: userId,
        action,
        stage,
        days,
    });
    return response.data;
};
