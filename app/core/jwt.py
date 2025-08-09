import jwt
from datetime import datetime, timedelta
from core.settings import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXP_DELTA_SECONDS

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(seconds=JWT_EXP_DELTA_SECONDS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
