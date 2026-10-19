"""Payment, coupon, and entitlement regression tests against a real SQLite DB."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base_class import Base
from app.models.subscription import (
    Coupon,
    CouponUsage,
    MicroPlan,
    PaymentTransaction,
    SubscriptionPlan,
    UserMicroPurchase,
    UserSubscription,
)
from app.services import subscription_service


@compiles(UUID, "sqlite")
def _compile_uuid_for_sqlite(_type, _compiler, **_kwargs):
    return "CHAR(36)"


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        engine,
        tables=[
            SubscriptionPlan.__table__,
            MicroPlan.__table__,
            Coupon.__table__,
            CouponUsage.__table__,
            UserSubscription.__table__,
            UserMicroPurchase.__table__,
            PaymentTransaction.__table__,
        ],
    )
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def demo_mode(monkeypatch):
    monkeypatch.setattr(subscription_service.settings, "APP_ENV", "development")
    monkeypatch.setattr(subscription_service.settings, "PAYMENTS_DEMO_MODE", True)


def _add_plan(db, price=100.0, currency="INR", stage=1, billing_cycle="monthly"):
    plan = SubscriptionPlan(
        name=f"Stage {stage}",
        stage=stage,
        billing_cycle=billing_cycle,
        price=price,
        currency=currency,
        is_active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _add_micro_plan(db, price=25.0, duration_hours=24):
    plan = MicroPlan(
        name="Resume Download",
        feature_key="resume_download",
        price=price,
        currency="INR",
        duration_hours=duration_hours,
        is_active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _add_coupon(
    db,
    *,
    code="SAVE10",
    discount_type="percentage",
    discount_value=10,
    max_uses=None,
    times_used=0,
    expires_at=None,
):
    coupon = Coupon(
        code=code,
        discount_type=discount_type,
        discount_value=discount_value,
        max_uses=max_uses,
        times_used=times_used,
        applicable_to="all",
        min_amount=0,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


def _checkout(db, user_id, plan, plan_type="subscription", coupon_code=None):
    return subscription_service.create_checkout(
        db, user_id, plan.id, plan_type, coupon_code=coupon_code
    )


def _verify(db, txn, user_id):
    return subscription_service.verify_payment_and_activate(db, txn.id, user_id)


def test_verification_is_idempotent_and_creates_one_entitlement(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db)
    txn = _checkout(db, user_id, plan)

    first = _verify(db, txn, user_id)
    second = _verify(db, txn, user_id)

    assert first["success"] is True
    assert "already_processed" not in first
    assert second == {
        "success": True,
        "message": "Payment already processed",
        "already_processed": True,
    }
    assert db.query(UserSubscription).filter_by(user_id=user_id).count() == 1
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "success"


def test_verification_rejects_a_different_owner_without_mutation(db):
    owner_id = uuid.uuid4()
    attacker_id = uuid.uuid4()
    plan = _add_plan(db)
    txn = _checkout(db, owner_id, plan)

    result = _verify(db, txn, attacker_id)

    assert result == {"success": False, "message": "Transaction not found"}
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "pending"
    assert db.query(UserSubscription).count() == 0


def test_verification_rejects_tampered_amount(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db, price=100.0)
    txn = _checkout(db, user_id, plan)
    txn.amount = 1.0
    txn.final_amount = 1.0
    db.commit()

    result = _verify(db, txn, user_id)

    assert result["success"] is False
    assert "no longer matches" in result["message"]
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "pending"
    assert db.query(UserSubscription).count() == 0


def test_verification_rejects_currency_mismatch(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db, price=100.0, currency="INR")
    txn = _checkout(db, user_id, plan)
    txn.currency = "USD"
    db.commit()

    result = _verify(db, txn, user_id)

    assert result["success"] is False
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "pending"
    assert db.query(UserSubscription).count() == 0


def test_verification_rejects_coupon_that_expired_after_checkout(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db, price=100.0)
    coupon = _add_coupon(db, expires_at=datetime.now(timezone.utc) + timedelta(days=1))
    txn = _checkout(db, user_id, plan, coupon_code=coupon.code)

    coupon.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()

    result = _verify(db, txn, user_id)

    assert result["success"] is False
    assert "expired" in result["message"].lower()
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "pending"
    assert db.query(UserSubscription).count() == 0


def test_verification_rejects_coupon_exhausted_by_another_checkout(db):
    first_user = uuid.uuid4()
    second_user = uuid.uuid4()
    plan = _add_plan(db, price=100.0)
    coupon = _add_coupon(db, max_uses=1)
    first_txn = _checkout(db, first_user, plan, coupon_code=coupon.code)
    second_txn = _checkout(db, second_user, plan, coupon_code=coupon.code)

    first = _verify(db, first_txn, first_user)
    second = _verify(db, second_txn, second_user)

    assert first["success"] is True
    assert second["success"] is False
    assert "no longer" in second["message"].lower() or "used" in second["message"].lower()
    assert db.query(UserSubscription).filter_by(user_id=first_user).count() == 1
    assert db.query(UserSubscription).filter_by(user_id=second_user).count() == 0
    assert db.query(Coupon).filter_by(id=coupon.id).one().times_used == 1
    assert db.query(CouponUsage).filter_by(coupon_id=coupon.id).count() == 1
    assert db.query(PaymentTransaction).filter_by(id=second_txn.id).one().status == "pending"


def test_verification_rejects_changed_coupon_terms(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db, price=100.0)
    coupon = _add_coupon(db, discount_value=10)
    txn = _checkout(db, user_id, plan, coupon_code=coupon.code)

    coupon.discount_value = 50
    db.commit()

    result = _verify(db, txn, user_id)

    assert result["success"] is False
    assert "terms changed" in result["message"]
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "pending"
    assert db.query(UserSubscription).count() == 0


def test_verification_redeems_coupon_once_with_the_discount(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db, price=100.0)
    coupon = _add_coupon(db, discount_value=10)
    txn = _checkout(db, user_id, plan, coupon_code=coupon.code)

    assert txn.discount == pytest.approx(10.0)
    assert txn.final_amount == pytest.approx(90.0)

    result = _verify(db, txn, user_id)
    repeated = _verify(db, txn, user_id)

    assert result["success"] is True
    assert repeated.get("already_processed") is True
    subscription = db.query(UserSubscription).filter_by(user_id=user_id).one()
    assert subscription.coupon_id == coupon.id
    assert subscription.amount_paid == pytest.approx(90.0)
    assert db.query(Coupon).filter_by(id=coupon.id).one().times_used == 1
    assert db.query(CouponUsage).filter_by(coupon_id=coupon.id).count() == 1


def test_losing_the_atomic_claim_returns_already_processed(db, monkeypatch):
    user_id = uuid.uuid4()
    plan = _add_plan(db)
    txn = _checkout(db, user_id, plan)
    real_resolve = subscription_service._resolve_plan

    def resolve_then_simulate_other_worker(database, plan_id, plan_type):
        resolved = real_resolve(database, plan_id, plan_type)
        database.query(PaymentTransaction).filter(
            PaymentTransaction.id == txn.id
        ).update({"status": "success"}, synchronize_session=False)
        database.commit()
        return resolved

    monkeypatch.setattr(
        subscription_service, "_resolve_plan", resolve_then_simulate_other_worker
    )

    result = _verify(db, txn, user_id)

    assert result.get("already_processed") is True
    assert db.query(UserSubscription).count() == 0


def test_activation_expires_the_previous_active_subscription(db):
    user_id = uuid.uuid4()
    old_plan = _add_plan(db, stage=1)
    new_plan = _add_plan(db, price=200.0, stage=2)
    db.add(
        UserSubscription(
            user_id=user_id,
            plan_id=old_plan.id,
            stage=1,
            status="active",
            expires_at=datetime.now(timezone.utc) + timedelta(days=10),
        )
    )
    db.commit()
    txn = _checkout(db, user_id, new_plan)

    result = _verify(db, txn, user_id)

    assert result["success"] is True
    active = (
        db.query(UserSubscription)
        .filter_by(user_id=user_id, status="active")
        .all()
    )
    assert len(active) == 1
    assert active[0].plan_id == new_plan.id


def test_micro_purchase_activates_once(db):
    user_id = uuid.uuid4()
    plan = _add_micro_plan(db)
    txn = _checkout(db, user_id, plan, plan_type="micro")

    first = _verify(db, txn, user_id)
    second = _verify(db, txn, user_id)

    assert first["success"] is True
    assert second.get("already_processed") is True
    purchases = db.query(UserMicroPurchase).filter_by(user_id=user_id).all()
    assert len(purchases) == 1
    assert purchases[0].feature_key == "resume_download"


def test_missing_plan_fails_without_mutation(db):
    user_id = uuid.uuid4()
    plan = _add_plan(db)
    txn = _checkout(db, user_id, plan)
    db.query(SubscriptionPlan).filter_by(id=plan.id).delete()
    db.commit()

    result = _verify(db, txn, user_id)

    assert result == {"success": False, "message": "Subscription plan not found"}
    assert db.query(PaymentTransaction).filter_by(id=txn.id).one().status == "pending"


def test_production_demo_checkout_and_verification_fail_closed(db, monkeypatch):
    monkeypatch.setattr(subscription_service.settings, "APP_ENV", "production")
    monkeypatch.setattr(subscription_service.settings, "PAYMENTS_DEMO_MODE", True)
    user_id = uuid.uuid4()
    plan = _add_plan(db)

    with pytest.raises(subscription_service.PaymentUnavailableError):
        _checkout(db, user_id, plan)

    result = subscription_service.verify_payment_and_activate(
        db, uuid.uuid4(), user_id
    )

    assert result == {
        "success": False,
        "message": "Online payment verification is not configured yet.",
    }
    assert db.query(PaymentTransaction).count() == 0
    assert db.query(UserSubscription).count() == 0


def test_model_uniqueness_constraints_are_declared():
    coupon_constraints = {c.name for c in CouponUsage.__table__.constraints}
    transaction_constraints = {
        c.name for c in PaymentTransaction.__table__.constraints
    }

    assert "uq_coupon_usages_coupon_user" in coupon_constraints
    assert (
        "uq_payment_transactions_gateway_payment_id" in transaction_constraints
    )
