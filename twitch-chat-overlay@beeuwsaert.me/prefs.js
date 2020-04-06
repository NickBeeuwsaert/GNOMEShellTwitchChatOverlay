"use strict";

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { throttle } = Me.imports.throttle;

function init() {}

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

  const mainGrid = builder.get_object("main-grid");
  this.settings.bind(
    "x-position",
    builder.get_object("x-position-adjustment"),
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );
  this.settings.bind(
    "y-position",
    builder.get_object("y-position-adjustment"),
    "value",
    Gio.SettingsBindFlags.DEFAULT
  );

  // Right now these fire too quicky, need to find a way to debounce them
  const twitchChannelEntry = builder.get_object("twitch-channel");

  // Wait for the user to stop typing to update the twitch-channel setting
  twitchChannelEntry.connect(
    "notify::text",
    throttle(() => {
      this.settings.set_string("twitch-channel", twitchChannelEntry.get_text());
    }, 5000)
  );

  this.settings.bind(
    "window-regex",
    builder.get_object("window-regex"),
    "text",
    Gio.SettingsBindFlags.DEFAULT
  );
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

  mainGrid.show_all();

  return mainGrid;
}
