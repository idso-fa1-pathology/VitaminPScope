# VitaminPScope

**Production-ready digital pathology app for whole-slide visualization and AI-powered cell segmentation.**

<div align="center">

🚀 **Run in one command — no setup, no configuration**

[🐳 Docker](#-quick-start) • [🐛 Issues](https://github.com/idso-fa1-pathology/VitaminPScope/issues)

</div>

---

<p align="center">
  <img src="./docs/figures/main.png"/>
</p>

---

## Overview

**VitaminPScope** is a lightweight, web-based platform for:

- Whole-slide image (WSI) viewing  
- Multi-channel microscopy visualization  
- Slide comparison and annotation  
- Integrated **VitaminP AI segmentation**

Built with **React + FastAPI + OpenSeadragon + Viv**, designed for fast deployment and real-world usage.

---

# 🚀 Quick Start

### Run the full app in one command

```bash
docker compose -f docker-compose.public.yml up -d
```

Then open:

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
No setup, no downloads — ready out of the box.

---

## 🛠 Tech Stack

- Frontend: React + Vite  
- Backend: FastAPI  
- Viewer: OpenSeadragon + Viv  
- Deployment: Docker  

---

## License

MIT License
