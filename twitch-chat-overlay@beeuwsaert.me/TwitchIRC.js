const Soup = imports.gi.Soup;
const GObject = imports.gi.GObject;
const byteArray = imports.byteArray;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { parseMessage } = Me.imports.parseIRC;

const TWITCH_SERVER = "wss://irc-ws.chat.twitch.tv:443";

var TwitchIRC = class TwitchIRC {
  constructor({ server = TWITCH_SERVER, channel = null } = {}) {
    this._server = server;
    this._authenticated = false;
    this._websocket = null;

    this._channel = channel;
  }

  get channel() {
    return this._channel;
  }
  set channel(newChannel) {
    const oldChannel = this.channel;
    if (typeof newChannel !== "string")
      throw new Error(`Expected "string" got ${typeof value}`);

    if (this._authenticated) {
      // Don't needlessly swap channels
      if (oldChannel === newChannel) {
        log("Attempt to leave and join the same channel");
        return;
      }

      if (oldChannel) this._part(oldChannel);
      this._join(newChannel);
    }

    this._channel = newChannel;
  }

  _part(channel) {
    this.send(`PART #${channel}`);
    this.emit("leave-channel", channel);
  }

  _join(channel) {
    this.send(`JOIN #${channel}`);
    this.emit("join-channel", channel);
  }

  establishConnection() {
    if (this._websocket) {
      throw new Error("already connected!");
    }
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

      this.emit("message", message);
    });
  }

  authenticate() {
    if (!this._websocket) {
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

    if (this.channel) this._join(this.channel);

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
};
Signals.addSignalMethods(TwitchIRC.prototype);
