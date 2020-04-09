const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const GObject = imports.gi.GObject;

var CHAT_ACTOR_NAME = "twitchOverlay";

var Chat = GObject.registerClass(
  {
    GTypeName: "ChatActor",
    Properties: {
      "chat-width": GObject.ParamSpec.double(
        "chat-width", // name
        "Chat Width",
        "Preferred width of chat window", // description
        GObject.ParamFlags.READWRITE, // Read-write
        1, // min
        1000,
        512 // default value
      ),
      "chat-font": GObject.ParamSpec.string(
        "chat-font", // name
        "Chat Font",
        "Font to use for messages", // description
        GObject.ParamFlags.READWRITE, // Read-write
        null // default value
      ),
      "chat-background-color": GObject.ParamSpec.boxed(
        "chat-background-color", // name
        "Chat Background Color",
        "color of chat window", // description
        GObject.ParamFlags.READWRITE, // Read-write
        Clutter.Color.$gtype
      ),
      "chat-text-color": GObject.ParamSpec.boxed(
        "chat-text-color", // name
        "Chat text Color",
        "color of chat text", // description
        GObject.ParamFlags.READWRITE, // Read-write
        Clutter.Color.$gtype
      ),
      "x-factor": GObject.ParamSpec.double(
        "x-factor", // name
        "X Alignment factor",
        "Where the chatbox aligns on the X axis", // description
        GObject.ParamFlags.READWRITE, // Read-write
        0, // min
        1, // max
        1 // default value
      ),
      "y-factor": GObject.ParamSpec.double(
        "y-factor", // name
        "Y Alignment factor",
        "Where the chatbox aligns on the Y axis", // description
        GObject.ParamFlags.READWRITE, // Read-write
        0, // min
        1, // max
        0.5 // default value
      ),
      scrollback: GObject.ParamSpec.int(
        "scrollback", // name
        "Scrollback",
        "Max Scrollback", // description
        GObject.ParamFlags.READWRITE, // Read-write
        0, // min
        1000, // max
        25 // default value
      ),
    },
  },
  class ChatActor extends Clutter.Actor {
    _init(props) {
      super._init({
        ...props,
        name: CHAT_ACTOR_NAME,
        x: 0,
        y: 0,
      });

      const bindConstraint = new Clutter.BindConstraint({
        source: null,
        coordinate: Clutter.BindCoordinate.SIZE,
        offset: 0,
      });
      this.add_constraint(bindConstraint);
      this.connect("parent-set", () =>
        bindConstraint.set_source(this.get_parent())
      );
      this.connect("notify::scrollback", () => this._trimMessages());

      this._chatActor = new Clutter.Actor({
        backgroundColor: this.chat_background_color,
        width: this.chat_width,
        backgroundColor: this.chat_background_color,
        layoutManager: new Clutter.BoxLayout({
          orientation: Clutter.Orientation.VERTICAL,
        }),
      });

      const verticalConstraint = new Clutter.AlignConstraint({
        name: "vertical",
        factor: this.y_factor,
        source: this,
        alignAxis: Clutter.AlignAxis.Y_AXIS,
      });
      const horizontalConstraint = new Clutter.AlignConstraint({
        name: "horizontal",
        factor: this.x_factor,
        source: this,
        alignAxis: Clutter.AlignAxis.X_AXIS,
      });

      this.bind_property(
        "chat-width",
        this._chatActor,
        "width",
        GObject.BindingFlags.DEFAULT
      );
      this.bind_property(
        "chat-background-color",
        this._chatActor,
        "background-color",
        GObject.BindingFlags.DEFAULT
      );

      for (const [constraint, propertyName] of [
        [horizontalConstraint, "x-factor"],
        [verticalConstraint, "y-factor"],
      ]) {
        this.bind_property(
          propertyName,
          constraint,
          "factor",
          GObject.BindingFlags.DEFAULT
        );
      }

      this._chatActor.add_constraint(horizontalConstraint);
      this._chatActor.add_constraint(verticalConstraint);
      this.add_child(this._chatActor);
    }

    // GObject Properties MUST be snake case, or notify won't work
    get chat_width() {
      if (!this._chatWidth) {
        this._chatWidth = 512;
      }
      return this._chatWidth;
    }

    set chat_width(value) {
      if (typeof value !== "number")
        throw Error(`Expected "number" got "${typeof value}"`);

      if (this.chat_width === value) return;

      this._chatWidth = value;
      this.notify("chat-width");
    }

    get chat_font() {
      if (this._chatFont === undefined) {
        this._chatFont = null;
      }
      return this._chatFont;
    }

    set chat_font(value) {
      if (typeof value !== "string")
        throw Error(`Expected "string" got "${typeof value}"`);

      if (this.chat_font === value) return;

      this._chatFont = value;
      this.notify("chat-font");
    }

    get x_factor() {
      if (this._xFactor === undefined) {
        this._xFactor = 1;
      }
      return this._xFactor;
    }

    set x_factor(value) {
      if (typeof value !== "number")
        throw Error(`Expected "number" got "${typeof value}"`);

      if (this.x_factor === value) return;

      this._xFactor = value;
      this.notify("x-factor");
    }
    get y_factor() {
      if (this._yFactor === undefined) {
        this._yFactor = 0.5;
      }
      return this._yFactor;
    }

    set y_factor(value) {
      if (typeof value !== "number")
        throw Error(`Expected "number" got "${typeof value}"`);

      if (this.y_factor === value) return;

      this._yFactor = value;
      this.notify("y-factor");
    }

    get chat_background_color() {
      if (!this._chatBgColor) {
        this._chatBgColor = new Clutter.Color({
          red: 0,
          green: 0,
          blue: 0,
          alpha: 127,
        });
      }
      return this._chatBgColor;
    }

    set chat_background_color(value) {
      if (!(value instanceof Clutter.Color)) {
        throw Error("Expected a Clutter.Color");
      }

      this._chatBgColor = value;
      this.notify("chat-background-color");
    }

    get chat_text_color() {
      if (!this._chatTextColor) {
        this._chatTextColor = new Clutter.Color({
          red: 255,
          green: 255,
          blue: 255,
          alpha: 255,
        });
      }
      return this._chatTextColor;
    }

    set chat_text_color(value) {
      if (!(value instanceof Clutter.Color)) {
        throw Error("Expected a Clutter.Color");
      }

      this._chatTextColor = value;
      this.notify("chat-text-color");
    }

    get scrollback() {
      if (this._scrollback === undefined) {
        this._scrollback = 25;
      }
      return this._scrollback;
    }
    set scrollback(value) {
      if (typeof value !== "number")
        throw Error(`Expected "number" got "${typeof value}"`);

      if (this.scrollback === value) return;

      this._scrollback = value;
      this.notify("scrollback");
    }

    // End GObject property accessors

    /* Convienence accessors for people who don't like mixing camel case and snake case */
    get chatWidth() {
      return this.chat_width;
    }
    set chatWidth(value) {
      this.chat_width = value;
    }
    get chatFont() {
      return this.chat_font;
    }
    set chatFont(value) {
      this.chat_font = value;
    }

    get xFactor() {
      return this.x_factor;
    }
    set xFactor(value) {
      this.x_factor = value;
    }

    get yFactor() {
      return this.y_factor;
    }
    set yFactor(value) {
      this.y_factor = value;
    }

    get chatBackgroundColor() {
      return this.chat_background_color;
    }
    set chatBackgroundColor(value) {
      this.chat_background_color = value;
    }

    get chatTextColor() {
      return this.chat_text_color;
    }
    set chatTextColor(value) {
      this.chat_text_color = value;
    }

    addInfo(message) {
      const infoActor = new Clutter.Text({
        lineWrap: true,
        text: message,
        color: this.chat_text_color,
        fontName: this.chat_font,
        xExpand: true,
      });

      this.bind_property(
        "chat-text-color",
        infoActor,
        "color",
        GObject.BindingFlags.DEFAULT
      );
      this.bind_property(
        "chat-font",
        infoActor,
        "font-name",
        GObject.BindingFlags.DEFAULT
      );
      this._addLine(infoActor);
    }

    addMessage(from, message) {
      const boldAttributeList = new Pango.AttrList();
      boldAttributeList.insert(Pango.attr_weight_new(Pango.Weight.BOLD));
      const fromActor = new Clutter.Text({
        text: `${from}: `,
        color: this.chat_text_color,
        fontName: this.chat_font,
        attributes: boldAttributeList,
        xExpand: false,
        yExpand: true,
        yAlign: Clutter.ActorAlign.START,
      });
      const messageActor = new Clutter.Text({
        lineWrap: true,
        text: message,
        fontName: this.chat_font,
        color: this.chat_text_color,
        xExpand: true,
        yAlign: Clutter.ActorAlign.START,
        lineWrap: true,
        lineWrapMode: Pango.WrapMode.WORD_CHAR,
      });
      const contentActor = new Clutter.Actor({
        layoutManager: new Clutter.BoxLayout({}),
        yExpand: true,
      });

      this.bind_property(
        "chat-text-color",
        fromActor,
        "color",
        GObject.BindingFlags.DEFAULT
      );
      this.bind_property(
        "chat-text-color",
        messageActor,
        "color",
        GObject.BindingFlags.DEFAULT
      );
      this.bind_property(
        "chat-font",
        fromActor,
        "font-name",
        GObject.BindingFlags.DEFAULT
      );
      this.bind_property(
        "chat-font",
        messageActor,
        "font-name",
        GObject.BindingFlags.DEFAULT
      );

      contentActor.add_child(fromActor);
      contentActor.add_child(messageActor);

      this._addLine(contentActor);
    }

    _trimMessages() {
      while (this.scrollback < this._chatActor.get_n_children()) {
        this._chatActor.remove_child(this._chatActor.get_first_child());
      }
    }

    _addLine(actor) {
      this._chatActor.add_child(actor);
      this._trimMessages();
    }
  }
);
