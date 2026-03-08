from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def root():
    return {
        "status": "AI Service Online",
        "service": "VitaminP Inference Service"
    }

@router.get("/health")
def health_check():
    return {
        "status": "ok"
    }