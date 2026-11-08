FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home audit
COPY *.py schema.sql ./
USER audit
EXPOSE 8090
CMD ["python", "service.py"]
