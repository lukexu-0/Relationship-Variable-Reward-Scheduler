FROM python:3.12-slim AS runner
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/scheduler-py/pyproject.toml ./pyproject.toml
COPY apps/scheduler-py/src ./src

RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "scheduler_py.main:app", "--host", "0.0.0.0", "--port", "8000"]
