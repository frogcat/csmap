(function() {

  var red = [];
  for (var i = 0x7f; i >= 0; i--)
    red.push([0x7f, i, i, 0xff]);
  for (var i = 0x7f; i >= 0; i--)
    red.push([i, 0, 0, 0xff]);

  var blue = [];
  for (var i = 0; i <= 0x7f; i++)
    blue.push([0, 0, i, 0xff]);
  for (var i = 0; i <= 0x7f; i++)
    blue.push([i, i, 0x7f, 0xff]);

  var tick = [];
  for (var i = 0; i < 256; i++)
    tick.push(Math.pow(Math.tan((Math.PI / 2) * (i / 256)), 2));

  var elev = function(dems, x, y) {
    var a = dems[(x > 0xff) + !(x < 0) + 3 * ((y > 0xff) + !(y < 0))];
    return a ? a[(((y + 0x100) & 0xff) << 8) + ((x + 0x100) & 0xff)] : NaN;
  };

  var calc = function(dems, x, y, unit) {
    var nw = elev(dems, x - 1, y - 1);
    var n = elev(dems, x, y - 1);
    var ne = elev(dems, x + 1, y - 1);
    var w = elev(dems, x - 1, y);
    var c = elev(dems, x, y);
    var e = elev(dems, x + 1, y);
    var sw = elev(dems, x - 1, y + 1);
    var s = elev(dems, x, y + 1);
    var se = elev(dems, x + 1, y + 1);

    var curvature = c * 4 - (n + w + s + e);
    var sx = (ne + e * 2 + se) - (nw + w * 2 + sw);
    var sy = (nw + n * 2 + ne) - (sw + s * 2 + se);

    curvature /= unit;
    sx /= unit;
    sy /= unit;

    var slope = sx * sx + sy * sy;

    if (isNaN(curvature) || isNaN(slope))
      return [0, 0, 0, 0x7f];

    for (var i = 0; i < 0x100; i++) {
      if (tick[i] < slope)
        continue;

      var j = Math.round(0x80 + 0x80 * curvature * 2);
      j = (j < 0 ? 0 : (j > 0xff ? 0xff : j));

      var bg = red[i];
      var fg = blue[j];

      return [
        bg[0] + fg[0],
        bg[1] + fg[1],
        bg[2] + fg[2],
        0xff
      ];
    }
    return [0, 0, 0, 0x7f];
  };

  var draw = function(dems, data, unit) {
    for (var i = 0xffff; i >= 0; i--) {
      var a = calc(dems, i & 0xff, i >> 8, unit);
      var j = i << 2;
      data[j + 0] = a[0];
      data[j + 1] = a[1];
      data[j + 2] = a[2];
      data[j + 3] = a[3];
    }
  };

  var DEMCurvatureSlopeLayer = L.GridLayer.extend({
    options: {
      updateWhenZooming: false,
      updateWhenIdle: false
    },
    initialize: function(url, options) {
      this._url = url;
      this._cache = {};
      L.setOptions(this, options);
    },
    getEvents: function() {
      var events = L.GridLayer.prototype.getEvents.call(this);
      events.zoomstart = this._abort;
      return events;
    },
    _abort: function(e) {
      var cache = this._cache;
      Object.keys(cache).forEach(function(key) {
        try {
          if (cache[key].xhr) cache[key].xhr.abort();
        } catch (e) {}
      });
      this._cache = {};
    },
    _load: function(url) {
      var cache = this._cache;
      if (cache.hasOwnProperty(url))
        return cache[url];
      var xhr = new XMLHttpRequest();
      var promise = cache[url] = new Promise(function(resolve) {
        xhr.onloadend = function() {
          resolve(cache[url] = xhr.status !== 200 ?
            null :
            xhr.responseText.split(/[\n,]/).map(function(t) {
              return parseFloat(t);
            }));
        };
        xhr.open("GET", url);
        xhr.send();
      });
      promise.xhr = xhr;
      return promise;
    },
    getTileSize: function() {
      var a = (this._tileZoom - this.options.maxNativeZoom);
      var p = L.point(this.options.tileSize, this.options.tileSize);
      return (!isNaN(a) && a > 0 ? p.multiplyBy(1 << a) : p);
    },
    createTile: function(coords, done) {
      var opt = this.options;
      var div = L.DomUtil.create("div", "leaflet-tile");
      var cvs = div.appendChild(document.createElement("canvas"));
      cvs.width = opt.tileSize;
      cvs.height = opt.tileSize;

      var dz = coords.z - opt.maxNativeZoom;
      if (!isNaN(dz) && dz > 0) {
        cvs.style.transformOrigin = "0 0";
        cvs.style.transform = "scale(" + (1 << dz) + ")";
        coords.z = opt.maxNativeZoom;
      }

      var promises = [];
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          promises.push(this._load(L.Util.template(this._url, {
            z: coords.z,
            x: coords.x + dx,
            y: coords.y + dy
          })));
        }
      }

      Promise.all(promises).then(function(dems) {
        var unit = 10 * Math.pow(2, 14 - coords.z);
        var ctx = cvs.getContext("2d");
        var img = ctx.createImageData(cvs.width, cvs.height);
        draw(dems, img.data, unit);
        ctx.putImageData(img, 0, 0);
        if (done) done(null, div);
      });
      return div;
    }
  });

  L.demCurvatureSlopeLayer = function(url, options) {
    return new DEMCurvatureSlopeLayer(url, options);
  };

})();
