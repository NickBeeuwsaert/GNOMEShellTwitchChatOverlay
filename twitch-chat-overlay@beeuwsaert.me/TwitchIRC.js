const Soup = imports.gi.Soup;
const GObject = imports.gi.GObject;
const byteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { parseMessage } = Me.imports.parseIRC;

const TWITCH_SERVER = "wss://irc-ws.chat.twitch.tv:443";

var IRCMessage = GObject.registerClass(
  {
    GTypeName: "IRCMessage",
  },
  class IRCMessage extends GObject.Object {
    _init({ raw, tags, prefix, command, params }) {
      super._init();

      this.raw = raw;
      this.tags = tags;
      this.prefix = prefix;
      this.command = command;
      this.params = params;
    }
  }
);

var TwitchIRC = GObject.registerClass(
  {
    GTypeName: "TwitchIRC",
    Signals: {
      message: {
        flags: GObject.SignalFlags.RUN_FIRST,
        param_types: [GObject.TYPE_OBJECT],
        return_type: GObject.TYPE_NONE,
        accumulator: GObject.AccumulatorType.NONE,
      },
      connected: {},
      error: {},
      close: {},
    },
    Properties: {
      websocket: GObject.ParamSpec.object(
        "websocket",
        "Websocket",
        "The websocket, or null",
        GObject.ParamFlags.READABLE,
        Soup.WebsocketConnection.$gtype
      ),
      channel: GObject.ParamSpec.string(
        "channel",
        "Channel",
        "The Channel that is currently connected",
        GObject.ParamFlags.READWRITE,
        null
      ),
    },
  },
  class TwitchIRC extends GObject.Object {
    _init({ server = TWITCH_SERVER } = {}) {
      super._init();
      this._server = server;
      this._authenticated = false;
    }

    get websocket() {
      if (this._websocket === undefined) {
        this._websocket = null;
      }

      return this._websocket;
    }

    get channel() {
      if (this._channel === undefined) {
        this._channel = null;
      }

      return this._channel;
    }
    set channel(newChannel) {
      const oldChannel = this.channel;
      if (typeof newChannel !== "string")
        throw new Error(`Expected "string" got ${typeof value}`);

      // Don't needlessly swap channels
      if (oldChannel === newChannel) return;

      if (oldChannel) this.send(`PART #${oldChannel}`);
      this.send(`JOIN #${newChannel}`);

      this._channel = newChannel;
      this.notify("channel");
    }

    establishConnection() {
      const session = new Soup.Session();
      const message = new Soup.Message({
        method: "GET",
        uri: new Soup.URI(this._server),
      });

      session.websocket_connect_async(message, "origin", [], null, (_, res) => {
        try {
          const websocket = session.websocket_connect_finish(res);
          websocket.connect("message", (_, type, data) =>
            this._handleMessage(type, data)
          );
          websocket.connect("error", (_, err) => this.emit("error", err));
          websocket.connect("closed", () => this.close());
          this._websocket = websocket;

          this.emit("connected");
        } catch (e) {
          this.emit("error", e);
        }
      });
    }

    _handleMessage(type, data) {
      // Skip over non-text messages
      if (type !== Soup.WebsocketDataType.TEXT) return;

      const text = byteArray.toString(byteArray.fromGBytes(data));

      text.split(/\r\n/).forEach((rawMessage) => {
        if (rawMessage.trim().length === 0) return;

        const message = parseMessage(rawMessage);

        if (message.command === "PING") {
          this.send("PONG :tmi.twitch.tv");
        }

        this.emit("message", new IRCMessage(message));
      });
    }

    authenticate() {
      if (!this.websocket) {
        throw new Error("Not connected");
      }

      if (this._authenticated) return;
      // Fun fact: you can connect to the twitch IRC endpoints anonymously
      // with a justinfan#### username

      const username = `justinfan${Math.floor(Math.random() * 80000 + 1000)}`;
      this.send(
        "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership"
      );
      this.send(`NICK ${username}`);

      this._authenticated = true;
    }

    send(text) {
      if (!this._websocket) throw new Error("Not connected");
      this._websocket.send_text(text);
    }
    close() {
      if (
        this._websocket &&
        this._websocket.get_state() === Soup.WebsocketState.OPEN
      ) {
        this._websocket.close(Soup.WebsocketCloseCode.NORMAL, null);
      }
      this._websocket = null;
      this._authenticated = false;
      this.emit("close");
    }
  }
);
