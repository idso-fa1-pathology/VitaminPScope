(function (OSD) {
    if (typeof OSD === 'undefined' || typeof OSD.Button === 'undefined') return;

    // Skip if already present
    if (typeof OSD.Button.prototype.lockButton === 'function') return;

    console.log('[Polyzoomer] Injecting lock/unlockButton patch for DrawAnnotation plugin...');

    const STATE_REST = OSD.ButtonState.REST;
    const STATE_DOWN = OSD.ButtonState.DOWN;

    // Internal helpers to mimic f() and g() state changes
    function setState(btn, state) {
        if (typeof btn.setState === 'function') {
            btn.setState(state);
        } else if (btn.element) {
            // Fallback visual feedback
            if (state === STATE_DOWN) btn.element.classList.add('osd-button-down');
            else btn.element.classList.remove('osd-button-down');
        }
    }

    OSD.Button.prototype.canBeLocked = true;

    OSD.Button.prototype.lockButton = function () {
        if (!this.element?.disabled && this.canBeLocked) {
            this.isLocked = true;
            setState(this, STATE_DOWN);
        }
    };

    OSD.Button.prototype.unlockButton = function () {
        if (!this.element?.disabled && this.canBeLocked) {
            this.isLocked = false;
            setState(this, STATE_REST);
        }
    };

})(window.OpenSeadragon);
