from pydantic import BaseModel, EmailStr, Field

class OTPRequest(BaseModel):
    email: EmailStr

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=8)
