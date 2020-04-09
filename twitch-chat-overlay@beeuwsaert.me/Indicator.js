const { GObject, St, Gio } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var IndicatorState = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ERROR: "error",
};

var TwitchOverlayIndicator = GObject.registerClass(
  {
    GTypeName: "TwitchOverlayIndicator",
    Properties: {
      state: GObject.ParamSpec.string(
        "state", // name
        "state",
        "The state the overlay is in", // description
        GObject.ParamFlags.READWRITE, // Read-write
        null // default value
      ),
    },
    Signals: {
      activate: {},
      deactivate: {},
    },
  },
  class Indicator extends PanelMenu.Button {
    _init({ state = IndicatorState.INACTIVE } = {}) {
      super._init(0.0, `${Me.metadata.name} Indicator`, false);

      this.icon = new St.Icon();
      this.add_actor(this.icon);
      this.connect("destroy", () => (this.icon = null));

      this._prefsAction = this.menu.addAction(
        "Open Twitch Overlay Preferences",
        () => ExtensionUtils.openPrefs(),
        null
      );
      this._toggleAction = this.menu.addAction("", () => this.toggle(), null);

      this.state = state;
      this._syncState();
    }

    get state() {
      if (this._state === undefined) {
        this._state = IndicatorState.INACTIVE;
      }

      return this._state;
    }

    set state(value) {
      if (typeof value !== "string")
        throw Error(`Expected "string" got "${typeof value}"`);

      if (this.state === value) return;

      this._state = value;
      this._syncState();
      this.notify("state");
    }

    _syncToggle() {
      this._toggleAction.active = this.state !== IndicatorState.ERROR;

      if (this.state === IndicatorState.ACTIVE) {
        this._toggleAction.label.text = "Disable Overlay";
      } else {
        this._toggleAction.label.text = "Enable Overlay";
      }
    }
    _syncState() {
      this._syncToggle();
      switch (this.state) {
        case IndicatorState.ACTIVE:
          {
            this.icon.set_icon_name("media-record-symbolic");
            this.icon.set_style_class_name(
              "system-status-icon twitch-overlay-active"
            );
          }
          break;
        case IndicatorState.INACTIVE:
          {
            this.icon.set_icon_name("media-record-symbolic");
            this.icon.set_style_class_name("system-status-icon");
          }
          break;
        case IndicatorState.ERROR:
          {
            this.icon.set_icon_name("dialog-error-symbolic");
            this.icon.set_style_class_name(
              "system-status-icon twitch-overlay-alert"
            );
          }
          break;
      }
    }

    toggle() {
      if (this.state === IndicatorState.ACTIVE) {
        this.state = IndicatorState.INACTIVE;
      } else if (this.state === IndicatorState.INACTIVE) {
        this.state = IndicatorState.ACTIVE;
      }
    }
  }
);
