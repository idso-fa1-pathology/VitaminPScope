FROM python:3.10-slim
WORKDIR /app

# Install OpenSlide system libraries required for reading .svs files
RUN apt-get update && apt-get install -y openslide-tools libgl1-mesa-glx && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .