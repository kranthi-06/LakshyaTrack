"""
Subscription Service — centralized business logic for:
- Feature access resolution
- Subscription management
- Micro-plan management
- Coupon validation
- Payment processing (demo mode)
- Plan seeding
- In-memory subscription status cache
"""
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.plan_limits import (
    CORE_FEATURE_FLAGS,
    PLAN_LIMITS,
    STAGE_TO_PLAN,
    get_api_plan_name,
    get_plan_for_stage,
    serialize_limit,
)
from app.models.subscription import (
    Coupon, CouponUsage, MicroPlan, PaymentTransaction,
    SubscriptionPlan, UserMicroPurchase, UserSubscription,
)

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
# IN-MEMORY SUBSCRIPTION STATUS CACHE
# Thread-safe TTL cache for subscription lookups.
# Avoids hitting the database on every /subscription/status call.
# ══════════════════════════════════════════════════════════════

_CACHE_TTL_SECONDS = 300  # 5 minutes
_subscription_cache: Dict[str, Dict[str, Any]] = {}
_cache_lock = threading.Lock()


def _cache_key(user_id: uuid.UUID) -> str:
    return f"sub:{str(user_id)}"


def _cache_get(user_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """Get cached subscription status. Returns None on miss or expiry."""
    key = _cache_key(user_id)
    with _cache_lock:
        entry = _subscription_cache.get(key)
        if entry and entry["_expires_at"] > time.time():
            return entry["data"]
        # Expired or missing — clean up
        _subscription_cache.pop(key, None)
    return None


def _cache_set(user_id: uuid.UUID, data: Dict[str, Any]) -> None:
    """Store subscription status in cache with TTL."""
    key = _cache_key(user_id)
    with _cache_lock:
        _subscription_cache[key] = {
            "data": data,
            "_expires_at": time.time() + _CACHE_TTL_SECONDS,
        }


def invalidate_subscription_cache(user_id: uuid.UUID) -> None:
    """Invalidate cached subscription status for a user.
    Call this whenever a subscription changes (payment, upgrade, cancel, expire).
    """
    key = _cache_key(user_id)
    with _cache_lock:
        _subscription_cache.pop(key, None)
    logger.info("Subscription cache invalidated for user %s", user_id)


def invalidate_all_subscription_cache() -> None:
    """Flush the entire subscription cache (e.g., after bulk expiry job)."""
    with _cache_lock:
        _subscription_cache.clear()
    logger.info("Entire subscription cache flushed.")


# ══════════════════════════════════════════════════════════════
# NORMALIZED SUBSCRIPTION STATUS
# Single source of truth response for the frontend.
# ══════════════════════════════════════════════════════════════

STAGE_TO_PLAN_NAME = {
    stage: get_api_plan_name(plan)
    for stage, plan in STAGE_TO_PLAN.items()
}


def get_subscription_status(
    db: Session,
    user_id: uuid.UUID,
    user_role: str = "user",
) -> Dict[str, Any]:
    """
    Return the normalized subscription status for a user.
    This is the SINGLE SOURCE OF TRUTH used by the frontend.

    Returns:
        {
            "plan": "free" | "starter" | "professional" | "ultimate",
            "status": "active" | "expired" | "cancelled" | "none",
            "stage": 0-3,
            "expires_at": ISO timestamp or None,
            "is_admin": bool,
            "features": { feature_key: bool, ... },
            "feature_expires": { feature_key: ISO timestamp, ... },
            "subscription_id": UUID or None,
            "plan_name": str or None,
        }
    """
    is_admin = user_role in ("admin", "black_admin")

    # Check cache first
    cached = _cache_get(user_id)
    if cached is not None:
        # Admin status might change between requests, so override
        cached["is_admin"] = is_admin
        return cached

    # Cache miss — compute from database
    access = resolve_feature_access(db, user_id, user_role)
    stage = access["stage"]
    sub = access.get("subscription")

    status_val = "none"
    expires_at = None
    subscription_id = None
    plan_name = None

    if sub:
        status_val = sub.status
        expires_at = sub.expires_at.isoformat() if sub.expires_at else None
        subscription_id = str(sub.id)
        plan_name = sub.plan.name if sub.plan else None

    if is_admin and status_val == "none":
        status_val = "active"

    result = {
        "plan": STAGE_TO_PLAN_NAME.get(stage, "free"),
        "status": status_val,
        "stage": stage,
        "expires_at": expires_at,
        "is_admin": is_admin,
        "features": access["features"],
        "feature_expires": access.get("feature_expires", {}),
        "subscription_id": subscription_id,
        "plan_name": plan_name,
    }

    # Cache the result
    _cache_set(user_id, result)

    return result


# ══════════════════════════════════════════════════════════════
# FEATURE DEFINITIONS PER STAGE
# ══════════════════════════════════════════════════════════════

STAGE_FEATURES: Dict[int, Dict[str, bool]] = {
    stage: dict(CORE_FEATURE_FLAGS)
    for stage in STAGE_TO_PLAN_NAME
}

STAGE_LIMITS = {
    stage: {
        "resume_limit": serialize_limit(PLAN_LIMITS[plan]["resumeStorage"]),
        "roadmap_limit": serialize_limit(PLAN_LIMITS[plan]["roadmap"]),
    }
    for stage, plan in STAGE_TO_PLAN.items()
}


# ══════════════════════════════════════════════════════════════
# PLAN SEEDING
# ══════════════════════════════════════════════════════════════

DEFAULT_PLANS = [
    # Stage 1
    {
        "name": "Starter Monthly",
        "stage": 1,
        "billing_cycle": "monthly",
        "price": 99,
        "features": [
            "All core features unlocked",
            "Resume storage up to 5 resumes",
            "10 interviews per week",
            "5 roadmaps",
            "10 monthly resume downloads",
        ],
        "resume_limit": 5,
        "roadmap_limit": 5,
        "is_recommended": False,
    },
    {
        "name": "Starter Yearly",
        "stage": 1,
        "billing_cycle": "yearly",
        "price": 799,
        "features": [
            "All core features unlocked",
            "Resume storage up to 5 resumes",
            "10 interviews per week",
            "5 roadmaps",
            "10 monthly resume downloads",
        ],
        "resume_limit": 5,
        "roadmap_limit": 5,
        "is_recommended": False,
    },
    # Stage 2
    {
        "name": "Professional Monthly",
        "stage": 2,
        "billing_cycle": "monthly",
        "price": 249,
        "features": [
            "All core features unlocked",
            "Resume storage up to 20 resumes",
            "30 interviews per week",
            "15 roadmaps",
            "50 monthly resume downloads",
        ],
        "resume_limit": 20,
        "roadmap_limit": 15,
        "is_recommended": True,
    },
    {
        "name": "Professional Yearly",
        "stage": 2,
        "billing_cycle": "yearly",
        "price": 1999,
        "features": [
            "All core features unlocked",
            "Resume storage up to 20 resumes",
            "30 interviews per week",
            "15 roadmaps",
            "50 monthly resume downloads",
        ],
        "resume_limit": 20,
        "roadmap_limit": 15,
        "is_recommended": True,
    },
    # Stage 3
    {
        "name": "Ultimate Monthly",
        "stage": 3,
        "billing_cycle": "monthly",
        "price": 499,
        "features": [
            "Unlimited resume storage",
            "Unlimited interviews",
            "Unlimited roadmaps",
            "Unlimited monthly resume downloads",
            "All core platform features",
            "Priority experience",
            "Future premium add-ons included",
        ],
        "resume_limit": -1,
        "roadmap_limit": -1,
        "is_recommended": False,
    },
    {
        "name": "Ultimate Yearly",
        "stage": 3,
        "billing_cycle": "yearly",
        "price": 3999,
        "features": [
            "Unlimited resume storage",
            "Unlimited interviews",
            "Unlimited roadmaps",
            "Unlimited monthly resume downloads",
            "All core platform features",
            "Priority experience",
            "Future premium add-ons included",
        ],
        "resume_limit": -1,
        "roadmap_limit": -1,
        "is_recommended": False,
    },
]

DEFAULT_MICRO_PLANS = [
    {
        "name": "Resume Download Access",
        "feature_key": "resume_download",
        "price": 20,
        "duration_hours": 5,
        "usage_type": "time_limited",
        "description": "Download your resume for 5 hours",
    },
    {
        "name": "Resume Access Day Plan",
        "feature_key": "resume_download",
        "price": 49,
        "duration_hours": 24,
        "usage_type": "time_limited",
        "description": "Full resume access for 24 hours",
    },
    {
        "name": "Roadmap Generator",
        "feature_key": "roadmap_generate",
        "price": 10,
        "duration_hours": None,
        "usage_type": "single_use",
        "description": "Generate a single career roadmap",
    },
    {
        "name": "Interview Attempt",
        "feature_key": "interview_start",
        "price": 15,
        "duration_hours": None,
        "usage_type": "single_use",
        "description": "One AI interview practice session",
    },
]


def seed_default_plans(db: Session) -> None:
    """Insert default plans if none exist."""
    existing_plans = db.query(SubscriptionPlan).count()
    if existing_plans == 0:
        logger.info("Seeding default subscription plans...")
        for plan_data in DEFAULT_PLANS:
            plan = SubscriptionPlan(**plan_data)
            db.add(plan)
        db.commit()
        logger.info(f"Seeded {len(DEFAULT_PLANS)} subscription plans.")

    existing_micro = db.query(MicroPlan).count()
    if existing_micro == 0:
        logger.info("Seeding default micro plans...")
        for mp_data in DEFAULT_MICRO_PLANS:
            mp = MicroPlan(**mp_data)
            db.add(mp)
        db.commit()
        logger.info(f"Seeded {len(DEFAULT_MICRO_PLANS)} micro plans.")


# ══════════════════════════════════════════════════════════════
# FEATURE ACCESS RESOLUTION
# ══════════════════════════════════════════════════════════════

def get_user_stage(db: Session, user_id: uuid.UUID, user_role: str = "user") -> int:
    """Determine the effective subscription stage for a user."""
    # Admins & Super Admins always have Stage 3
    if user_role in ("admin", "black_admin"):
        return 3

    now = datetime.now(timezone.utc)
    sub = (
        db.query(UserSubscription)
        .filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active",
            UserSubscription.expires_at > now,
        )
        .order_by(UserSubscription.stage.desc())
        .first()
    )
    return sub.stage if sub else 0


