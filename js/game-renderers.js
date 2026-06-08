(function () {
  window.gameRenderers = window.gameRenderers || {};

  window.registerGameRenderer = function (name, renderer) {
    if (!name || typeof renderer !== 'function') {
      console.error('registerGameRenderer requiere un nombre y una funcion renderer.');
      return;
    }
    window.gameRenderers[name] = renderer;
  };

  window.getGameRenderer = function (name) {
    return window.gameRenderers[name];
  };
})();
