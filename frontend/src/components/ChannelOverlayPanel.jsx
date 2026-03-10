import React from "react";
import ChannelPanel from "./ChannelPanel";
import "../styles/viewer/channel-overlay.css";

function ChannelOverlayPanel({
  isOpen,
  channels,
  selectedChannels,
  channelSettings,
  onToggle,
  onUpdate,
  onEnableAll,
  onDisableAll,
  onResetAll,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="channel-overlay-panel" aria-hidden={!isOpen}>
      <div
        className="channel-overlay-panel__card"
        role="dialog"
        aria-modal="false"
        aria-label="Channel controls"
      >
        <div className="channel-overlay-panel__header">
          <div>
            <div className="channel-overlay-panel__title">Channel controls</div>
            <div className="channel-overlay-panel__subtitle">
              Enable, tint, filter, and blend multichannel rendering
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="channel-overlay-panel__close"
          >
            ✕
          </button>
        </div>

        <div className="channel-overlay-panel__body">
          <ChannelPanel
            channels={channels}
            selectedChannels={selectedChannels}
            channelSettings={channelSettings}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onEnableAll={onEnableAll}
            onDisableAll={onDisableAll}
            onResetAll={onResetAll}
          />
        </div>
      </div>
    </div>
  );
}

export default ChannelOverlayPanel;