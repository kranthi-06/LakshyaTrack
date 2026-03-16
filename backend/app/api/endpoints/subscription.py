"""
Subscription & Feature Access API endpoints.
Covers plans listing, checkout, payment verification, feature access,
coupon application, and admin management.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, require_admin, require_black_admin
from app.db.session import get_db
from app.models.subscription import (
    Coupon, MicroPlan, PaymentTransaction, SubscriptionPlan,
    UserMicroPurchase, UserSubscription,
)
from app.models.user import User
from app.schemas.subscription import (
    AdminManageSubscriptionRequest,
    ApplyCouponRequest,
    ApplyCouponResponse,
    CheckoutRequest,
    CheckoutResponse,
    CouponCreate,
    CouponResponse,
    CouponUpdate,
    FeatureAccessResponse,
    MicroPlanCreate,
    MicroPlanResponse,
    MicroPlanUpdate,
    PaymentTransactionResponse,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
    UserMicroPurchaseResponse,
    UserSubscriptionResponse,
    VerifyPaymentRequest,
    VerifyPaymentResponse,
)
from app.services.subscription_service import (
    create_checkout,
    get_active_micro_purchases,
    get_active_subscription,
    get_subscription_status,
    resolve_feature_access,
    validate_coupon,
    verify_payment_and_activate,
    admin_manage_subscription,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════
# PRIMARY: SUBSCRIPTION STATUS (single source of truth)
# ══════════════════════════════════════════════════════════════

@router.get("/status")
def subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    GET /subscription/status — THE single-source-of-truth endpoint.

    This is the primary endpoint the frontend calls on login to determine
    subscription state. It is cached (5 min TTL) and returns a normalized
    response that the frontend should render without any local assumptions.

    Response:
        {
            "plan": "free" | "starter" | "professional" | "ultimate",
            "status": "active" | "expired" | "cancelled" | "none",
            "stage": 0-3,
            "expires_at": "2027-03-16T00:00:00+00:00" | null,
            "is_admin": false,
            "features": { "resume_download": true, ... },
            "feature_expires": {},
            "subscription_id": "uuid" | null,
            "plan_name": "Ultimate Monthly" | null
        }
    """
    from app.api.deps import _resolve_user_role
    role = _resolve_user_role(current_user)
    return get_subscription_status(db, current_user.id, role)


# ══════════════════════════════════════════════════════════════
# PUBLIC: PLAN LISTINGS
# ══════════════════════════════════════════════════════════════

@router.get("/plans", response_model=List[SubscriptionPlanResponse])
def list_plans(db: Session = Depends(get_db)):
    """List all active subscription plans."""
    plans = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_active == True)
        .order_by(SubscriptionPlan.stage, SubscriptionPlan.billing_cycle)
        .all()
    )
    return plans


@router.get("/micro-plans", response_model=List[MicroPlanResponse])
def list_micro_plans(db: Session = Depends(get_db)):
    """List all active micro plans."""
    plans = (
        db.query(MicroPlan)
        .filter(MicroPlan.is_active == True)
        .order_by(MicroPlan.price)
        .all()
    )
    return plans


# ══════════════════════════════════════════════════════════════
# AUTHENTICATED: USER SUBSCRIPTION STATE
# ══════════════════════════════════════════════════════════════

@router.get("/my-subscription", response_model=Optional[UserSubscriptionResponse])
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get the current user's active subscription."""
    sub = get_active_subscription(db, current_user.id)
    return sub


@router.get("/my-micro-purchases", response_model=List[UserMicroPurchaseResponse])
def get_my_micro_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get the current user's active micro purchases."""
    return get_active_micro_purchases(db, current_user.id)


@router.get("/feature-access", response_model=FeatureAccessResponse)
def get_feature_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get complete feature access map for the current user.
    This is the primary endpoint for the frontend to determine
    what features are available to the current user.
    """
    from app.api.deps import _resolve_user_role
    role = _resolve_user_role(current_user)
    access = resolve_feature_access(db, current_user.id, role)
    return access


# ══════════════════════════════════════════════════════════════
# CHECKOUT & PAYMENT
# ══════════════════════════════════════════════════════════════

@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    request: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a checkout/payment transaction."""
    try:
        txn = create_checkout(
            db=db,
            user_id=current_user.id,
            plan_id=request.plan_id,
            plan_type=request.plan_type,
            coupon_code=request.coupon_code,
        )
        return CheckoutResponse(
            transaction_id=txn.id,
            order_type=txn.order_type,
            plan_name=txn.plan_name or "",
            amount=txn.amount,
            discount=txn.discount,
            final_amount=txn.final_amount,
            currency=txn.currency,
            status=txn.status,
            demo_payment_url=f"/subscription/verify-payment?txn={txn.id}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-payment", response_model=VerifyPaymentResponse)
