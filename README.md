# VitaminPScope — AI Digital Pathology Viewer for Whole-Slide Images (WSI)
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

## ✨ Overview

**VitaminPScope** is an AI-powered digital pathology platform for viewing whole-slide images (WSI) and performing whole-cell segmentation using deep learning.

It supports SVS, OME-TIFF, and multi-channel microscopy, and runs locally with Docker in a single command.

- Whole-slide image (WSI) viewing  
- Multi-channel microscopy visualization  
- Slide comparison and annotation  
- Integrated **VitaminP AI segmentation**

Built with **React + FastAPI + OpenSeadragon + Viv** — designed for **fast, real-world deployment**.

---

# 🚀 Quick Start

### 1. Clone repository

```bash
git clone https://github.com/idso-fa1-pathology/VitaminPScope.git
```

### 2. Move into project

```bash
cd VitaminPScope
```

### 3. Launch the app

```bash
docker compose -f docker-compose.public.yml up -d
```

---

## 🌐 Open the app

Once running, open in your browser:

👉 **http://localhost:3000**

---

## 📂 Data

Place your slides in:

```
./data/
```

**Supported formats:**
- SVS  
- NDPI  
- TIFF / OME-TIFF  

---

## 🧠 AI Model

The **VitaminP model is already included** inside the Docker image.

✅ No downloads  
✅ No configuration  
✅ Ready out of the box  

---

## 🛠 Tech Stack

- **Frontend:** React + Vite  
- **Backend:** FastAPI  
- **Viewer:** OpenSeadragon + Viv  
- **Deployment:** Docker  

---
## 🔍 Keywords

digital pathology, WSI viewer, whole-slide image viewer, pathology AI, cell segmentation, histopathology, H&E analysis, multiplex imaging, computational pathology, FastAPI, React viewer

## 📄 License

MIT License