def get_active_subscription(db: Session, user_id: uuid.UUID) -> Optional[UserSubscription]:
    """Get the user's active subscription (highest stage if multiple)."""
    now = datetime.now(timezone.utc)
    return (
        db.query(UserSubscription)
        .filter(
            UserSubscription.user_id == user_id,
            UserSubscription.status == "active",
            UserSubscription.expires_at > now,
        )
        .order_by(UserSubscription.stage.desc())
        .first()
    )


def get_active_micro_purchases(db: Session, user_id: uuid.UUID) -> List[UserMicroPurchase]:
    """Get all active (non-expired, non-used) micro purchases."""
    now = datetime.now(timezone.utc)
    return (
        db.query(UserMicroPurchase)
        .filter(
            UserMicroPurchase.user_id == user_id,
            UserMicroPurchase.status == "active",
        )
        .filter(
            # Time-limited: not expired. Single-use: not used.
            (UserMicroPurchase.expires_at > now) | (UserMicroPurchase.expires_at.is_(None)),
            UserMicroPurchase.used == False,
        )
        .all()
    )


def resolve_feature_access(
    db: Session,
    user_id: uuid.UUID,
    user_role: str = "user",
) -> dict:
    """
    Build a complete feature access map for a user.
    Combines stage-based access + micro-plan overrides.
    """
    stage = get_user_stage(db, user_id, user_role)
    is_admin = user_role in ("admin", "black_admin")

    # Start with stage features
    features = dict(STAGE_FEATURES.get(stage, STAGE_FEATURES[0]))

    # Get active micro purchases
    micro_purchases = get_active_micro_purchases(db, user_id)
    feature_expires: Dict[str, Optional[str]] = {}

    for mp in micro_purchases:
        features[mp.feature_key] = True
        if mp.expires_at:
            feature_expires[mp.feature_key] = mp.expires_at.isoformat()

    # Get subscription details
    subscription = get_active_subscription(db, user_id)

    return {
        "stage": stage,
        "is_admin": is_admin,
        "subscription": subscription,
        "active_micro_purchases": micro_purchases,
        "features": features,
        "feature_expires": feature_expires,
    }


