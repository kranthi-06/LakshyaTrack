-- Migration 007: subscription schema required by authenticated session APIs.
--
-- This migration is additive and idempotent.  It deliberately does not seed,
-- alter, or delete user subscription data.  Apply it through the approved
-- production migration process before deploying code that reads these tables.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    stage INTEGER NOT NULL,
    billing_cycle VARCHAR NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    currency VARCHAR DEFAULT 'INR',
    features JSONB DEFAULT '[]'::jsonb,
    resume_limit INTEGER DEFAULT 1,
    roadmap_limit INTEGER DEFAULT 1,
    is_recommended BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.micro_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    feature_key VARCHAR NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    currency VARCHAR DEFAULT 'INR',
    duration_hours DOUBLE PRECISION,
    usage_type VARCHAR DEFAULT 'time_limited',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR NOT NULL UNIQUE,
    discount_type VARCHAR NOT NULL,
    discount_value DOUBLE PRECISION NOT NULL,
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    applicable_to VARCHAR DEFAULT 'all',
    applicable_plan_id UUID,
    min_amount DOUBLE PRECISION DEFAULT 0,
    max_discount DOUBLE PRECISION,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
    stage INTEGER NOT NULL,
    status VARCHAR DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    coupon_id UUID REFERENCES public.coupons(id),
    amount_paid DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_micro_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    micro_plan_id UUID NOT NULL REFERENCES public.micro_plans(id),
    feature_key VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'active',
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    used BOOLEAN DEFAULT FALSE,
    amount_paid DOUBLE PRECISION,
    coupon_id UUID REFERENCES public.coupons(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    plan_type VARCHAR NOT NULL,
    discount_applied DOUBLE PRECISION NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_type VARCHAR NOT NULL,
    plan_id UUID,
    plan_name VARCHAR,
    amount DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    final_amount DOUBLE PRECISION NOT NULL,
    currency VARCHAR DEFAULT 'INR',
    coupon_code VARCHAR,
    payment_gateway VARCHAR,
    gateway_order_id VARCHAR,
    gateway_payment_id VARCHAR,
    status VARCHAR DEFAULT 'pending',
    payment_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_user_id
    ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS ix_user_micro_purchases_user_id
    ON public.user_micro_purchases(user_id);
CREATE INDEX IF NOT EXISTS ix_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS ix_payment_transactions_user_id
    ON public.payment_transactions(user_id);
