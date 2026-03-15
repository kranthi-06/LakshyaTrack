"""
Pydantic schemas for subscription, micro-plan, coupon, and payment systems.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4
from datetime import datetime


# ══════════════════════════════════════════════════════════════
# SUBSCRIPTION PLAN SCHEMAS
# ══════════════════════════════════════════════════════════════

class SubscriptionPlanBase(BaseModel):
    name: str
    stage: int
    billing_cycle: str  # "monthly" | "yearly"
    price: float
    currency: str = "INR"
    features: List[str] = []
    resume_limit: int = 1
    roadmap_limit: int = 1
    is_recommended: bool = False
    is_active: bool = True


class SubscriptionPlanCreate(SubscriptionPlanBase):
    pass


class SubscriptionPlanUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    features: Optional[List[str]] = None
    resume_limit: Optional[int] = None
    roadmap_limit: Optional[int] = None
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
    name: str
    feature_key: str
    price: float
    currency: str = "INR"
    duration_hours: Optional[float] = None
    usage_type: str = "time_limited"
    description: Optional[str] = None
    is_active: bool = True


class MicroPlanCreate(MicroPlanBase):
    pass


class MicroPlanUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    duration_hours: Optional[float] = None
    description: Optional[str] = None
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
    code: str
    discount_type: str  # "percentage" | "fixed"
    discount_value: float
    max_uses: Optional[int] = None
    applicable_to: str = "all"
    applicable_plan_id: Optional[UUID4] = None
    min_amount: float = 0
    max_discount: Optional[float] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    code: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    max_uses: Optional[int] = None
    applicable_to: Optional[str] = None
    min_amount: Optional[float] = None
    max_discount: Optional[float] = None
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
    coupon_code: str
    plan_type: str  # "subscription" | "micro"
    plan_id: UUID4
    amount: float


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
    plan_type: str  # "subscription" | "micro"
    coupon_code: Optional[str] = None


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
    gateway_payment_id: Optional[str] = None
    gateway_order_id: Optional[str] = None
    gateway_signature: Optional[str] = None


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
    user_id: str
    action: str  # "upgrade" | "downgrade" | "cancel" | "extend"
    stage: Optional[int] = None
    days: Optional[int] = None
