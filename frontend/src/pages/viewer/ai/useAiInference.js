import { useEffect, useMemo, useState } from "react";
import { runRoiAiSegmentation } from "../../../api/slides";
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
    device: "cpu",
    batchSize: 1,
    branchesByMode: {
      he: ["he_nuclei", "he_cell"],
      mif: ["mif_nuclei", "mif_cell"],
    },
  },
];

function buildChannelNameMap(channels = []) {
  return Object.fromEntries(channels.map((ch) => [ch.index, ch.name]));
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

  const selectedModel = useMemo(() => {
    return (
      availableModels.find((model) => model.id === selectedModelId) || availableModels[0]
    );
  }, [availableModels, selectedModelId]);

  const results = resultsBySlide[slideAnnotationKey] || [];

  useEffect(() => {
    const nextAiMode = guessAiMode(slideInfo);
    const nextNuclearChannel = guessNuclearChannel(normalizedChannels);
    const nextMembraneChannels = guessMembraneChannels(
      normalizedChannels,
      nextNuclearChannel
    );

    setAiMode(nextAiMode);
    setAiNuclearChannel(nextNuclearChannel);
    setAiMembraneChannels(nextMembraneChannels);
    setAiMembraneCombination("max");
    setAiError("");
  }, [slideInfo, normalizedChannels, slideAnnotationKey]);

  const handleResetAiDefaults = () => {
    const nextAiMode = guessAiMode(slideInfo);
    const nextNuclearChannel = guessNuclearChannel(normalizedChannels);
    const nextMembraneChannels = guessMembraneChannels(
      normalizedChannels,
      nextNuclearChannel
    );

    setAiMode(nextAiMode);
    setAiNuclearChannel(nextNuclearChannel);
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
  };

  const removeResult = (resultId) => {
    if (!slideAnnotationKey) return;

    setResultsBySlide((prev) => ({
      ...prev,
      [slideAnnotationKey]: (prev[slideAnnotationKey] || []).filter(
        (item) => item.id !== resultId
      ),
    }));
  };

  const applyResultLayers = (resultItem) => {
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

    if (aiMode === "mif" && !aiNuclearChannel) {
      setAiError("Select a nuclear channel for MIF inference.");
      return;
    }

    if (aiMode === "mif" && !aiMembraneChannels.length) {
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
                nuclear_channel: Number(aiNuclearChannel),
                membrane_channel: aiMembraneChannels.map(Number),
                membrane_combination: aiMembraneCombination || "max",
                channel_names: buildChannelNameMap(normalizedChannels),
              }
            : null,
      };

      const result = await runRoiAiSegmentation(
        selectedSlide.path,
        payload,
        selectedSlide.sourceId || currentSourceId
      );

      const nextLayers = result?.layers || [];
      const nextResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        mode: aiMode,
        modelId: selectedModel.id,
        modelLabel: selectedModel.label,
        roi,
        status: "success",
        layerCount: nextLayers.length,
        layers: nextLayers,
      };

      onApplyLayers?.(nextLayers);

      setResultsBySlide((prev) => ({
        ...prev,
        [slideAnnotationKey]: [nextResult, ...(prev[slideAnnotationKey] || [])],
      }));
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
    runInference,
  };
}