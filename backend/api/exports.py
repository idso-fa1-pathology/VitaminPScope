from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response

from services.export_service import export_job

router = APIRouter(tags=["exports"])


@router.get("/exports/{job_id}")
def export_results(
    job_id: str,
    format: str = Query(default="geojson"),
):
    try:
        result = export_job(job_id, format)

        if format == "csv":
            return Response(
                content=result,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="roi_{job_id}.csv"'},
            )

        if format == "parquet":
            return Response(
                content=result,
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="roi_{job_id}.parquet"'},
            )

        if format == "png":
            if not isinstance(result, dict) or result.get("kind") != "file":
                raise ValueError("Invalid file export result")

            return FileResponse(
                path=result["path"],
                media_type=result.get("media_type", "application/octet-stream"),
                filename=result.get("filename", f"roi_{job_id}"),
            )

        return JSONResponse(content=result)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))