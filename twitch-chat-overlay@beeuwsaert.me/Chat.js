const Clutter = imports.gi.Clutter;

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
    this._actors = [];
    this.scrollback = scrollback;
    this.container = new Clutter.Actor({
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
      factor: xFactor,
      source: this.container,
      alignAxis: Clutter.AlignAxis.Y_AXIS,
    });
    this._horizontalConstraint = new Clutter.AlignConstraint({
      name: "horizontal",
      factor: yFactor,
      source: this.container,
      alignAxis: Clutter.AlignAxis.X_AXIS,
    });

    this._chatActor.add_constraint(this._verticalConstraint);
    this._chatActor.add_constraint(this._horizontalConstraint);

    this.marginTop = marginTop;
    this.marginBottom = marginBottom;
    this.marginLeft = marginLeft;
    this.marginRight = marginRight;
  }

  _trimMessages() {
    while (this._scrollback < this._actors.length) {
      this._chatActor.remove_child(this._actors.shift());
    }
  }

  addMessage(from, message) {
    const text = new Clutter.Text({
      lineWrap: true,
      useMarkup: true,
      text: `<b>${from}</b>: ${message}`,
      color: new Clutter.Color({
        red: 255,
        green: 255,
        blue: 255,
        alpha: 255,
      }),
      xExpand: true,
    });
    this._actors.push(text);
    this._chatActor.add_child(text);
    this._trimMessages();
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
