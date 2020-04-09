const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { OverlayManager } = Me.imports.OverlayManager;
const { TwitchOverlayIndicator, IndicatorState } = Me.imports.Indicator;

/* exported init */

class Extension {
  constructor() {
    this._indicator = null;
    this._settings = null;
    this._overlayManager = null;
  }

  enable() {
    this._indicator = new TwitchOverlayIndicator();
    this._settings = ExtensionUtils.getSettings();

    this._indicatorStateHandler = this._indicator.connect(
      "notify::state",
      () => {
        const state = this._indicator.state;

        if (state === IndicatorState.ACTIVE) {
          this.activate();
        } else {
          this.deactivate();
        }
      }
    );

    this._settingsHandler = this._settings.connect("changed", () =>
      this._syncSettings()
    );
    this._syncSettings();

    Main.panel.addToStatusArea("twitch-overlay-indicator", this._indicator);
  }

  activate() {
    this.deactivate();
    this._overlayManager = new OverlayManager(this._settings);
  }

  deactivate() {
    if (this._overlayManager) {
      this._overlayManager.shutdown();
      this._overlayManager = null;
    }
  }

  _syncSettings() {
    if (
      this._settings.get_string("twitch-channel") === "" ||
      this._settings.get_string("window-regex") === ""
    ) {
      this.deactivate();
      this._indicator.state = IndicatorState.ERROR;
    } else if (this._indicator.state === IndicatorState.ERROR) {
      this._indicator.state = IndicatorState.INACTIVE;
    }
  }

  disable() {
    this.deactivate();
    this._indicator.destroy();
    this._settings.disconnect(this._settingsHandler);
    this._settings = null;
  }
}

function init() {
  return new Extension();
}
