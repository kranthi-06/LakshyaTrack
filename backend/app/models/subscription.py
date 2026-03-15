"""
Subscription & Feature Access Models
Supports stage-based subscriptions, micro-plan purchases, coupons, and payment tracking.
"""
import uuid
from sqlalchemy import (
    Boolean, Column, String, DateTime, Float, Integer,
    ForeignKey, Text, Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class SubscriptionPlan(Base):
    """Defines available subscription tiers (Stage 1 / 2 / 3)."""
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)                      # e.g. "Stage 1", "Stage 2", "Stage 3"
    stage = Column(Integer, nullable=False)                    # 1, 2, 3
    billing_cycle = Column(String, nullable=False)             # "monthly" | "yearly"
    price = Column(Float, nullable=False)                      # in INR
    currency = Column(String, default="INR")
    features = Column(JSONB, default=[])                       # list of feature descriptions
    resume_limit = Column(Integer, default=1)                  # max resumes allowed
    roadmap_limit = Column(Integer, default=1)                 # max roadmaps allowed
    is_recommended = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class MicroPlan(Base):
    """Short-duration feature-specific purchases."""
    __tablename__ = "micro_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)                      # e.g. "Resume Download Access"
    feature_key = Column(String, nullable=False)               # e.g. "resume_download", "roadmap_generate", "interview_attempt"
    price = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    duration_hours = Column(Float, nullable=True)              # null = single-use
    usage_type = Column(String, default="time_limited")        # "time_limited" | "single_use"
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserSubscription(Base):
    """Active or past user subscriptions."""
    __tablename__ = "user_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    stage = Column(Integer, nullable=False)
    status = Column(String, default="active")                  # "active" | "expired" | "cancelled"
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=True)
    amount_paid = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("SubscriptionPlan")


class UserMicroPurchase(Base):
    """User's micro plan purchases with expiry tracking."""
    __tablename__ = "user_micro_purchases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    micro_plan_id = Column(UUID(as_uuid=True), ForeignKey("micro_plans.id"), nullable=False)
    feature_key = Column(String, nullable=False)
    status = Column(String, default="active")                  # "active" | "expired" | "used"
    activated_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)  # null for single-use
    used = Column(Boolean, default=False)                      # for single-use plans
    amount_paid = Column(Float, nullable=True)
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    micro_plan = relationship("MicroPlan")


class Coupon(Base):
    """Discount coupons for plans and micro plans."""
    __tablename__ = "coupons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False, index=True)
    discount_type = Column(String, nullable=False)             # "percentage" | "fixed"
    discount_value = Column(Float, nullable=False)             # e.g. 20 (%) or 50 (₹)
    max_uses = Column(Integer, nullable=True)                  # null = unlimited
    times_used = Column(Integer, default=0)
    applicable_to = Column(String, default="all")              # "all" | "subscription" | "micro"
    applicable_plan_id = Column(UUID(as_uuid=True), nullable=True)  # restrict to specific plan
    min_amount = Column(Float, default=0)
    max_discount = Column(Float, nullable=True)                # cap on discount amount
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CouponUsage(Base):
    """Tracks which users have used which coupons."""
    __tablename__ = "coupon_usages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_type = Column(String, nullable=False)                 # "subscription" | "micro"
    discount_applied = Column(Float, nullable=False)
    used_at = Column(DateTime(timezone=True), server_default=func.now())

    coupon = relationship("Coupon")


class PaymentTransaction(Base):
    """Records all payment attempts and completions."""
    __tablename__ = "payment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    order_type = Column(String, nullable=False)                # "subscription" | "micro"
    plan_id = Column(UUID(as_uuid=True), nullable=True)        # subscription_plan or micro_plan id
    plan_name = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    discount = Column(Float, default=0)
    final_amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    coupon_code = Column(String, nullable=True)
    payment_gateway = Column(String, nullable=True)            # "razorpay" | "stripe" | "demo"
    gateway_order_id = Column(String, nullable=True)
    gateway_payment_id = Column(String, nullable=True)
    status = Column(String, default="pending")                 # "pending" | "success" | "failed" | "refunded"
    metadata = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
