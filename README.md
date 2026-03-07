# VitaminPScope

**VitaminPScope** is a lightweight web-based digital pathology viewer designed for exploring large whole-slide images and multichannel microscopy data. It supports modern slide formats, fast multiscale rendering, and interactive annotation tools for research and diagnostic workflows.

The application is built as a modular full-stack system using **React**, **FastAPI**, **OpenSeadragon**, and **Viv**, and runs easily with **Docker Compose**.

---

## Features

* **Whole-slide viewing**

  * SVS / NDPI using **OpenSeadragon**
  * OME-TIFF multichannel images using **Viv**

* **Multichannel exploration**

  * Toggle channels
  * Change channel color and opacity
  * Real-time compositing

* **Annotation tools**

  * Points
  * Lines
  * Rectangles
  * Measurements
  * Select / edit annotations

* **Interactive viewer tools**

  * Pan / zoom
  * Scale bar
  * Measurement overlay

* **Architecture**

  * React + Vite frontend
  * FastAPI backend
  * AI service placeholder for analysis pipelines
  * Dockerized deployment

---

## Project Structure

```
VitaminPScope
├── frontend          React + Vite viewer UI
├── backend           FastAPI slide API
├── ai_service        Optional AI analysis service
├── data              Sample slides
└── docker-compose.yml
```

---

## Supported Formats

* **SVS** (Aperio)
* **NDPI** (Hamamatsu)
* **OME-TIFF** (multichannel microscopy)

---

## Running the Application

### Requirements

* Docker
* Docker Compose

### Start the stack

```bash
docker compose up --build
```

Open the viewer in your browser:

```
http://localhost:5173
```

---

## Annotation Workflow

1. Open a slide
2. Select an annotation tool
3. Draw directly on the image
4. Use **Select mode** to edit or move annotations
5. Delete annotations using the **Delete key** or toolbar

---

## Tech Stack

Frontend

* React
* Vite
* DeckGL
* Viv
* OpenSeadragon

Backend

* FastAPI
* Python

Deployment

* Docker
* Docker Compose

---

## Future Extensions

* AI-assisted segmentation
* Annotation export (JSON / GeoJSON)
* Collaborative review
* Cloud storage support

---

## License

MIT License
