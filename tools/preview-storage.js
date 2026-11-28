// Put into a preview build only (see vite.config.ts): it runs before the game and gives the preview
// a browser store of its own. A preview lives on the same address as the live game, so without this
// it would read and write the player's real saved game.
//
// The first time a preview is opened it starts from a copy of the live game's progress; from then
// on everything it keeps is under its own prefix, and the live game's keys are never written.
(function () {
  var name = __PREVIEW__;
  var real;
  try {
    real = window.localStorage;
  } catch (e) {
    return;
  }
  if (!real) return;
  var pre = '3da-preview/' + name + '/';
  var copied = '3da-preview-copied/' + name;
  var ours = function (k) {
    return k.indexOf('3da-preview') !== 0 && (k.indexOf('3da-') === 0 || k === 'drive-it-3d');
  };
  var all = function () {
    var out = [];
    for (var i = 0; i < real.length; i++) out.push(real.key(i));
    return out;
  };
  var keys = function () {
    return all()
      .filter(function (k) { return k && k.indexOf(pre) === 0; })
      .map(function (k) { return k.slice(pre.length); });
  };
  try {
    if (real.getItem(copied) === null) {
      all().forEach(function (k) {
        if (k && ours(k)) real.setItem(pre + k, real.getItem(k));
      });
      real.setItem(copied, new Date().toISOString());
    }
  } catch (e) {
    /* a full store: the preview starts with what it could copy */
  }
  var store = {
    getItem: function (k) { return real.getItem(pre + k); },
    setItem: function (k, v) { real.setItem(pre + k, String(v)); },
    removeItem: function (k) { real.removeItem(pre + k); },
    key: function (i) { var k = keys()[i]; return k === undefined ? null : k; },
    clear: function () { keys().forEach(function (k) { real.removeItem(pre + k); }); },
  };
  Object.defineProperty(store, 'length', { get: function () { return keys().length; } });
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true });
  var robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex';
  document.head.appendChild(robots);
})();