def verify_payment(
    request: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Verify payment and activate subscription/micro purchase."""
    result = verify_payment_and_activate(
        db=db,
        transaction_id=request.transaction_id,
        user_id=current_user.id,
    )

    response = VerifyPaymentResponse(
        success=result["success"],
        message=result["message"],
    )

    if "subscription" in result and result["subscription"]:
        sub = result["subscription"]
        response.subscription = UserSubscriptionResponse(
            id=sub.id,
            user_id=sub.user_id,
            plan_id=sub.plan_id,
            stage=sub.stage,
            status=sub.status,
            started_at=sub.started_at,
            expires_at=sub.expires_at,
            amount_paid=sub.amount_paid,
        )

    if "micro_purchase" in result and result["micro_purchase"]:
        mp = result["micro_purchase"]
        response.micro_purchase = UserMicroPurchaseResponse(
            id=mp.id,
            user_id=mp.user_id,
            micro_plan_id=mp.micro_plan_id,
            feature_key=mp.feature_key,
            status=mp.status,
            activated_at=mp.activated_at,
            expires_at=mp.expires_at,
            used=mp.used,
            amount_paid=mp.amount_paid,
        )

    return response


# ══════════════════════════════════════════════════════════════
# COUPON APPLICATION
# ══════════════════════════════════════════════════════════════

@router.post("/apply-coupon", response_model=ApplyCouponResponse)
def apply_coupon(
    request: ApplyCouponRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Validate and calculate discount for a coupon."""
    valid, discount, final_amount, message = validate_coupon(
        db=db,
        coupon_code=request.coupon_code,
        user_id=current_user.id,
        plan_type=request.plan_type,
        plan_id=request.plan_id,
        amount=request.amount,
    )
    return ApplyCouponResponse(
        valid=valid,
        discount=discount,
        final_amount=final_amount,
        message=message,
    )


# ══════════════════════════════════════════════════════════════
# ADMIN: PRICING MANAGEMENT
# ══════════════════════════════════════════════════════════════

@router.post("/admin/plans", response_model=SubscriptionPlanResponse)
def create_plan(
    plan: SubscriptionPlanCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Create a new subscription plan."""
    db_plan = SubscriptionPlan(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.put("/admin/plans/{plan_id}", response_model=SubscriptionPlanResponse)
def update_plan(
    plan_id: str,
    plan_update: SubscriptionPlanUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Update a subscription plan (pricing, features, etc.)."""
    db_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = plan_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_plan, key, value)

    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.post("/admin/micro-plans", response_model=MicroPlanResponse)
def create_micro_plan(
    plan: MicroPlanCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Create a new micro plan."""
    db_plan = MicroPlan(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.put("/admin/micro-plans/{plan_id}", response_model=MicroPlanResponse)
def update_micro_plan(
    plan_id: str,
    plan_update: MicroPlanUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Update a micro plan."""
    db_plan = db.query(MicroPlan).filter(MicroPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="Micro plan not found")

    update_data = plan_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_plan, key, value)

    db.commit()
    db.refresh(db_plan)
    return db_plan


# ══════════════════════════════════════════════════════════════
# ADMIN: COUPON MANAGEMENT
# ══════════════════════════════════════════════════════════════

@router.get("/admin/coupons", response_model=List[CouponResponse])
def list_coupons(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: List all coupons."""
    return db.query(Coupon).order_by(Coupon.created_at.desc()).all()


@router.post("/admin/coupons", response_model=CouponResponse)
def create_coupon(
    coupon: CouponCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Create a new coupon."""
    # Ensure code is uppercase
    coupon_data = coupon.model_dump()
    coupon_data["code"] = coupon_data["code"].upper()
    coupon_data["created_by"] = admin.id

    existing = db.query(Coupon).filter(Coupon.code == coupon_data["code"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")

    db_coupon = Coupon(**coupon_data)
    db.add(db_coupon)
    db.commit()
    db.refresh(db_coupon)
    return db_coupon


@router.put("/admin/coupons/{coupon_id}", response_model=CouponResponse)
def update_coupon(
    coupon_id: str,
    coupon_update: CouponUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Update a coupon."""
    db_coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    update_data = coupon_update.model_dump(exclude_unset=True)
    if "code" in update_data:
        update_data["code"] = update_data["code"].upper()

    for key, value in update_data.items():
        setattr(db_coupon, key, value)

    db.commit()
    db.refresh(db_coupon)
    return db_coupon


@router.delete("/admin/coupons/{coupon_id}")
def disable_coupon(
    coupon_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: Disable a coupon (soft delete)."""
    db_coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    db_coupon.is_active = False
    db.commit()
    return {"message": "Coupon disabled"}


# ══════════════════════════════════════════════════════════════
# ADMIN: TRANSACTION MONITORING
# ══════════════════════════════════════════════════════════════

@router.get("/admin/transactions", response_model=List[PaymentTransactionResponse])
def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin: List all payment transactions."""
    query = db.query(PaymentTransaction).order_by(PaymentTransaction.created_at.desc())

    if status_filter:
        query = query.filter(PaymentTransaction.status == status_filter)

    return query.offset(skip).limit(limit).all()


# ══════════════════════════════════════════════════════════════
# ADMIN: USER SUBSCRIPTION MANAGEMENT
# ══════════════════════════════════════════════════════════════

@router.post("/admin/manage-subscription")
def manage_user_subscription(
    request: AdminManageSubscriptionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_black_admin),
):
    """Super Admin: Upgrade, downgrade, cancel, or extend a user's subscription."""
    import uuid
    try:
        target_user_id = uuid.UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = admin_manage_subscription(
        db=db,
        target_user_id=target_user_id,
        action=request.action,
        stage=request.stage,
        days=request.days,
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Action failed"))

    return result
