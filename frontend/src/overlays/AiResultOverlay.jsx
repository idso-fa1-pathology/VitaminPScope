import {
  geometryToSvgShapes,
  getAiLayerFill,
  getAiLayerFillOpacity,
  getAiLayerStroke,
  getAiLayerStrokeOpacity,
  getAiLayerStrokeWidth,
  isFeatureCollection,
} from "../ai/aiOverlayUtils";

function renderFeature(feature, imageToScreen, layer, keyPrefix) {
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

    if (shape.kind === "point") {
      return (
        <circle
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          r={3}
          fill={stroke}
          opacity={strokeOpacity}
          pointerEvents="none"
        />
      );
    }

    if (shape.kind === "polygon") {
      return (
        <polygon
          key={key}
          points={shape.points}
          fill={showFill ? fill : "none"}
          fillOpacity={showFill ? fillOpacity : 0}
          stroke={showStroke ? stroke : "none"}
          strokeWidth={showStroke ? strokeWidth : 0}
          opacity={1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      );
    }

    if (shape.kind === "polyline") {
      return (
        <polyline
          key={key}
          points={shape.points}
          fill="none"
          stroke={showStroke ? stroke : "none"}
          strokeWidth={showStroke ? strokeWidth : 0}
          opacity={strokeOpacity}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      );
    }

    return null;
  });
}

function AiResultOverlay({ layers = [], imageToScreen }) {
  const visibleLayers = layers.filter(
    (layer) =>
      layer &&
      layer.visible !== false &&
      layer?.display?.visible !== false &&
      isFeatureCollection(layer.feature_collection)
  );

  if (!visibleLayers.length) return null;

  return (
    <svg
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
                `${layer.id || layer.branch}-feature-${featureIndex}`
              )
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default AiResultOverlay;