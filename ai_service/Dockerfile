FROM python:3.10-slim

WORKDIR /app
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    openslide-tools \
    libopenslide0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/checkpoints /app/outputs /app/logs

RUN curl -L "https://huggingface.co/idso-fa1-pathology/VitaminP/resolve/main/vitamin_p_flex.pth" \
    -o /app/checkpoints/vitamin_p_flex.pth

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]