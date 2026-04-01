import { useCallback, useMemo, useState } from "react";
import {
  runRoiSegmentation,
  startWsiJob,
  getJobResults,
  getJobAnalysis,
  mergeMetricsIntoLayers,
} from "./aiOverlayApi";


export default function useAiOverlay({ slidePath }) {
  const [aiLayers, setAiLayers] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [lastRunMeta, setLastRunMeta] = useState(null);


  const clearAiLayers = useCallback(() => {
    setAiLayers([]);
    setError(null);
    setLastRunMeta(null);
  }, []);


  const removeAiLayer = useCallback((layerId) => {
    setAiLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  }, []);


  // ---------------------------------------------------------
  // ROI (unchanged)
  // ---------------------------------------------------------
  const runAiOnRoi = useCallback(
    async ({
      roi,
      mode = "he",
      modelName = "flex",
      checkpointName = null,
      device = "auto",
      branches,
      targetMpp = 0.2125,
      magnification = 40,
      mppOverride = 0.2125,
      batchSize = 1,
      filterTissue = false,
      mifChannelConfig = null,
      replaceExisting = true,
    }) => {
      if (!slidePath) {
        throw new Error("No slide selected");
      }

      setIsRunning(true);
      setError(null);

      try {
        const result = await runRoiSegmentation({
          slidePath,
          roi,
          mode,
          modelName,
          checkpointName,
          device,
          branches,
          targetMpp,
          magnification,
          mppOverride,
          batchSize,
          filterTissue,
          mifChannelConfig,
        });

        const nextLayers = (result.layers || []).map((layer, index) => ({
          ...layer,
          visible: true,
          opacity: 1,
          order: index,
        }));

        setAiLayers((prev) =>
          replaceExisting ? nextLayers : [...prev, ...nextLayers]
        );

        setLastRunMeta({
          roi: result.roi,
          stats: result.stats || {},
          mode,
        });

        return result;
      } catch (err) {
        const message = err?.message || "AI ROI segmentation failed";
        setError(message);
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    [slidePath]
  );


  // ---------------------------------------------------------
  // 🔥 NEW — WSI + Morphometrics pipeline
  // ---------------------------------------------------------
  const runAiOnWsi = useCallback(
    async (payload) => {
      if (!slidePath) throw new Error("No slide selected");

      setIsRunning(true);
      setError(null);

      try {
        // 1. Start job
        const { job_id } = await startWsiJob({
          ...payload,
          slidePath,
        });

        // 2. Poll results (simple loop)
        let result = null;
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));

          result = await getJobResults(job_id);

          if (result.status === "completed") break;
        }

        if (!result || result.status !== "completed") {
          throw new Error("WSI job timeout");
        }

        // 3. Convert raw_results → layers
        const layers = Object.entries(result.raw_results || {}).map(
          ([branch, data], idx) => ({
            id: branch,
            name: branch,
            visible: true,
            opacity: 1,
            order: idx,
            feature_collection: data.feature_collection,
          })
        );

        // 4. Fetch morphometrics
        const analysis = await getJobAnalysis(job_id);

        // 5. Merge metrics
        const enrichedLayers = mergeMetricsIntoLayers(layers, analysis);

        setAiLayers(enrichedLayers);

        return { job_id, layers: enrichedLayers, analysis };
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    [slidePath]
  );


  const visibleAiLayers = useMemo(
    () => aiLayers.filter((layer) => layer.visible !== false),
    [aiLayers]
  );


  return {
    aiLayers,
    visibleAiLayers,
    isRunning,
    error,
    lastRunMeta,
    setAiLayers,
    clearAiLayers,
    removeAiLayer,
    runAiOnRoi,
    runAiOnWsi, // 🔥 NEW
  };
}