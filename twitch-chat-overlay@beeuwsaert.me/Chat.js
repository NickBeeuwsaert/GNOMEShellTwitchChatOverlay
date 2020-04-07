const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;

var CHAT_ACTOR_NAME = "twitchOverlay";
var Chat = class Chat {
  constructor({
    parent,
    margin = 0,
    marginTop = margin,
    marginLeft = margin,
    marginRight = margin,
    marginBottom = margin,
    xFactor = 0,
    yFactor = 0,
    scrollback = 25,
  }) {
    this.container = new Clutter.Actor({
      name: CHAT_ACTOR_NAME,
      x: 0,
      y: 0,
      width: parent.width,
      height: parent.height,
    });
    parent.connect("notify::allocation", () => {
      this.container.width = parent.width;
      this.container.height = parent.height;
    });

    // TODO: Allow the user to customize chat colors
    // An Actor to contain the chat
    this._chatActor = new Clutter.Actor({
      width: 512,
      backgroundColor: new Clutter.Color({
        red: 0,
        green: 0,
        blue: 0,
        alpha: 127,
      }),
      layoutManager: new Clutter.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
      }),
    });
    this.container.add_child(this._chatActor);

    this._verticalConstraint = new Clutter.AlignConstraint({
      name: "vertical",
      factor: yFactor,
      source: this.container,
      alignAxis: Clutter.AlignAxis.Y_AXIS,
    });
    this._horizontalConstraint = new Clutter.AlignConstraint({
      name: "horizontal",
      factor: xFactor,
      source: this.container,
      alignAxis: Clutter.AlignAxis.X_AXIS,
    });

    this._chatActor.add_constraint(this._verticalConstraint);
    this._chatActor.add_constraint(this._horizontalConstraint);

    this.marginTop = marginTop;
    this.marginBottom = marginBottom;
    this.marginLeft = marginLeft;
    this.marginRight = marginRight;
    this.scrollback = scrollback;
  }

  _trimMessages() {
    while (this._scrollback < this._chatActor.get_n_children()) {
      this._chatActor.remove_child(this._chatActor.get_first_child());
    }
  }

  _addLine(actor) {
    this._chatActor.add_child(actor);
    this._trimMessages();
  }

  get _textColor() {
    return new Clutter.Color({
      red: 255,
      green: 255,
      blue: 255,
      alpha: 255,
    });
  }
  addMessage(from, message) {
    const boldAttributeList = new Pango.AttrList();
    boldAttributeList.insert(Pango.attr_weight_new(Pango.Weight.BOLD));
    const fromActor = new Clutter.Text({
      text: `${from}: `,
      color: this._textColor,
      attributes: boldAttributeList,
      xExpand: false,
      yExpand: true,
      yAlign: Clutter.ActorAlign.START,
    });
    const messageActor = new Clutter.Text({
      lineWrap: true,
      text: message,
      color: this._textColor,
      xExpand: true,
      yAlign: Clutter.ActorAlign.START,
      lineWrap: true,
      lineWrapMode: Pango.WrapMode.WORD_CHAR,
    });
    const contentActor = new Clutter.Actor({
      layoutManager: new Clutter.BoxLayout({}),
      yExpand: true,
    });
    contentActor.add_child(fromActor);
    contentActor.add_child(messageActor);

    this._addLine(contentActor);
  }

  addInfo(message) {
    this._addLine(
      new Clutter.Text({
        lineWrap: true,
        text: message,
        color: this._textColor,
        xExpand: true,
      })
    );
  }

  set scrollback(value) {
    this._scrollback = Math.floor(value);
    this._trimMessages();
  }

  set marginTop(value) {
    this._chatActor.marginTop = value;
  }
  set marginBottom(value) {
    this._chatActor.marginBottom = value;
  }
  set marginLeft(value) {
    this._chatActor.marginLeft = value;
  }
  set marginRight(value) {
    this._chatActor.marginRight = value;
  }

  set xFactor(value) {
    this._horizontalConstraint.factor = value;
  }
  set yFactor(value) {
    this._verticalConstraint.factor = value;
  }
};
