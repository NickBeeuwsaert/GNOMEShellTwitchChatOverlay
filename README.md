# GNOME Shell Twitch Chat Overlay

An extension to overlay twitch chat on top of your windows

## Installation

Head over to the [releases](https://github.com/NickBeeuwsaert/GNOMEShellTwitchChatOverlay/releases) page, and download the latest release.

Install it using `gnome-extensions install twitch-chat-overlay@beeuwsaert.me.zip`

## Development

First clone, and symlink the extension to your gnome extensions directory

```sh
git clone git@github.com:NickBeeuwsaert/GNOMEShellTwitchChatOverlay.git
cd GNOMEShellTwitchChatOverlay
glib-compile-schemas ./twitch-chat-overlay@beeuwsaert.me/schemas/
ln -s ./twitch-chat-overlay@beeuwsaert.me ~/.local/share/gnome-shell/extensions/twitch-chat-overlay@beeuwsaert.me
```

Then, restart GNOME Shell by pressing `Alt+F2` and typing `r<Enter>`

Next, open up the Extensions app and configure `Twitch Chat Overlay`, setting the window title to the title of the game you want to overlay, and your twitch channel. the defaults are not suitable unless you are me and are streaming Path of Exile.

Finally, in the extensions app, enable the extension.

This is currently tested on GNOME Shell 3.36.0.

Merge Requests are welcome.

## Screenshots

Those are in the screenshots directory.

## Caveats

The following is a list of things to keep in mind when using this extension

1. This extension connects to twitch as soon as its enabled, so make sure to disable it after every use
2. Autoreconnect hasn't been implemented, so network issues could break the plugin
