FROM python:3.11-slim

WORKDIR /app

RUN echo "rebuild $(date)" > /rebuild_marker

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD sh -c "uvicorn server:app --host 0.0.0.0 --port $PORT"
