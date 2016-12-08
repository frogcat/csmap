(function() {
  var ticker = [];
  for (var i = 0; i < 256; i++) {
    ticker.push(Math.pow(Math.tan((Math.PI / 2) * (i / 256)), 2));
  }

  var slope = function(a, i) {
    if (i % 256 === 0)
      return slope(a, i + 1);
    if (i % 256 === 255)
      return slope(a, i - 1);
    if (i < 256)
      return slope(a, i + 256);
    if (i >= 256 * 255)
      return slope(a, i - 256);

    var x = (a[i + 1] * 2 + a[i + 1 + 256] + a[i + 1 - 256]) - (a[i - 1] * 2 + a[i - 1 - 256] + a[i - 1 + 256]);
    var y = (a[i + 256] * 2 + a[i + 256 - 1] + a[i + 256 + 1]) - (a[i - 256] * 2 + a[i - 256 - 1] + a[i - 256 + 1]);
    var z = x * x + y * y;
    for (var i = 0; i < ticker.length; i++)
      if (ticker[i] >= z)
        return i;
    return 0;
  };

  var flatten = function(dem) {
    var a = [];
    for (var y = 0; y < 256; y++) {
      for (var x = 0; x < 256; x++) {
        var v = 0;
        var n = 0;
        var w = 1;
        for (var dy = -w; dy <= w; dy++) {
          for (var dx = -w; dx <= w; dx++) {
            if (x + dx >= 0 && x + dx < 256 && y + dy >= 0 && y + dy < 256) {
              var r = (w * 2 + 1) - dx - dy;
              v += (dem[256 * (y + dy) + (x + dx)]) * r;
              n += r;
            }
          }
        }
        a.push(v / n);
      }
    }
    return a;
  };

  var curve = function(a, i) {
    if (i % 256 === 0)
      return curve(a, i + 1);
    if (i % 256 === 255)
      return curve(a, i - 1);
    if (i < 256)
      return curve(a, i + 256);
    if (i >= 256 * 255)
      return curve(a, i - 256);

    var x = 0;
    x += (a[i - 256] - a[i]);
    x += (a[i - 1] - a[i]);
    x += (a[i + 1] - a[i]);
    x += (a[i + 256] - a[i]);

    x = Math.floor(128 - 128 * x * 2);
    return (x < 0 ? 0 : (x > 0xff ? 0xff : x));
  };

  var blend = function(a, b) {
    var alpha = b[3] / 0xff;
    return [
      Math.floor(a[0] * (1 - alpha) + b[0] * alpha),
      Math.floor(a[1] * (1 - alpha) + b[1] * alpha),
      Math.floor(a[2] * (1 - alpha) + b[2] * alpha),
      0xff
    ];
  };

  var DEMLayer = L.GridLayer.extend({
    getTileSize: function() {
      var size = L.point(256, 256);
      for (var i = 14; i < this._tileZoom; i++)
        size = size.multiplyBy(2);
      return size;
    },
    createTile: function(coords, done) {

      var scale = Math.pow(2, Math.max(coords.z - 14, 0));
      coords.z = Math.min(14, coords.z);

      var size = 10 * Math.pow(2, 14 - coords.z);
      var tmpl = "https://cyberjapandata.gsi.go.jp/xyz/dem/{z}/{x}/{y}.txt";
      var tile = L.DomUtil.create('div', 'leaflet-tile');
      var canvas = tile.appendChild(document.createElement('canvas'));
      canvas.width = 256;
      canvas.height = 256;
      if (scale > 1) {
        canvas.style.transform = "scale(" + scale + ")";
        canvas.style.transformOrigin = "0 0";
      }

      (new Promise(function(resolve, reject) {
        var x = new XMLHttpRequest();
        x.onreadystatechange = function() {
          if (x.readyState == 4)
            if (x.status == 200)
              resolve(x.responseText);
            else
              reject();
        }
        x.open("get", L.Util.template(tmpl, coords), true);
        x.send();
      })).then(function(txt) {
        var context = canvas.getContext('2d');
        var image = context.createImageData(256, 256);
        var dem = txt.split(/[\n,]/).map(function(t) {
          return parseInt(t) / size;
        });
        var f = flatten(dem);

        dem.forEach(function(a, i) {
          var s = slope(dem, i);
          var c = curve(f, i);

          var c1 = blend([0xff, 0xff, 0xff], [0xcc, 0x33, 0x00, s]);
          var c2 = blend([0x00, 0x00, 0x99], [0xff, 0xff, 0xff, c]);
          c2[3] = 0x7f;
          var c3 = blend(c1, c2);
          image.data[i * 4 + 0] = c3[0];
          image.data[i * 4 + 1] = c3[1];
          image.data[i * 4 + 2] = c3[2];
          image.data[i * 4 + 3] = c3[3];
        });
        context.putImageData(image, 0, 0);
        if (done)
          done(null, tile);
      });
      return tile;
    }
  });

  L.demLayer = function(option) {
    return new DEMLayer(option);
  };


})();
