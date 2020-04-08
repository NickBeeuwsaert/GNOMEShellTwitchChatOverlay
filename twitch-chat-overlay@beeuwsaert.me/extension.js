const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { TwitchIRC } = Me.imports.TwitchIRC;
const { Chat, CHAT_ACTOR_NAME } = Me.imports.Chat;

/* exported init */
class Extension {
  constructor() {
    this._settings = ExtensionUtils.getSettings();

    this._twitchIRC = new TwitchIRC();
    this._windowHandlerID = null;
    this._twitchHandlerID = null;
    this._unredirectHandlerID = null;
  }

  enable() {
    if (this._settings.get_boolean("disable-unredirect")) {
      Meta.disable_unredirect_for_display(global.display);
    }

    this._unredirectHandlerID = this._settings.connect(
      "changed::disable-unredirect",
      () => {
        if (this._settings.get_boolean("disable-unredirect")) {
          Meta.disable_unredirect_for_display(global.display);
        } else {
          Meta.enable_unredirect_for_display(global.display);
        }
      }
    );

    this._twitchHandlerID = this._twitchIRC.connect("connected", () => {
      this._twitchIRC.authenticate();

      this._settings.bind(
        "twitch-channel",
        this._twitchIRC,
        "channel",
        Gio.SettingsBindFlags.DEFAULT
      );
    });
    this._twitchIRC.establishConnection();

    this._settings.connect("changed::window-regex", () => {
      this._unoverlayWindows();
      const windowTitleRegex = new RegExp(
        this._settings.get_string("window-regex")
      );
      this._overlayWindows(windowTitleRegex);
    });

    this._overlayWindows(new RegExp(this._settings.get_string("window-regex")));
    this._windowHandlerID = global.display.connect(
      "window-created",
      (_, window) => {
        // Just assume this is a WindowActor, (shhh...)
        const windowActor = window.get_compositor_private();
        this._processWindow(
          windowActor,
          new RegExp(this._settings.get_string("window-regex"))
        );
      }
    );
  }

  _clearHandlers() {
    if (this._windowHandlerID) {
      global.display.disconnect(this._windowHandlerID);
      this._unredirectHandlerID = null;
    }
    if (this._unredirectHandlerID) {
      this._settings.disconnect(this._windowHandlerID);
      this._windowHandlerID = null;
    }
  }

  _processWindow(windowActor, windowTitleRegex) {
    const window = windowActor.get_meta_window();

    if (windowTitleRegex.test(window.title)) {
      const chat = new Chat({
        xFactor: this._settings.get_double("x-position"),
        yFactor: this._settings.get_double("y-position"),
        chatWidth: this._settings.get_double("chat-width"),
        scrollback: this._settings.get_double("scrollback"),
      });
      chat.addInfo("Twitch Overlay enabled");

      for (const propertyName of ["chat-text-color", "chat-background-color"]) {
        const callback = () => {
          const colorString = this._settings.get_string(propertyName);
          const [success, color] = Clutter.Color.from_string(colorString);

          if (success) chat.set_property(propertyName, color);
          else log(`Invalid Color: ${colorString}`);
        };
        const handlerID = this._settings.connect(
          `changed::${propertyName}`,
          callback
        );

        callback();

        chat.connect("destroy", () => this._settings.disconnect(handlerID));
      }

      // Make sure any settings changes get updated
      for (const [setting, property = setting] of [
        ["x-position", "x-factor"],
        ["y-position", "y-factor"],
        ["chat-width"],
        ["scrollback"],
      ]) {
        // for some reason using GSettings.bind doesn't work correctly
        // It will still try to write to the target object after settings
        // has been freed
        const handlerID = this._settings.connect(`changed::${setting}`, () => {
          // log(`SETTING ${setting}`);
          const variant = this._settings.get_value(setting);
          let value = null;

          switch (variant.get_type_string()) {
            case "d":
              value = variant.get_double();
              break;
            case "i":
              value = variant.get_int32();
          }
          if (value !== null) {
            chat.set_property(property, value);
          }
        });

        chat.connect("destroy", () => this._settings.disconnect(handlerID));
      }

      const closeHandler = this._twitchIRC.connect("close", () =>
        chat.addInfo("Twitch connection closed. Restart extension")
      );
      const messageHandler = this._twitchIRC.connect(
        "message",
        (_, message) => {
          if (message.command === "PRIVMSG") {
            const [channel, text] = message.params;
            const tags = message.tags;
            const displayName = tags["display-name"] || "UNKNOWN";
            chat.addMessage(displayName, text);
          }
        }
      );

      chat.connect("destroy", () => {
        this._twitchIRC.disconnect(closeHandler);
        this._twitchIRC.disconnect(messageHandler);
      });
      windowActor.add_child(chat);
    }
  }

  _overlayWindows(windowTitleRegex) {
    global
      .get_window_actors()
      .forEach((windowActor) =>
        this._processWindow(windowActor, windowTitleRegex)
      );
  }

  _unoverlayWindows() {
    for (const windowActor of global.get_window_actors()) {
      for (const child of windowActor.get_children()) {
        if (child.name === CHAT_ACTOR_NAME) {
          child.destroy();
        }
      }
    }
  }
  disable() {
    Meta.enable_unredirect_for_display(global.display);
    if (this._twitchHandlerID)
      this._twitchIRC.disconnect(this._twitchHandlerID);
    this._twitchIRC.close();
    this._unoverlayWindows();
    this._clearHandlers();
  }
}

function init() {
  return new Extension();
}
