var EventEmitter = class EventEmitter {
  constructor() {
    this._events = {};
  }

  on(event, callback) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(callback);
  }

  remove(event, callback) {
    // If there are no callbacks, don't bother removing anything
    if (!this._events[event]) return;
    this._events[event] = this._events.filter((cb) => cb !== callback);
  }

  once(event, callback) {
    const cb = (...args) => {
      callback(...args);
      this.remove(event, cb);
    };

    this.on(event, cb);
  }

  fire(event, ...args) {
    // If there are no callbacks, don't bother firing
    if (!this._events[event]) return;

    for (const callback of this._events[event]) {
      callback(...args);
    }
  }
};
