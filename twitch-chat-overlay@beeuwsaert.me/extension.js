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
    let gschema = Gio.SettingsSchemaSource.new_from_directory(
      Me.dir.get_child("schemas").get_path(),
      Gio.SettingsSchemaSource.get_default(),
      false
    );

    this._settings = new Gio.Settings({
      settings_schema: gschema.lookup(
        "org.gnome.shell.extensions.twitchoverlay",
        true
      ),
    });

    this._twitchIRC = new TwitchIRC();
    this._windowHandlerID = null;
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
          log("Disable unredirect");
        } else {
          log("Enable unredirect");
          Meta.enable_unredirect_for_display(global.display);
        }
      }
    );

    this._twitchIRC.connect("connected", () => {
      log("WebSocket connected");
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
        scrollback: this._settings.get_value("scrollback"),
      });

      const colorHandlerFactory = (propertyName, callback) => {
        return () => {
          const colorString = this._settings.get_string(propertyName);
          const [success, color] = Clutter.Color.from_string(colorString);
          if (success) callback(color);
          else log(`Invalid Color: ${colorString}`);
        };
      };
      const textColorHandler = colorHandlerFactory(
        "chat-text-color",
        (color) => (chat.chat_text_color = color)
      );
      const backgroundColorHandler = colorHandlerFactory(
        "chat-background-color",
        (color) => (chat.chat_background_color = color)
      );
      const textColorHandlerID = this._settings.connect(
        "changed::chat-text-color",
        textColorHandler
      );
      const backgroundColorHandlerID = this._settings.connect(
        "changed::chat-background-color",
        backgroundColorHandler
      );

      backgroundColorHandler();
      textColorHandler();

      chat.addInfo("Twitch Overlay enabled");

      // Make sure any settings changes get updated
      this._settings.bind(
        "chat-width",
        chat,
        "chat-width",
        Gio.SettingsBindFlags.DEFAULT
      );
      this._settings.bind(
        "x-position",
        chat,
        "x-factor",
        Gio.SettingsBindFlags.DEFAULT
      );
      this._settings.bind(
        "y-position",
        chat,
        "y-factor",
        Gio.SettingsBindFlags.DEFAULT
      );
      this._settings.bind(
        "scrollback",
        chat,
        "scrollback",
        Gio.SettingsBindFlags.DEFAULT
      );

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

      windowActor.connect("destroy", () => {
        this._twitchIRC.disconnect(closeHandler);
        this._twitchIRC.disconnect(messageHandler);

        this._settings.disconnect(backgroundColorHandlerID);
        this._settings.disconnect(textColorHandlerID);
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
    global.get_window_actors().forEach((windowActor) => {
      const chatWindow = windowActor
        .get_children()
        .find((child) => child.name === CHAT_ACTOR_NAME);
      if (chatWindow) {
        windowActor.remove_child(chatWindow);
      }
    });
  }
  disable() {
    Meta.enable_unredirect_for_display(global.display);
    this._twitchIRC.close();
    this._unoverlayWindows();
    this._clearHandlers();
  }
}

function init() {
  return new Extension();
}
