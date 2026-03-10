const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export async function runRoiSegmentation({
  slidePath,
  roi,
  mode = "he",
  modelName = "flex",
  checkpointName = null,
  device = "auto",
  branches = ["he_nuclei", "he_cell"],
  targetMpp = 0.2125,
  magnification = 40,
  mppOverride = 0.2125,
  batchSize = 8,
  filterTissue = false,
  mifChannelConfig = null,
}) {
  const encodedPath = encodeURIComponent(slidePath);

  const response = await fetch(
    `${BACKEND_BASE_URL}/slide/${encodedPath}/ai/roi-segmentation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roi,
        mode,
        model_name: modelName,
        checkpoint_name: checkpointName,
        device,
        branches,
        target_mpp: targetMpp,
        magnification,
        mpp_override: mppOverride,
        batch_size: batchSize,
        filter_tissue: filterTissue,
        mif_channel_config: mifChannelConfig,
      }),
    }
  );

  if (!response.ok) {
    let message = "ROI segmentation failed";
    try {
      const errorData = await response.json();
      message = errorData?.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}