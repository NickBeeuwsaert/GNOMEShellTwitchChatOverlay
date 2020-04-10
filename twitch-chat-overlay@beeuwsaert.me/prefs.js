"use strict";

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {}

function handleColorChange(settings, propertyName) {
  return function (widget) {
    settings.set_string(propertyName, widget.get_rgba().to_string());
  };
}

function initColorWidget(widget, color) {
  const rgba = new Gdk.RGBA();
  rgba.parse(color);
  widget.set_rgba(rgba);
}

function buildPrefsWidget() {
  // I don't know why I am assigning settings to this, but it was in
  // the documentation like this so I'm running with it
  this.settings = ExtensionUtils.getSettings();
  this.settings.delay();

  const builder = Gtk.Builder.new_from_file(
    Me.dir.get_child("ui/prefs.ui").get_path()
  );

  const chatTextColor = builder.get_object("chat-text-color");
  const chatBackgroundColor = builder.get_object("chat-background-color");

  const mainGrid = builder.get_object("main-grid");
  const twitchChannelEntry = builder.get_object("twitch-channel");
  const windowRegexEntry = builder.get_object("window-regex");
  const headerBar = builder.get_object("header-bar");
  const revertSettingsButton = builder.get_object("revert-settings");
  const applySettingsButton = builder.get_object("apply-settings");

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
  const isFormValid = () =>
    !(
      twitchChannelEntry.get_text() === "" || windowRegexEntry.get_text() === ""
    );

  const syncFormButtons = () => {
    const canSave = isFormValid();

    applySettingsButton.set_sensitive(canSave);
  };
  this.settings.connect("changed", syncFormButtons);
  this.settings.bind_property(
    "has-unapplied",
    revertSettingsButton,
    "sensitive",
    GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE
  );

  for (const name of ["y-position", "x-position"]) {
    this.settings.bind(
      name,
      builder.get_object(`${name}-adjustment`),
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );

    builder
      .get_object(name)
      .connect("format-value", (_, value) => `${(value * 100).toFixed(0)}%`);
  }

  this.settings.bind(
    "chat-width",
    builder.get_object("chat-width-adjustment"),
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );

  for (const [widget, setting] of [
    [twitchChannelEntry, "twitch-channel"],
    [windowRegexEntry, "window-regex"],
  ]) {
    setErrorIfEmptyHandler(widget);
    this.settings.bind(setting, widget, "text", Gio.SettingsBindFlags.DEFAULT);
  }

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

  for (const [widget, setting] of [
    [chatBackgroundColor, "chat-background-color"],
    [chatTextColor, "chat-text-color"],
  ]) {
    initColorWidget(widget, this.settings.get_string(setting));
    widget.connect("color-set", handleColorChange(this.settings, setting));
    this.settings.connect(`changed::${setting}`, () =>
      initColorWidget(widget, this.settings.get_string(setting))
    );
  }

  applySettingsButton.connect("clicked", () => {
    this.settings.apply();
  });
  revertSettingsButton.connect("clicked", () => {
    this.settings.revert();
  });

  mainGrid.connect("parent-set", () => {
    const topLevel = mainGrid.get_toplevel();

    topLevel.set_titlebar(headerBar);
    topLevel.connect("destroy", () => {
      if (isFormValid()) {
        this.settings.apply();
      }
    });
  });
  mainGrid.show_all();
  syncFormButtons();

  return mainGrid;
}
