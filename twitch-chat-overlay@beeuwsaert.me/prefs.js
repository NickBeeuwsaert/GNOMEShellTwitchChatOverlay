"use strict";

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { throttle } = Me.imports.throttle;

function init() {}

function handleColorChange(settings, propertyName) {
  return function (widget) {
    settings.set_string(propertyName, widget.get_rgba().to_string());
  };
}
const setErrorIfEmptyHandler = (widget) => {
  const styleContext = widget.get_style_context();
  const callback = () => {
    if (widget.get_text() === "") {
      styleContext.add_class("error");
    } else {
      styleContext.remove_class("error");
    }
  };
  widget.connect("notify::text", callback);
  callback();
};

const bindTimeout = (settings, setting, widget, timeout) => {
  const callback = () => {
    log("!!!");
    settings.set_string(setting, widget.get_text());
  };

  widget.connect("notify::text", throttle(callback, timeout));
  widget.connect("activate", callback);

  settings.connect(`changed::${setting}`, () => {
    widget.set_text(settings.get_string(setting));
  });

  widget.set_text(settings.get_string(setting));
};
function initColorWidget(widget, color) {
  const rgba = new Gdk.RGBA();
  rgba.parse(color);
  widget.set_rgba(rgba);
}

function buildPrefsWidget() {
  let gschema = Gio.SettingsSchemaSource.new_from_directory(
    Me.dir.get_child("schemas").get_path(),
    Gio.SettingsSchemaSource.get_default(),
    false
  );

  // I don't know why I am assigning settings to this, but it was in
  // the documentation like this so I'm running with it
  this.settings = new Gio.Settings({
    settings_schema: gschema.lookup(
      "org.gnome.shell.extensions.twitchoverlay",
      true
    ),
  });
  const builder = Gtk.Builder.new_from_file(
    Me.dir.get_child("ui/prefs.ui").get_path()
  );
  const chatTextColor = builder.get_object("chat-text-color");
  const chatBackgroundColor = builder.get_object("chat-background-color");

  const mainGrid = builder.get_object("main-grid");

  ["y-position", "x-position"].forEach((name) => {
    this.settings.bind(
      name,
      builder.get_object(`${name}-adjustment`),
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );

    builder
      .get_object(name)
      .connect("format-value", (_, value) => `${(value * 100).toFixed(0)}%`);
  });

  this.settings.bind(
    "chat-width",
    builder.get_object("chat-width-adjustment"),
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );

  // Right now these fire too quicky, need to find a way to debounce them
  const twitchChannelEntry = builder.get_object("twitch-channel");

  twitchChannelEntry.set_text(this.settings.get_string("twitch-channel"));
  setErrorIfEmptyHandler(twitchChannelEntry);
  bindTimeout(this.settings, "twitch-channel", twitchChannelEntry, 5000);

  const windowRegexEntry = builder.get_object("window-regex");

  setErrorIfEmptyHandler(windowRegexEntry);
  bindTimeout(this.settings, "window-regex", windowRegexEntry, 5000);

  this.settings.bind(
    "scrollback",
    builder.get_object("scrollback-adjustment"),
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );
  this.settings.bind(
    "disable-unredirect",
    builder.get_object("disable-unredirect"),
    "active",
    Gio.SettingsBindFlags.DEFAULT
  );
  this.settings.bind(
    "chat-font",
    builder.get_object("chat-font"),
    "font",
    Gio.SettingsBindFlags.DEFAULT
  );

  initColorWidget(chatTextColor, this.settings.get_string("chat-text-color"));
  initColorWidget(
    chatBackgroundColor,
    this.settings.get_string("chat-background-color")
  );
  chatTextColor.connect(
    "color-set",
    handleColorChange(this.settings, "chat-text-color")
  );
  chatBackgroundColor.connect(
    "color-set",
    handleColorChange(this.settings, "chat-background-color")
  );

  mainGrid.show_all();

  mainGrid.connect("parent-set", () => {
    mainGrid.parent.connect("destroy", () => {
      this.settings.set_string("twitch-channel", twitchChannelEntry.text);
      this.settings.set_string("window-regex", windowRegexEntry.text);
    });
  });

  return mainGrid;
}
