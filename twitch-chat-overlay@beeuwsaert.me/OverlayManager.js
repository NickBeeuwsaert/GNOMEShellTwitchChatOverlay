const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { TwitchIRC } = Me.imports.TwitchIRC;
const { Chat, CHAT_ACTOR_NAME } = Me.imports.Chat;

const parseColor = (colorString) => {
  const [success, color] = Clutter.Color.from_string(colorString);

  if (success) return color;

  throw new Error(`Invalid Color: ${colorString}`);
};

var OverlayManager = class OverlayManager {
  constructor(settings) {
    this._settings = settings;
    this._twitchIRC = new TwitchIRC({
      channel: this._settings.get_string("twitch-channel"),
    });

    this._channelHandlerID = null;
    const connectionHandlerID = this._twitchIRC.connect("connected", () => {
      this._twitchIRC.disconnect(connectionHandlerID);
      this._twitchIRC.authenticate();

      this._channelHandlerID = this._settings.connect(
        "changed::twitch-channel",
        () => {
          this._twitchIRC.channel = this._settings.get_string("twitch-channel");
        }
      );
    });
    this._twitchIRC.establishConnection();
    this._predicateHandler = this._settings.connect(
      "changed::window-regex",
      () => {
        this.removeAllOverlays();
        this.addOverlays();
      }
    );
    this._windowHandlerID = global.display.connect(
      "window-created",
      (_, window) => this._overlayWindowHandler(window.get_compositor_private())
    );
    this._settings.connect("changed::disable-unredirect", () =>
      this._handleUnredirect()
    );

    this.addOverlays();
    this._handleUnredirect();
  }

  _handleUnredirect() {
    if (this._settings.get_boolean("disable-unredirect")) {
      Meta.disable_unredirect_for_display(global.display);
    } else {
      Meta.enable_unredirect_for_display(global.display);
    }
  }

  overlayWindowActor(windowActor) {
    const chat = new Chat({
      xFactor: this._settings.get_double("x-position"),
      yFactor: this._settings.get_double("y-position"),
      chatWidth: this._settings.get_double("chat-width"),
      chatFont: this._settings.get_string("chat-font"),
      scrollback: this._settings.get_double("scrollback"),
      chatTextColor: parseColor(this._settings.get_string("chat-text-color")),
      chatBackgroundColor: parseColor(
        this._settings.get_string("chat-background-color")
      ),
    });
    chat.addInfo("Twitch Overlay enabled");

    // Make sure any settings changes get updated
    for (const propertyName of ["chat-text-color", "chat-background-color"]) {
      const handlerID = this._settings.connect(`changed::${propertyName}`, () =>
        chat.set_property(
          propertyName,
          parseColor(this._settings.get_string(propertyName))
        )
      );

      chat.connect("destroy", () => this._settings.disconnect(handlerID));
    }

    for (const [setting, property = setting] of [
      ["x-position", "x-factor"],
      ["y-position", "y-factor"],
      ["chat-width"],
      ["scrollback"],
      ["chat-font"],
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
            break;
          case "s":
            [value] = variant.get_string();
            break;
        }
        if (value !== null) {
          chat.set_property(property, value);
        }
      });

      chat.connect("destroy", () => this._settings.disconnect(handlerID));
    }

    const closeHandlerID = this._twitchIRC.connect("close", () =>
      chat.addInfo("Twitch connection closed. Restart extension")
    );
    const messageHandlerID = this._twitchIRC.connect(
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
    const joinHandlerID = this._twitchIRC.connect(
      "join-channel",
      (_, channel) => {
        chat.addInfo(`Joining #${channel}`);
      }
    );
    const leaveHandlerID = this._twitchIRC.connect(
      "leave-channel",
      (_, channel) => {
        chat.addInfo(`Leaving #${channel}`);
      }
    );

    chat.connect("destroy", () => {
      this._twitchIRC.disconnect(closeHandlerID);
      this._twitchIRC.disconnect(messageHandlerID);
      this._twitchIRC.disconnect(joinHandlerID);
      this._twitchIRC.disconnect(leaveHandlerID);
    });

    windowActor.add_child(chat);
  }

  removeAllOverlays() {
    for (const windowActor of global.get_window_actors()) {
      for (const child of windowActor.get_children()) {
        if (child.name === CHAT_ACTOR_NAME) {
          child.destroy();
        }
      }
    }
  }

  _overlayWindowHandler(windowActor) {
    const window = windowActor.get_meta_window();
    const windowTitleRegex = new RegExp(
      this._settings.get_string("window-regex")
    );

    if (windowTitleRegex.test(window.title)) {
      this.overlayWindowActor(windowActor);
    }
  }

  addOverlays() {
    global
      .get_window_actors()
      .forEach((windowActor) => this._overlayWindowHandler(windowActor));
  }

  shutdown() {
    Meta.enable_unredirect_for_display(global.display);

    this._settings.disconnect(this._predicateHandler);
    this._settings.disconnect(this._unredirectHandler);
    this._settings.disconnect(this._channelHandlerID);
    global.display.disconnect(this._windowHandlerID);
    this.removeAllOverlays();
    this._twitchIRC.close();

    this._twitchIRC = null;
    this._settings = null;
  }
};
