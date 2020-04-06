const Soup = imports.gi.Soup;
const byteArray = imports.byteArray;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { parseMessage } = Me.imports.parseIRC;
const { EventEmitter } = Me.imports.EventEmitter;

function _ws_connect(uri, cb) {
  const session = new Soup.Session();
  const message = new Soup.Message({
    method: "GET",
    uri: Soup.URI.new(uri),
  });

  session.websocket_connect_async(message, "origin", [], null, (_, res) => {
    try {
      cb(null, session.websocket_connect_finish(res));
    } catch (e) {
      cb(e);
    }
  });
}

// TODO: Implement reconnecting...
var TwitchIRC = class TwitchIRC {
  constructor() {
    this._websocket = null;
    this._event_emitter = new EventEmitter();
    this._authenticated = false;
  }

  connect(callback) {
    if (this._websocket) {
      callback();
      return;
    }
    _ws_connect("wss://irc-ws.chat.twitch.tv:443", (err, connection) => {
      if (err) {
        throw err;
      }
      this._websocket = connection;
      connection.connect("message", (_, type, data) => {
        if (type !== Soup.WebsocketDataType.TEXT) return;

        const text = byteArray.toString(byteArray.fromGBytes(data));

        text.split(/\r\n/).forEach((rawMessage) => {
          if (rawMessage.trim().length === 0) return;
          this._event_emitter.fire("message", parseMessage(rawMessage));
        });
      });

      connection.connect("error", (_, err) => {
        log(err);
      });
      connection.connect("closed", () => log("closed"));

      callback();
    });
  }

  authenticate() {
    if (!this._websocket) {
      throw new Error("Not connected");
    }
    if (this._authenticated) return;
    // Fun fact: you can connect to the twitch IRC endpoints with a justinfan username
    const username = `justinfan${Math.floor(Math.random() * 80000 + 1000)}`;
    this.send(
      "CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership"
    );
    this.send(`NICK ${username}`);

    this._authenticated = true;
  }

  join(channel) {
    this.send(`JOIN #${channel}`);
    return () => this.leave(channel);
  }
  leave(channel) {
    this.send(`PART #${channel}`);
  }

  send(text) {
    this._websocket.send_text(text);
  }

  on(event, cb) {
    this._event_emitter.on(event, cb);
  }

  close() {
    this._websocket.close(Soup.WebsocketCloseCode.NORMAL, null);
    this._websocket = null;
    this._authenticated = false;
  }
};
