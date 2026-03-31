# VitaminPScope

**Interactive digital pathology platform for whole-slide visualization and AI-powered whole-cell segmentation.**

<div align="center">

[🐳 Docker](#-quick-start) • [🐛 Issues](https://github.com/idso-fa1-pathology/VitaminPScope/issues)

</div>

---

<p align="center">
  <img src="./docs/figures/main.png"/>
</p>

---

## Overview

VitaminPScope is a lightweight web-based platform for:

- Whole-slide image (WSI) viewing  
- Multi-channel microscopy visualization  
- Slide comparison and annotation  
- Integration with **VitaminP AI models**  

Built with **React + FastAPI + OpenSeadragon + Viv**.

---

# 🚀 Quick Start

### 1. Install Docker  
https://docs.docker.com/get-docker/

---

### 2. Run VitaminPScope

```bash
git clone https://github.com/idso-fa1-pathology/VitaminPScope.git
cd VitaminPScope

docker compose -f docker-compose.public.yml up -d
```

---

### 3. Open in browser

👉 http://localhost:3000

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

The **VitaminP model is already included** in the Docker image.  
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
