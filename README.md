# GNOME Shell Twitch Chat Overlay

An extension to overlay twitch chat on top of your windows

## Installation

Head over to the [releases](https://github.com/NickBeeuwsaert/GNOMEShellTwitchChatOverlay/releases) page, and download the latest release.

Install it using `gnome-extensions install twitch-chat-overlay@beeuwsaert.me.zip`

## Usage

After installing, there will be a new top panel icon in gnome shell, click it and choose `Open Twitch Overlay Preferences`

Setting the window title to the title of the game you want to overlay, and your twitch channel. The overlay will not start if these are blank.

Close the preferences to save the settings.

Finally, click on the panel icon again and choose `Enable Overlay`

## Development

First clone, and symlink the extension to your gnome extensions directory

```sh
git clone git@github.com:NickBeeuwsaert/GNOMEShellTwitchChatOverlay.git
cd GNOMEShellTwitchChatOverlay
glib-compile-schemas ./twitch-chat-overlay@beeuwsaert.me/schemas/
ln -s ./twitch-chat-overlay@beeuwsaert.me ~/.local/share/gnome-shell/extensions/twitch-chat-overlay@beeuwsaert.me
gnome-extensions enable twitch-chat-overlay@beeuwsaert.me
```

## Screenshots

Those are in the screenshots directory.

## Caveats

The following is a list of things to keep in mind when using this extension

1. This extension connects to twitch as soon as its enabled, so make sure to disable it after every use
2. Autoreconnect hasn't been implemented, so network issues could break the plugin
