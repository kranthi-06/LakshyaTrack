-- Migration 008: payment idempotency and coupon redemption uniqueness.
--
-- Additive only. This migration adds the two uniqueness guarantees that the
-- application models already declare but migration 007 does not create:
--
--   * coupon_usages (coupon_id, user_id)  -> one redemption per user per coupon
--   * payment_transactions (gateway_payment_id) -> one entitlement per gateway id
--
-- REVIEW BEFORE APPLYING. Run the pre-checks below first. If either query
-- returns rows, stop and reconcile the existing data before applying; the
-- ALTER TABLE would fail (safely, inside the transaction) on duplicates.
-- Do not apply this migration automatically or from application startup.
--
-- PRE-CHECK 1: duplicate coupon redemptions
--   SELECT coupon_id, user_id, COUNT(*) AS duplicate_count
--   FROM public.coupon_usages
--   GROUP BY coupon_id, user_id
--   HAVING COUNT(*) > 1
--   ORDER BY duplicate_count DESC;
--
-- PRE-CHECK 2: duplicate gateway payment ids (NULL is allowed and ignored)
--   SELECT gateway_payment_id, COUNT(*) AS duplicate_count
--   FROM public.payment_transactions
--   WHERE gateway_payment_id IS NOT NULL
--   GROUP BY gateway_payment_id
--   HAVING COUNT(*) > 1
--   ORDER BY duplicate_count DESC;

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_coupon_usages_coupon_user'
          AND conrelid = 'public.coupon_usages'::regclass
    ) THEN
        ALTER TABLE public.coupon_usages
            ADD CONSTRAINT uq_coupon_usages_coupon_user
            UNIQUE (coupon_id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_payment_transactions_gateway_payment_id'
          AND conrelid = 'public.payment_transactions'::regclass
    ) THEN
        ALTER TABLE public.payment_transactions
            ADD CONSTRAINT uq_payment_transactions_gateway_payment_id
            UNIQUE (gateway_payment_id);
    END IF;
END
$$;

COMMIT;

-- ROLLBACK (safe, non-destructive: only removes the constraints added above):
--   ALTER TABLE public.coupon_usages
--       DROP CONSTRAINT IF EXISTS uq_coupon_usages_coupon_user;
--   ALTER TABLE public.payment_transactions
--       DROP CONSTRAINT IF EXISTS uq_payment_transactions_gateway_payment_id;
