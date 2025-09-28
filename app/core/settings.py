import os

from dotenv import load_dotenv

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXP_DELTA_SECONDS = 3600  # 1時間
