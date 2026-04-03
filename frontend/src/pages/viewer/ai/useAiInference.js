import { useEffect, useMemo, useState } from "react";
import { runRoiAiSegmentation } from "../../../api/slides";
import { buildDefaultLayerDisplay, getLayerKind } from "../../../ai/aiOverlayUtils";
import {
  guessAiMode,
  guessMembraneChannels,
  guessNuclearChannel,
} from "../viewerHelpers";

const DEFAULT_MODELS = [
  {
    id: "flex",
    label: "Vitamin P Flex",
    modelName: "flex",
    checkpointName: "vitamin_p_flex.pth",
    device: "cuda",
    batchSize: 8,
    branchesByMode: {
      he: ["he_nuclei", "he_cell"],
      mif: ["mif_nuclei", "mif_cell"],
    },
  },
];

function normalizeChannelIndex(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function sanitizeMembraneChannels(membraneChannels = [], nuclearChannel) {
  const nuclear = normalizeChannelIndex(nuclearChannel);

  return [...new Set(
    membraneChannels
      .map(normalizeChannelIndex)
      .filter((value) => value !== null && value !== nuclear)
  )].sort((a, b) => a - b);
}

function buildOrderedChannelMetadata(channels = []) {
  const sortedChannels = [...channels]
    .filter((ch) => normalizeChannelIndex(ch?.index) !== null)
    .sort((a, b) => Number(a.index) - Number(b.index));

  return {
    channel_names: Object.fromEntries(
      sortedChannels.map((ch) => [
        Number(ch.index),
        ch?.name || `Channel ${ch.index}`,
      ])
    ),
    channel_indices: sortedChannels.map((ch) => Number(ch.index)),
    channel_count: sortedChannels.length,
  };
}

function buildChannelNameMap(channels = []) {
  return Object.fromEntries(
    channels.map((ch) => [Number(ch.index), ch.name || `Channel ${ch.index}`])
  );
}

function enrichLayersWithDisplay(layers = []) {
  return layers.map((layer) => ({
    ...layer,
    display: {
      ...buildDefaultLayerDisplay(layer),
    },
  }));
}

function buildResultDisplaySummary(layers = []) {
  const hasNuclei = layers.some((layer) => getLayerKind(layer) === "nuclei");
  const hasCells = layers.some((layer) => getLayerKind(layer) === "cell");

  return {
    showNuclei: hasNuclei,
    showCells: hasCells,
    showFill: false,
  };
}

export function useAiInference({
  slideInfo,
  selectedSlide,
  selectedRoiAnnotation,
  normalizedChannels,
  currentSourceId,
  slideAnnotationKey,
  onApplyLayers,
}) {
  const [availableModels] = useState(DEFAULT_MODELS);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODELS[0].id);

  const [aiMode, setAiMode] = useState("he");
  const [aiNuclearChannel, setAiNuclearChannel] = useState("");
  const [aiMembraneChannels, setAiMembraneChannels] = useState([]);
  const [aiMembraneCombination, setAiMembraneCombination] = useState("max");

  const [isRunningAi, setIsRunningAi] = useState(false);
  const [aiError, setAiError] = useState("");

  const [resultsBySlide, setResultsBySlide] = useState({});
  const [activeResultIdBySlide, setActiveResultIdBySlide] = useState({});

  const selectedModel = useMemo(() => {
    return (
      availableModels.find((model) => model.id === selectedModelId) || availableModels[0]
    );
  }, [availableModels, selectedModelId]);

  const results = resultsBySlide[slideAnnotationKey] || [];
  const activeResultId = activeResultIdBySlide[slideAnnotationKey] || null;

  useEffect(() => {
    const nextAiMode = guessAiMode(slideInfo);
    const guessedNuclearChannel = guessNuclearChannel(normalizedChannels);
    const nextNuclearChannel = normalizeChannelIndex(guessedNuclearChannel);

    const guessedMembraneChannels = guessMembraneChannels(
      normalizedChannels,
      nextNuclearChannel
    );

    const nextMembraneChannels = sanitizeMembraneChannels(
      guessedMembraneChannels,
      nextNuclearChannel
    );

    setAiMode(nextAiMode);
    setAiNuclearChannel(nextNuclearChannel ?? "");
    setAiMembraneChannels(nextMembraneChannels);
    setAiMembraneCombination("max");
    setAiError("");
  }, [slideInfo, normalizedChannels, slideAnnotationKey]);

  useEffect(() => {
    if (!slideAnnotationKey) return;
    const activeItem = results.find((item) => item.id === activeResultId);
    if (activeItem) {
      onApplyLayers?.(activeItem.layers || []);
    }
  }, [results, activeResultId, slideAnnotationKey, onApplyLayers]);

  const handleResetAiDefaults = () => {
    const nextAiMode = guessAiMode(slideInfo);
    const guessedNuclearChannel = guessNuclearChannel(normalizedChannels);
    const nextNuclearChannel = normalizeChannelIndex(guessedNuclearChannel);

    const guessedMembraneChannels = guessMembraneChannels(
      normalizedChannels,
      nextNuclearChannel
    );

    const nextMembraneChannels = sanitizeMembraneChannels(
      guessedMembraneChannels,
      nextNuclearChannel
    );

    setAiMode(nextAiMode);
    setAiNuclearChannel(nextNuclearChannel ?? "");
    setAiMembraneChannels(nextMembraneChannels);
    setAiMembraneCombination("max");
    setAiError("");
  };

  const clearResults = () => {
    if (!slideAnnotationKey) return;

    setResultsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: [],
    }));

    setActiveResultIdBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: null,
    }));

    onApplyLayers?.([]);
  };

  const removeResult = (resultId) => {
    if (!slideAnnotationKey) return;

    const nextResults = (resultsBySlide[slideAnnotationKey] || []).filter(
      (item) => item.id !== resultId
    );

    setResultsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: nextResults,
    }));

    const wasActive = activeResultIdBySlide[slideAnnotationKey] === resultId;

    if (wasActive) {
      const nextActive = nextResults[0]?.id || null;

      setActiveResultIdBySlide((prev) => ({
        ...prev,
        [slideAnnotationKey]: nextActive,
      }));

      const nextActiveItem = nextResults[0];
      onApplyLayers?.(nextActiveItem?.layers || []);
    }
  };

  const updateResult = (resultId, updater) => {
    if (!slideAnnotationKey) return;

    setResultsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: (prev[slideAnnotationKey] || []).map((item) =>
        item.id === resultId ? updater(item) : item
      ),
    }));
  };

  const updateResultDisplay = (resultId, patch) => {
    updateResult(resultId, (item) => {
      const nextDisplay = {
        ...(item.display || {}),
        ...patch,
      };

      const nextLayers = (item.layers || []).map((layer) => {
        const kind = getLayerKind(layer);
        const isNuclei = kind === "nuclei";
        const isCell = kind === "cell";

        return {
          ...layer,
          display: {
            ...(layer.display || {}),
            visible: isNuclei
              ? nextDisplay.showNuclei !== false
              : isCell
                ? nextDisplay.showCells !== false
                : true,
            showFill: nextDisplay.showFill === true,
          },
        };
      });

      return {
        ...item,
        display: nextDisplay,
        layers: nextLayers,
      };
    });
  };

  const updateResultLayerStyle = (resultId, layerKind, patch) => {
    updateResult(resultId, (item) => {
      const nextLayers = (item.layers || []).map((layer) => {
        if (getLayerKind(layer) !== layerKind) return layer;

        return {
          ...layer,
          display: {
            ...(layer.display || {}),
            ...patch,
          },
        };
      });

      return {
        ...item,
        layers: nextLayers,
      };
    });
  };

  const applyResultLayers = (resultItem) => {
    if (!slideAnnotationKey) return;

    setActiveResultIdBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: resultItem?.id || null,
    }));

    onApplyLayers?.(resultItem?.layers || []);
  };

  const runInference = async () => {
    if (!selectedSlide?.path) {
      setAiError("No slide is loaded.");
      return;
    }

    if (!selectedRoiAnnotation) {
      setAiError("Select a rectangle ROI first.");
      return;
    }

    const nuclearChannel = normalizeChannelIndex(aiNuclearChannel);
    const membraneChannels = sanitizeMembraneChannels(
      aiMembraneChannels,
      nuclearChannel
    );
    const orderedChannelMetadata = buildOrderedChannelMetadata(normalizedChannels);

    if (aiMode === "mif" && nuclearChannel === null) {
      setAiError("Select a valid nuclear channel for MIF inference.");
      return;
    }

    if (aiMode === "mif" && membraneChannels.length === 0) {
      setAiError("Select at least one membrane channel for MIF inference.");
      return;
    }

    setIsRunningAi(true);
    setAiError("");

    const roi = {
      x: selectedRoiAnnotation.x,
      y: selectedRoiAnnotation.y,
      width: selectedRoiAnnotation.width,
      height: selectedRoiAnnotation.height,
    };

    try {
      const payload = {
        roi,
        mode: aiMode,
        model_name: selectedModel.modelName,
        checkpoint_name: selectedModel.checkpointName,
        device: selectedModel.device || "cpu",
        branches: selectedModel.branchesByMode?.[aiMode] || [],
        batch_size: selectedModel.batchSize || 1,
        filter_tissue: false,
        save_visualization: false,
        mif_channel_config:
          aiMode === "mif"
            ? {
                nuclear_channel: nuclearChannel,
                membrane_channel: membraneChannels,
                membrane_combination: aiMembraneCombination || "max",
                channel_names:
                  orderedChannelMetadata.channel_names ||
                  buildChannelNameMap(normalizedChannels),
                channel_indices: orderedChannelMetadata.channel_indices || [],
                channel_count:
                  orderedChannelMetadata.channel_count ||
                  normalizedChannels.length,
              }
            : null,
      };

      console.log("[useAiInference] ROI inference payload", {
        slidePath: selectedSlide.path,
        roi,
        mode: aiMode,
        mif_channel_config: payload.mif_channel_config,
      });

      const result = await runRoiAiSegmentation(
        selectedSlide.path,
        payload,
        selectedSlide.sourceId || currentSourceId
      );

      const nextLayers = enrichLayersWithDisplay(result?.layers || []);
      const nextResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        slidePath: selectedSlide.path,
        sourceId: selectedSlide.sourceId || currentSourceId,
        createdAt: new Date().toISOString(),
        mode: aiMode,
        modelId: selectedModel.id,
        modelLabel: selectedModel.label,
        roi,
        status: "success",
        layerCount: nextLayers.length,
        layers: nextLayers,
        metrics: result?.stats?.result_metrics || {},
        branchStats: result?.stats?.branches || {},
        display: buildResultDisplaySummary(nextLayers),
      };

      setResultsBySlide((prev) => ({
        ...prev,
        [slideAnnotationKey]: [nextResult, ...(prev[slideAnnotationKey] || [])],
      }));

      setActiveResultIdBySlide((prev) => ({
        ...prev,
        [slideAnnotationKey]: nextResult.id,
      }));

      onApplyLayers?.(nextLayers);
    } catch (err) {
      const message = err?.message || "ROI AI failed";
      setAiError(message);

      const failedResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        mode: aiMode,
        modelId: selectedModel.id,
        modelLabel: selectedModel.label,
        roi,
        status: "error",
        error: message,
        layerCount: 0,
        layers: [],
        metrics: {},
        display: {},
      };

      setResultsBySlide((prev) => ({
        ...prev,
        [slideAnnotationKey]: [failedResult, ...(prev[slideAnnotationKey] || [])],
      }));
    } finally {
      setIsRunningAi(false);
    }
  };

  return {
    availableModels,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    aiMode,
    setAiMode,
    aiNuclearChannel,
    setAiNuclearChannel,
    aiMembraneChannels,
    setAiMembraneChannels,
    aiMembraneCombination,
    setAiMembraneCombination,
    isRunningAi,
    aiError,
    results,
    handleResetAiDefaults,
    clearResults,
    removeResult,
    applyResultLayers,
    updateResultDisplay,
    updateResultLayerStyle,
    runInference,
  };
}