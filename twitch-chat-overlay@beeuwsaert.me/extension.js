const Gio = imports.gi.Gio;
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
        parent: windowActor,
        margin: 25,
        xFactor: this._settings.get_double("x-position"),
        yFactor: this._settings.get_double("y-position"),
        scrollback: this._settings.get_double("scrollback"),
      });

      chat.addInfo("Twitch Overlay enabled");

      // Make sure any settings changes get updated
      const xFactorHandlerID = this._settings.connect(
        "changed::x-position",
        () => {
          chat.xFactor = this._settings.get_double("x-position");
        }
      );
      const yFactorHandlerID = this._settings.connect(
        "changed::y-position",
        () => {
          chat.yFactor = this._settings.get_double("y-position");
        }
      );
      const scrollbackHandlerID = this._settings.connect(
        "changed::scrollback",
        () => {
          chat.scrollback = this._settings.get_double("scrollback");
        }
      );

      const onClose = () =>
        chat.addInfo("Twitch connection closed. Restart extension");
      const onMessage = (message) => {
        switch (message.command) {
          case "PRIVMSG":
            {
              const [channel, text] = message.params;
              chat.addMessage(message.tags["display-name"] || "UNKNOWN", text);
            }
            break;
          case "PING":
            this._twitchIRC.send("PONG :tmi.twitch.tv");
            break;
        }
      };
      this._twitchIRC.on("close", onClose);
      this._twitchIRC.on("message", onMessage);

      windowActor.connect("destroy", () => {
        this._twitchIRC.remove("close", onClose);
        this._twitchIRC.remove("message", onMessage);

        this._settings.disconnect(xFactorHandlerID);
        this._settings.disconnect(yFactorHandlerID);
        this._settings.disconnect(scrollbackHandlerID);
      });
      windowActor.add_child(chat.container);
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
