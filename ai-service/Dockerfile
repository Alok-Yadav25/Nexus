FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock.txt .
RUN pip install --no-cache-dir -r requirements.lock.txt && useradd -m -u 10001 nexus && mkdir /data && chown nexus /data
COPY app app
USER nexus
ENV CHECKPOINT_PATH=/data/checkpoints.sqlite HF_HOME=/data/models PROVIDER_BUDGET_PATH=/data/provider-budget.sqlite
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
