# CineAI backend (FastAPI). Built by Render from this folder; also runs anywhere Docker does.
FROM python:3.13-slim

# ffmpeg: joins scene clips into the full film. The PDF fonts ship in app/fonts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
COPY portraits ./portraits

# Run as a normal user, not root
RUN useradd --create-home cineai && chown -R cineai /app
USER cineai

EXPOSE 8000
# Bring the database up to date, then start the API. One process: film jobs run inside it.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
