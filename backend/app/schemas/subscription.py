"""
Pydantic schemas for subscription, micro-plan, coupon, and payment systems.
"""
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, UUID4, Field
from datetime import datetime


# ══════════════════════════════════════════════════════════════
# SUBSCRIPTION PLAN SCHEMAS
# ══════════════════════════════════════════════════════════════

class SubscriptionPlanBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    stage: int = Field(ge=1, le=3)
    billing_cycle: Literal["monthly", "yearly"]
    price: float = Field(ge=0, le=10_000_000)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    features: List[str] = []
    resume_limit: int = Field(default=1, ge=-1, le=100_000)
    roadmap_limit: int = Field(default=1, ge=-1, le=100_000)
    is_recommended: bool = False
    is_active: bool = True


class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    price: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    features: Optional[List[str]] = None
    resume_limit: Optional[int] = Field(default=None, ge=-1, le=100_000)
    roadmap_limit: Optional[int] = Field(default=None, ge=-1, le=100_000)
    is_recommended: Optional[bool] = None
    is_active: Optional[bool] = None


class SubscriptionPlanResponse(SubscriptionPlanBase):
    id: UUID4
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════
# MICRO PLAN SCHEMAS
# ══════════════════════════════════════════════════════════════

class MicroPlanBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    feature_key: str = Field(min_length=1, max_length=80)
    price: float = Field(ge=0, le=10_000_000)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    duration_hours: Optional[float] = Field(default=None, ge=0, le=8760)
    usage_type: Literal["time_limited", "single_use"] = "time_limited"
    description: Optional[str] = Field(default=None, max_length=2000)
    is_active: bool = True


class MicroPlanCreate(MicroPlanBase):
    pass


class MicroPlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    price: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    duration_hours: Optional[float] = Field(default=None, ge=0, le=8760)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None


class MicroPlanResponse(MicroPlanBase):
    id: UUID4
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════
# USER SUBSCRIPTION SCHEMAS
# ══════════════════════════════════════════════════════════════

class UserSubscriptionResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    plan_id: UUID4
    stage: int
    status: str
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    amount_paid: Optional[float] = None
    plan: Optional[SubscriptionPlanResponse] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════
# USER MICRO PURCHASE SCHEMAS
# ══════════════════════════════════════════════════════════════

class UserMicroPurchaseResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    micro_plan_id: UUID4
    feature_key: str
    status: str
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    used: bool = False
    amount_paid: Optional[float] = None
    micro_plan: Optional[MicroPlanResponse] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════
# FEATURE ACCESS SCHEMAS
# ══════════════════════════════════════════════════════════════

class FeatureAccessResponse(BaseModel):
    """Complete feature access state for the current user."""
    stage: int = 0
    is_admin: bool = False
    subscription: Optional[UserSubscriptionResponse] = None
    active_micro_purchases: List[UserMicroPurchaseResponse] = []
    features: Dict[str, bool] = {}  # feature_key -> is_accessible
    feature_expires: Dict[str, Optional[str]] = {}  # feature_key -> expiry ISO string


# ══════════════════════════════════════════════════════════════
# COUPON SCHEMAS
# ══════════════════════════════════════════════════════════════

class CouponBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    discount_type: Literal["percentage", "fixed"]
    discount_value: float = Field(gt=0, le=10_000_000)
    max_uses: Optional[int] = Field(default=None, ge=1, le=10_000_000)
    applicable_to: Literal["all", "subscription", "micro"] = "all"
    applicable_plan_id: Optional[UUID4] = None
    min_amount: float = Field(default=0, ge=0, le=10_000_000)
    max_discount: Optional[float] = Field(default=None, gt=0, le=10_000_000)
    expires_at: Optional[datetime] = None
    is_active: bool = True


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    discount_type: Optional[Literal["percentage", "fixed"]] = None
    discount_value: Optional[float] = Field(default=None, gt=0, le=10_000_000)
    max_uses: Optional[int] = Field(default=None, ge=1, le=10_000_000)
    applicable_to: Optional[Literal["all", "subscription", "micro"]] = None
    min_amount: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    max_discount: Optional[float] = Field(default=None, gt=0, le=10_000_000)
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class CouponResponse(CouponBase):
    id: UUID4
    times_used: int = 0
    created_by: Optional[UUID4] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApplyCouponRequest(BaseModel):
    coupon_code: str = Field(min_length=1, max_length=64)
    plan_type: Literal["subscription", "micro"]
    plan_id: UUID4
    # Retained for wire compatibility; the server derives the amount from the plan.
    amount: Optional[float] = Field(default=None, ge=0)


class ApplyCouponResponse(BaseModel):
    valid: bool
    discount: float = 0
    final_amount: float = 0
    message: str = ""


# ══════════════════════════════════════════════════════════════
# CHECKOUT & PAYMENT SCHEMAS
# ══════════════════════════════════════════════════════════════

class CheckoutRequest(BaseModel):
    plan_id: UUID4
    plan_type: Literal["subscription", "micro"]
    coupon_code: Optional[str] = Field(default=None, max_length=64)


class CheckoutResponse(BaseModel):
    transaction_id: UUID4
    order_type: str
    plan_name: str
    amount: float
    discount: float
    final_amount: float
    currency: str = "INR"
    status: str = "pending"
    # Demo mode: auto-complete payment
    demo_payment_url: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    transaction_id: UUID4
    # For real gateway integration:
    gateway_payment_id: Optional[str] = Field(default=None, max_length=255)
    gateway_order_id: Optional[str] = Field(default=None, max_length=255)
    gateway_signature: Optional[str] = Field(default=None, max_length=512)


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    subscription: Optional[UserSubscriptionResponse] = None
    micro_purchase: Optional[UserMicroPurchaseResponse] = None


# ══════════════════════════════════════════════════════════════
# PAYMENT TRANSACTION SCHEMAS
# ══════════════════════════════════════════════════════════════

class PaymentTransactionResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    order_type: str
    plan_name: Optional[str] = None
    amount: float
    discount: float
    final_amount: float
    currency: str
    coupon_code: Optional[str] = None
    payment_gateway: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════
# ADMIN SCHEMAS
# ══════════════════════════════════════════════════════════════

class AdminManageSubscriptionRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    action: Literal["upgrade", "downgrade", "cancel", "extend"]
    stage: Optional[int] = Field(default=None, ge=1, le=3)
    days: Optional[int] = Field(default=None, ge=1, le=3650)
