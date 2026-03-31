# VitaminPScope

**Interactive digital pathology platform for whole-slide visualization and AI-powered cell segmentation.**

---

## Overview

VitaminPScope is a lightweight web-based platform for:

- Whole-slide image (WSI) viewing  
- Multi-channel microscopy visualization  
- Slide comparison and annotation  
- Integration with VitaminP AI models  

Built with React, FastAPI, OpenSeadragon, and Viv.

---

## 🚀 Quick Start (Docker)

### 1. Install Docker
https://docs.docker.com/get-docker/

### 2. Run the app

```bash
mkdir vitaminpscope
cd vitaminpscope

curl -O https://raw.githubusercontent.com/idso-fa1-pathology/VitaminPScope/main/docker-compose.public.yml

docker compose up -d
```

### 3. Open in browser

http://localhost:3000

---

## 📂 Data

Place your slides in:

```
./data/
```

Supported formats:
- SVS
- NDPI
- TIFF / OME-TIFF

---

## 🧠 AI Model

The VitaminP model is **already included in the Docker image**.  
No additional setup required.

---

## 🛠 Tech Stack

- Frontend: React + Vite
- Backend: FastAPI
- Viewer: OpenSeadragon + Viv
- Deployment: Docker

---

## License

MIT License
