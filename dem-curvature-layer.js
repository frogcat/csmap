(function() {

  var draw = function(img, dem) {


    for (var y = 1; y <= 256; y++) {
      for (var x = 1; x <= 256; x++) {
        var c = 0x7f;
        c += dem[y * 258 + x] * 4;
        c -= dem[(y - 1) * 258 + x];
        c -= dem[(y + 1) * 258 + x];
        c -= dem[y * 258 + x + 1];
        c -= dem[y * 258 + x - 1];
        var i = (y - 1) * 0x100 + (x - 1);

        /*
                  var t = c / 0xff;
                  img.data[i * 4 + 0] = 0x00 + (0xff - 0x00) * t;
                  img.data[i * 4 + 1] = 0x00 + (0xff - 0x00) * t;
                  img.data[i * 4 + 2] = 0x90 + (0xff - 0x90) * t;
                  img.data[i * 4 + 3] = 0xff;

        */

        if (c < 0x80) {
          var t = c / 0x80;
          img.data[i * 4 + 0] = 0x00 + (0x44 - 0x00) * t;
          img.data[i * 4 + 1] = 0x00 + (0x44 - 0x00) * t;
          img.data[i * 4 + 2] = 0x00 + (0xff - 0x00) * t;
          img.data[i * 4 + 3] = 0xff;
        } else {
          var t = (c - 0x80) / (0xff - 0x80);
          img.data[i * 4 + 0] = 0x44 + (0xff - 0x44) * t;
          img.data[i * 4 + 1] = 0x44 + (0xff - 0x44) * t;
          img.data[i * 4 + 2] = 0xff + (0xff - 0xff) * t;
          img.data[i * 4 + 3] = 0xff;
        }
      }
    }
  };

  var load = function(coords, dx, dy) {
    return fetch(L.Util.template("https://cyberjapandata.gsi.go.jp/xyz/dem/{z}/{x}/{y}.txt", {
      x: coords.x + dx,
      y: coords.y + dy,
      z: coords.z
    })).then(function(a) {
      return a.text();
    }).then(function(txt) {
      var unit = 10 * Math.pow(2, 14 - coords.z);
      var a = txt.split(/[\n,]/, 0xffff).map(function(t) {
        return Math.floor(parseFloat(t) * 0xff / unit);
      });
      return a.length === 0xffff ? a : null;
    })
  };

  var DEMCurvatureLayer = L.GridLayer.extend({
    getTileSize: function() {
      var a = 512 * Math.pow(2, Math.max(0, this._tileZoom - 15));
      return L.point(a, a);
    },
    createTile: function(coords, done) {
      var div = L.DomUtil.create('div', 'leaflet-tile');
      var scale = 2;
      coords.z--;
      while (coords.z > 14) {
        coords.z--;
        scale *= 2;
      }
      var cvs = div.appendChild(document.createElement('canvas'));
      cvs.width = 256;
      cvs.height = 256;
      cvs.style.transform = "scale(" + scale + ")";
      cvs.style.transformOrigin = "0 0";

      var promises = [];
      promises.push(load(coords, 0, 0));
      promises.push(load(coords, 0, -1));
      promises.push(load(coords, 0, 1));
      promises.push(load(coords, -1, 0));
      promises.push(load(coords, 1, 0));

      Promise.all(promises).then(a => {
        var c = a[0];
        var n = a[1];
        var s = a[2];
        var w = a[3];
        var e = a[4];

        var err = NaN;
        var dem = [];

        //header
        dem.push(err);
        for (var i = 0; i <= 0xff; i++)
          dem.push(n ? n[0xff00 + i] : err);
        dem.push(err);

        // body
        for (var y = 0; y <= 0xff; y++) {
          dem.push(w ? w[0x100 * y + 0xff] : err);
          for (var x = 0; x <= 0xff; x++) {
            dem.push(c ? c[y * 0x100 + x] : err);
          }
          dem.push(e ? e[0x100 * y] : err);
        }

        //footer
        dem.push(err);
        for (var i = 0; i <= 0xff; i++)
          dem.push(s ? s[i] : err);
        dem.push(err);

        var ctx = cvs.getContext('2d');
        var img = ctx.createImageData(256, 256);
        draw(img, dem);
        ctx.putImageData(img, 0, 0);

        if (done) done(null, div);
      });
      return div;
    }
  });

  L.demCurvatureLayer = function(options) {
    return new DEMCurvatureLayer(options);
  };

})();
