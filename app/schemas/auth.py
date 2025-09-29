from pydantic import BaseModel, ConfigDict


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
    model_config = ConfigDict(from_attributes=True)


class OAuthRequest(BaseModel):
    provider: str  # e.g., 'google', 'github'
    access_token: str