def has_feature_access(
    db: Session,
    user_id: uuid.UUID,
    feature_key: str,
    user_role: str = "user",
) -> bool:
    """Check if a user has access to a specific feature."""
    access = resolve_feature_access(db, user_id, user_role)
    return access["features"].get(feature_key, False)


# ══════════════════════════════════════════════════════════════
# COUPON VALIDATION
# ══════════════════════════════════════════════════════════════

def validate_coupon(
    db: Session,
    coupon_code: str,
    user_id: uuid.UUID,
    plan_type: str,
    plan_id: uuid.UUID,
    amount: float,
) -> Tuple[bool, float, float, str]:
    """
    Validate and calculate coupon discount.
    Returns: (valid, discount_amount, final_amount, message)
    """
    coupon = (
        db.query(Coupon)
        .filter(Coupon.code == coupon_code.upper(), Coupon.is_active == True)
        .first()
    )

    if not coupon:
        return False, 0, amount, "Invalid coupon code"

    now = datetime.now(timezone.utc)

    # Check expiry
    if coupon.expires_at and coupon.expires_at < now:
        return False, 0, amount, "Coupon has expired"

    # Check usage limit
    if coupon.max_uses and coupon.times_used >= coupon.max_uses:
        return False, 0, amount, "Coupon usage limit reached"

    # Check if user already used this coupon
    usage = (
        db.query(CouponUsage)
        .filter(CouponUsage.coupon_id == coupon.id, CouponUsage.user_id == user_id)
        .first()
    )
    if usage:
        return False, 0, amount, "You have already used this coupon"

    # Check applicable_to
    if coupon.applicable_to != "all" and coupon.applicable_to != plan_type:
        return False, 0, amount, f"Coupon not applicable for {plan_type} plans"

    # Check minimum amount
    if amount < coupon.min_amount:
        return False, 0, amount, f"Minimum order amount is ₹{coupon.min_amount}"

    # Calculate discount
    if coupon.discount_type == "percentage":
        discount = amount * (coupon.discount_value / 100)
    else:
        discount = coupon.discount_value

    # Cap discount
    if coupon.max_discount and discount > coupon.max_discount:
        discount = coupon.max_discount

    discount = min(discount, amount)  # Never exceed amount
    final_amount = max(amount - discount, 0)

    return True, discount, final_amount, f"Coupon applied! You save ₹{discount:.0f}"


