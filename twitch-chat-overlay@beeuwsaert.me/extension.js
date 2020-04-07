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
    this._twitchIRC = new TwitchIRC();
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

    this._twitchIRC.connect(() => {
      this._twitchIRC.authenticate();
      let leave = this._twitchIRC.join(
        this._settings.get_string("twitch-channel")
      );
      this._settings.connect("changed::twitch-channel", () => {
        leave();
        leave = this._twitchIRC.join(
          this._settings.get_string("twitch-channel")
        );
      });
      this._settings.connect("changed::window-regex", () => {
        this._unoverlayWindows();
        const windowTitleRegex = new RegExp(
          this._settings.get_string("window-regex")
        );
        this._overlayWindows(windowTitleRegex);
      });
      let windowTitleRegex = new RegExp(
        this._settings.get_string("window-regex")
      );

      this._overlayWindows(windowTitleRegex);

      this._windowHandlerID = global.display.connect(
        "window-created",
        (_, window) => {
          let windowTitleRegex = new RegExp(
            this._settings.get_string("window-regex")
          );
          // Just assume this is a WindowActor, (shhh...)
          const windowActor = window.get_compositor_private();
          this._processWindow(windowActor, windowTitleRegex);
        }
      );
    });
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
        scrollback: this._settings.get_value("scrollback") | 0,
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

      const onClose = () =>
        chat.addInfo("Twitch connection closed. Restart extension");
      const onMessage = (message) => {
        if (message.command === "PRIVMSG") {
          const [channel, text] = message.params;
          chat.addMessage(message.tags["display-name"] || "UNKNOWN", text);
        }
      };
      this._twitchIRC.on("close", onClose);
      this._twitchIRC.on("message", onMessage);

      windowActor.connect("destroy", () => {
        this._twitchIRC.remove("close", onClose);
        this._twitchIRC.remove("message", onMessage);

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
