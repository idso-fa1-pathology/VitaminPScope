const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";


// ---------------------------------------------------------
// ROI (existing — unchanged)
// ---------------------------------------------------------
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
    } catch {}
    throw new Error(message);
  }

  return response.json();
}


// ---------------------------------------------------------
// 🔥 NEW — WSI job
// ---------------------------------------------------------
export async function startWsiJob(payload) {
  const response = await fetch(`${BACKEND_BASE_URL}/slide/${encodeURIComponent(payload.slidePath)}/ai/wsi-segmentation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to start WSI job");
  }

  return response.json();
}


// ---------------------------------------------------------
// 🔥 Job results
// ---------------------------------------------------------
export async function getJobResults(jobId) {
  const response = await fetch(`${BACKEND_BASE_URL}/jobs/${jobId}/results`);

  if (!response.ok) {
    throw new Error("Failed to fetch job results");
  }

  return response.json();
}


// ---------------------------------------------------------
// 🔥 Morphometrics
// ---------------------------------------------------------
export async function getJobAnalysis(jobId) {
  const response = await fetch(`${BACKEND_BASE_URL}/analysis/${jobId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch morphometrics");
  }

  return response.json();
}


// ---------------------------------------------------------
// 🔥 Merge metrics into features
// ---------------------------------------------------------
export function mergeMetricsIntoLayers(layers, analysis) {
  if (!analysis?.metrics) return layers;

  const metricMap = new Map();
  for (const m of analysis.metrics) {
    metricMap.set(m.id, m);
  }

  return layers.map((layer) => {
    const features = layer.feature_collection?.features || [];

    const updatedFeatures = features.map((f) => {
      const props = f.properties || {};
      const id = props.id;

      if (!id || !metricMap.has(id)) return f;

      const metric = metricMap.get(id);

      return {
        ...f,
        properties: {
          ...props,
          ...metric, // 🔥 inject morphometrics
        },
      };
    });

    return {
      ...layer,
      feature_collection: {
        ...layer.feature_collection,
        features: updatedFeatures,
      },
    };
  });
}