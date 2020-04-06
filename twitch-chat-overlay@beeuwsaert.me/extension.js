const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { TwitchIRC } = Me.imports.TwitchIRC;
const { Chat } = Me.imports.Chat;

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

    this._overlayedWindows = [];
    this._windowHandlerID = null;
  }

  enable() {
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
    if (this._windowHandlerID) global.display.disconnect(this._windowHandlerID);

    this._windowHandlerID = null;
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

      // Make sure any settings changes get updated
      this._settings.connect("changed::x-position", () => {
        chat.xFactor = this._settings.get_double("x-position");
      });
      this._settings.connect("changed::y-position", () => {
        chat.yFactor = this._settings.get_double("y-position");
      });
      this._settings.connect("changed::scrollback", () => {
        chat.scrollback = this._settings.get_double("scrollback");
      });

      this._twitchIRC.on("message", (message) => {
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
      });
      windowActor.add_child(chat.container);
      this._overlayedWindows.push({ chat, windowActor });
      windowActor.connect("destroy", () => {
        this._overlayedWindows = this._overlayedWindows.filter(
          ({ windowActor: wA }) => windowActor !== wA
        );
      });
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
    for (const { chat, windowActor } of this._overlayedWindows) {
      windowActor.remove_child(chat.container);
    }
    this._overlayedWindows = [];
  }
  disable() {
    this._twitchIRC.close();
    this._unoverlayWindows();
    this._clearHandlers();
  }
}

function init() {
  return new Extension();
}
