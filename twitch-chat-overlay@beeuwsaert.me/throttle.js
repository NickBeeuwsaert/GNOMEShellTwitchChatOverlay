const GLib = imports.gi.GLib;

var throttle = function throttle(cb, delay) {
  let timeoutID = null;
  return (...args) => {
    if (timeoutID) GLib.Source.remove(timeoutID);

    timeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      cb(...args);
      // Return false to cancel the timeout
      timeoutID = null;
      return false;
    });
  };
};
