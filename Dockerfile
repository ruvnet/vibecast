FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 VIBECAST_DATA=/app/data
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 studio
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY studio ./studio
COPY web ./web
RUN mkdir -p /app/data && chown -R studio:studio /app/data
USER studio
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import os,urllib.request; r=urllib.request.Request('http://127.0.0.1:8000/healthz',headers={'Host':__import__('urllib.parse',fromlist=['urlsplit']).urlsplit(os.environ.get('VIBECAST_ORIGIN','http://127.0.0.1:8000')).netloc}); urllib.request.urlopen(r,timeout=3)"
CMD ["python","-m","uvicorn","studio.app:app","--host","0.0.0.0","--port","8000","--workers","1","--no-proxy-headers"]
