import { geometryToSvgShapes, getAiLayerStroke, isFeatureCollection } from "../ai/aiOverlayUtils";

function renderFeature(feature, imageToScreen, stroke, layerOpacity, keyPrefix) {
  const geometry = feature?.geometry;
  const shapes = geometryToSvgShapes(geometry, imageToScreen);

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
          opacity={layerOpacity}
          pointerEvents="none"
        />
      );
    }

    if (shape.kind === "polygon") {
      return (
        <polygon
          key={key}
          points={shape.points}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          opacity={layerOpacity}
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
          stroke={stroke}
          strokeWidth={1.5}
          opacity={layerOpacity}
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
        const stroke = getAiLayerStroke(layer);
        const opacity = layer.opacity ?? 1;
        const features = layer.feature_collection?.features || [];

        return (
          <g key={layer.id || layer.branch || stroke}>
            {features.map((feature, featureIndex) =>
              renderFeature(
                feature,
                imageToScreen,
                stroke,
                opacity,
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