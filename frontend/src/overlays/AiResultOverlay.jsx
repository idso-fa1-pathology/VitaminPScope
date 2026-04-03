import { useState } from "react";

import {
  geometryToSvgShapes,
  getAiLayerFill,
  getAiLayerFillOpacity,
  getAiLayerStroke,
  getAiLayerStrokeOpacity,
  getAiLayerStrokeWidth,
  isFeatureCollection,
} from "../ai/aiOverlayUtils";

function renderFeature(feature, imageToScreen, layer, keyPrefix, onClickFeature) {
  const geometry = feature?.geometry;
  const shapes = geometryToSvgShapes(geometry, imageToScreen);

  const showStroke = layer?.display?.showStroke !== false;
  const showFill = layer?.display?.showFill === true;

  const stroke = getAiLayerStroke(layer);
  const fill = getAiLayerFill(layer);
  const strokeOpacity = getAiLayerStrokeOpacity(layer);
  const fillOpacity = getAiLayerFillOpacity(layer);
  const strokeWidth = getAiLayerStrokeWidth(layer);

  return shapes.map((shape, index) => {
    const key = `${keyPrefix}-${shape.key || index}`;

    const commonProps = {
      key,
      onClick: (e) => {
        e.stopPropagation();
        onClickFeature?.(feature, e);
      },
      style: { cursor: "pointer", pointerEvents: "auto" },
    };

    if (shape.kind === "point") {
      return (
        <circle
          {...commonProps}
          cx={shape.cx}
          cy={shape.cy}
          r={3}
          fill={stroke}
          opacity={strokeOpacity}
        />
      );
    }

    if (shape.kind === "polygon") {
      return (
        <polygon
          {...commonProps}
          points={shape.points}
          fill={showFill ? fill : "none"}
          fillOpacity={showFill ? fillOpacity : 0}
          stroke={showStroke ? stroke : "none"}
          strokeWidth={showStroke ? strokeWidth : 0}
          opacity={1}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    if (shape.kind === "polyline") {
      return (
        <polyline
          {...commonProps}
          points={shape.points}
          fill="none"
          stroke={showStroke ? stroke : "none"}
          strokeWidth={showStroke ? strokeWidth : 0}
          opacity={strokeOpacity}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    return null;
  });
}

function AiResultOverlay({ layers = [], imageToScreen, renderTick = 0 }) {
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const visibleLayers = layers.filter(
    (layer) =>
      layer &&
      layer.visible !== false &&
      layer?.display?.visible !== false &&
      isFeatureCollection(layer.feature_collection)
  );

  if (!visibleLayers.length) return null;

  const handleFeatureClick = (feature, event) => {
    setSelectedFeature(feature);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  const props = selectedFeature?.properties || {};

  return (
    <>
      <svg
        data-render-tick={renderTick}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 14,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {visibleLayers.map((layer) => {
          const features = layer.feature_collection?.features || [];

          return (
            <g key={layer.id || layer.branch || layer.color || "ai-layer"}>
              {features.map((feature, featureIndex) =>
                renderFeature(
                  feature,
                  imageToScreen,
                  layer,
                  `${layer.id || layer.branch}-feature-${featureIndex}`,
                  handleFeatureClick
                )
              )}
            </g>
          );
        })}
      </svg>

      {selectedFeature && (
        <div
          style={{
            position: "fixed",
            top: tooltipPos.y + 10,
            left: tooltipPos.x + 10,
            background: "rgba(0,0,0,0.85)",
            color: "white",
            padding: "8px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            zIndex: 9999,
            maxWidth: "220px",
            pointerEvents: "none",
          }}
        >
          <div><b>Type:</b> {props.type || "N/A"}</div>
          <div><b>Area:</b> {props.area?.toFixed?.(2) ?? "N/A"}</div>
          <div><b>Confidence:</b> {props.confidence ?? "N/A"}</div>
          <div><b>Circularity:</b> {props.circularity?.toFixed?.(3) ?? "N/A"}</div>
        </div>
      )}
    </>
  );
}

export default AiResultOverlay;