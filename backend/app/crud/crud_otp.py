from sqlalchemy.orm import Session
from app.models.otp import OTP
from datetime import datetime, timezone
from app.core.security import get_password_hash

def create_otp(db: Session, email: str, otp_code: str, expires_at: datetime, user_data: dict = None):
    # Invalidate previous OTPs for this email? Or just create new one.
    # Ideally, we should maybe mark old ones as used or expired.
    # For now, let's just create a new record.
    hashed_otp = get_password_hash(otp_code)

    # SQLite compatibility: don't pass id for auto-increment
    db_otp = OTP(
        email=email,
        hashed_otp=hashed_otp,
        expires_at=expires_at,
        created_at=datetime.now(timezone.utc),
        attempts=0,
        is_used=False,
        user_data=user_data
    )
    db.add(db_otp)
    db.commit()
    db.refresh(db_otp)
    return db_otp

def get_latest_otp(db: Session, email: str):
    return db.query(OTP).filter(OTP.email == email).order_by(OTP.created_at.desc()).first()

def mark_otp_as_used(db: Session, otp: OTP):
    otp.is_used = True
    db.commit()

def increment_attempts(db: Session, otp: OTP):
    otp.attempts += 1
    db.commit()