# ══════════════════════════════════════════════════════════════
# CHECKOUT & PAYMENT (DEMO MODE)
# ══════════════════════════════════════════════════════════════

def create_checkout(
    db: Session,
    user_id: uuid.UUID,
    plan_id: uuid.UUID,
    plan_type: str,
    coupon_code: Optional[str] = None,
) -> PaymentTransaction:
    """Create a payment transaction for checkout."""
    if plan_type == "subscription":
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        if not plan:
            raise ValueError("Subscription plan not found")
        amount = plan.price
        plan_name = plan.name
    elif plan_type == "micro":
        plan = db.query(MicroPlan).filter(MicroPlan.id == plan_id).first()
        if not plan:
            raise ValueError("Micro plan not found")
        amount = plan.price
        plan_name = plan.name
    else:
        raise ValueError("Invalid plan type")

    discount = 0.0
    final_amount = amount
    applied_coupon = None

    if coupon_code:
        valid, disc, final, msg = validate_coupon(
            db, coupon_code, user_id, plan_type, plan_id, amount
        )
        if valid:
            discount = disc
            final_amount = final
            applied_coupon = coupon_code.upper()

    txn = PaymentTransaction(
        user_id=user_id,
        order_type=plan_type,
        plan_id=plan_id,
        plan_name=plan_name,
        amount=amount,
        discount=discount,
        final_amount=final_amount,
        currency="INR",
        coupon_code=applied_coupon,
        payment_gateway="demo",
        status="pending",
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def verify_payment_and_activate(
    db: Session,
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """
    Verify payment and activate the subscription/micro purchase.
    In demo mode, this immediately marks the transaction as successful.
    """
    txn = (
        db.query(PaymentTransaction)
        .filter(
            PaymentTransaction.id == transaction_id,
            PaymentTransaction.user_id == user_id,
        )
        .first()
    )

    if not txn:
        return {"success": False, "message": "Transaction not found"}

    if txn.status == "success":
        return {"success": False, "message": "Payment already processed"}

    # Mark transaction as successful (demo mode)
    txn.status = "success"

    result = {"success": True, "message": "Payment successful! Features activated."}

    if txn.order_type == "subscription":
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == txn.plan_id).first()
        if not plan:
            return {"success": False, "message": "Plan not found"}

        # Cancel any existing active subscription
        now = datetime.now(timezone.utc)
        existing = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == user_id,
                UserSubscription.status == "active",
            )
            .all()
        )
        for sub in existing:
            sub.status = "expired"

        # Calculate expiry
        if plan.billing_cycle == "monthly":
            expires_at = now + timedelta(days=30)
        else:
            expires_at = now + timedelta(days=365)

        # Create subscription
        coupon_id = None
        if txn.coupon_code:
            coupon = db.query(Coupon).filter(Coupon.code == txn.coupon_code).first()
            if coupon:
                coupon_id = coupon.id
                coupon.times_used += 1
                # Record usage
                usage = CouponUsage(
                    coupon_id=coupon.id,
                    user_id=user_id,
                    plan_type="subscription",
                    discount_applied=txn.discount,
                )
                db.add(usage)

        sub = UserSubscription(
            user_id=user_id,
            plan_id=plan.id,
            stage=plan.stage,
            status="active",
            expires_at=expires_at,
            coupon_id=coupon_id,
            amount_paid=txn.final_amount,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        result["subscription"] = sub

    elif txn.order_type == "micro":
        micro_plan = db.query(MicroPlan).filter(MicroPlan.id == txn.plan_id).first()
        if not micro_plan:
            return {"success": False, "message": "Micro plan not found"}

        now = datetime.now(timezone.utc)
        expires_at = None
        if micro_plan.duration_hours:
            expires_at = now + timedelta(hours=micro_plan.duration_hours)

        coupon_id = None
        if txn.coupon_code:
            coupon = db.query(Coupon).filter(Coupon.code == txn.coupon_code).first()
            if coupon:
                coupon_id = coupon.id
                coupon.times_used += 1
                usage = CouponUsage(
                    coupon_id=coupon.id,
                    user_id=user_id,
                    plan_type="micro",
                    discount_applied=txn.discount,
                )
                db.add(usage)

        purchase = UserMicroPurchase(
            user_id=user_id,
            micro_plan_id=micro_plan.id,
            feature_key=micro_plan.feature_key,
            status="active",
            expires_at=expires_at,
            amount_paid=txn.final_amount,
            coupon_id=coupon_id,
        )
        db.add(purchase)
        db.commit()
        db.refresh(purchase)
        result["micro_purchase"] = purchase

    db.commit()

    # Invalidate subscription cache so frontend gets fresh data
    invalidate_subscription_cache(user_id)

    return result


# ══════════════════════════════════════════════════════════════
# SUBSCRIPTION EXPIRY CHECK
# ══════════════════════════════════════════════════════════════

def expire_subscriptions(db: Session) -> int:
    """Background job: mark expired subscriptions. Returns count."""
    now = datetime.now(timezone.utc)
    expired = (
        db.query(UserSubscription)
        .filter(
            UserSubscription.status == "active",
            UserSubscription.expires_at <= now,
        )
        .all()
    )
    count = 0
    for sub in expired:
        sub.status = "expired"
        count += 1

    # Also expire time-limited micro purchases
    expired_micro = (
        db.query(UserMicroPurchase)
        .filter(
            UserMicroPurchase.status == "active",
            UserMicroPurchase.expires_at.isnot(None),
            UserMicroPurchase.expires_at <= now,
        )
        .all()
    )
    for mp in expired_micro:
        mp.status = "expired"
        count += 1

    if count > 0:
        db.commit()
        logger.info(f"Expired {count} subscriptions/micro-purchases.")
        # Flush entire cache after bulk expiry
        invalidate_all_subscription_cache()

    return count


# ══════════════════════════════════════════════════════════════
# ADMIN: MANAGE USER SUBSCRIPTIONS
# ══════════════════════════════════════════════════════════════

def admin_manage_subscription(
    db: Session,
    target_user_id: uuid.UUID,
    action: str,
    stage: Optional[int] = None,
    days: Optional[int] = None,
) -> dict:
    """Admin action to upgrade/downgrade/cancel/extend a user subscription."""
    now = datetime.now(timezone.utc)

    if action == "cancel":
        subs = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == target_user_id,
                UserSubscription.status == "active",
            )
            .all()
        )
        for s in subs:
            s.status = "cancelled"
            s.cancelled_at = now
        db.commit()
        invalidate_subscription_cache(target_user_id)
        return {"success": True, "message": "Subscription cancelled"}

    if action == "extend":
        sub = get_active_subscription(db, target_user_id)
        if not sub:
            return {"success": False, "message": "No active subscription to extend"}
        sub.expires_at = sub.expires_at + timedelta(days=days or 30)
        db.commit()
        invalidate_subscription_cache(target_user_id)
        return {"success": True, "message": f"Subscription extended by {days or 30} days"}

    if action in ("upgrade", "downgrade"):
        if stage is None:
            return {"success": False, "message": "Stage is required for upgrade/downgrade"}

        # Find a matching plan (monthly by default)
        plan = (
            db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.stage == stage, SubscriptionPlan.billing_cycle == "monthly")
            .first()
        )
        if not plan:
            return {"success": False, "message": f"No plan found for stage {stage}"}

        # Cancel existing
        existing = (
            db.query(UserSubscription)
            .filter(
                UserSubscription.user_id == target_user_id,
                UserSubscription.status == "active",
            )
            .all()
        )
        for s in existing:
            s.status = "expired"

        # Create new
        sub = UserSubscription(
            user_id=target_user_id,
            plan_id=plan.id,
            stage=stage,
            status="active",
            expires_at=now + timedelta(days=30),
            amount_paid=0,  # Admin action, no payment
        )
        db.add(sub)
        db.commit()
        invalidate_subscription_cache(target_user_id)
        return {"success": True, "message": f"User {'upgraded' if action == 'upgrade' else 'downgraded'} to Stage {stage}"}

    return {"success": False, "message": f"Unknown action: {action}"}
