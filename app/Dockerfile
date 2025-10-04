FROM python:3.11-slim

# Keep project sources under /srv/app but expose /srv to Python so the
# package-level imports (e.g. `from app.models import Base`) resolve even when
# the working directory sits inside the package directory.
WORKDIR /srv/app

COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt

COPY . .

ENV PYTHONPATH=/srv

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
