(function() {

  var Loader = {
    cache: {},
    load: function(coords, dx, dy) {
      var url = L.Util.template("https://cyberjapandata.gsi.go.jp/xyz/{id}/{z}/{x}/{y}.txt", {
        x: coords.x + dx,
        y: coords.y + dy,
        z: coords.z,
        id: coords.z <= 8 ? "demgm" : "dem"
      });

      if (!Loader.cache[url]) {
        Loader.cache[url] = new Promise(function(resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.onload = function() {
            var unit = 10 * Math.pow(2, 14 - coords.z);
            resolve(xhr.responseText.split(/[\n,]/).map(function(t) {
              return parseFloat(t) / unit;
            }));
          };
          xhr.onerror = function() {
            resolve(null);
          };
          xhr.open('GET', url);
          xhr.send();
        });
      }
      return Loader.cache[url];
    }
  };

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

  var calc = function(dems, x, y) {
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

  var draw = function(dems, data) {
    for (var i = 0xffff; i >= 0; i--) {
      var a = calc(dems, i & 0xff, i >> 8);
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
      opacity: 0.8
    },
    getTileSize: function() {
      var a = 256 << Math.max(0, this._tileZoom - 14);
      return L.point(a, a);
    },
    createTile: function(coords, done) {
      var div = L.DomUtil.create("div", "leaflet-tile");
      var cvs = div.appendChild(document.createElement("canvas"));
      cvs.width = 256;
      cvs.height = 256;
      if (coords.z > 14) {
        cvs.style.transformOrigin = "0 0";
        cvs.style.transform = "scale(" + Math.pow(2, coords.z - 14) + ")";
        coords.z = 14;
      }

      Promise.all([
        Loader.load(coords, -1, -1),
        Loader.load(coords, 0, -1),
        Loader.load(coords, 1, -1),
        Loader.load(coords, -1, 0),
        Loader.load(coords, 0, 0),
        Loader.load(coords, 1, 0),
        Loader.load(coords, -1, 1),
        Loader.load(coords, 0, 1),
        Loader.load(coords, 1, 1)
      ]).then(function(dems) {
        var ctx = cvs.getContext("2d");
        var img = ctx.createImageData(cvs.width, cvs.height);
        draw(dems, img.data);
        ctx.putImageData(img, 0, 0);
        if (done) done(null, div);
      });
      return div;
    }
  });

  L.demCurvatureSlopeLayer = function(options) {
    return new DEMCurvatureSlopeLayer(options);
  };

})();
