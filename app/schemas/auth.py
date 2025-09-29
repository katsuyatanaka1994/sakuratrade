from pydantic import BaseModel


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


# User model
class User(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        orm_mode = True


class OAuthRequest(BaseModel):
    provider: str  # e.g., 'google', 'github'
    access_token: str
