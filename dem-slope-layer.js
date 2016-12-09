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
  var draw = function(img, dem) {
    for (var i = 0; i <= 0xffff; i++) {
      var c = slope(dem, i);

      /*
              var t = c / 0xff;
              img.data[i * 4 + 0] = 0xff + (0xcc - 0xff) * t;
              img.data[i * 4 + 1] = 0xff + (0x33 - 0xff) * t;
              img.data[i * 4 + 2] = 0xff + (0x00 - 0xff) * t;
              img.data[i * 4 + 3] = 0xff;
      */



      if (c < 0xa0) {
        var t = c / 0xa0;
        img.data[i * 4 + 0] = 0xff + (0xff - 0xff) * t;
        img.data[i * 4 + 1] = 0xff + (0x33 - 0xff) * t;
        img.data[i * 4 + 2] = 0xff + (0x00 - 0xff) * t;
        img.data[i * 4 + 3] = 0xff;
      } else {
        var t = (c - 0xa0) / (0xff - 0xa0);
        img.data[i * 4 + 0] = 0xff + (0x33 - 0xff) * t;
        img.data[i * 4 + 1] = 0x33 + (0x00 - 0x33) * t;
        img.data[i * 4 + 2] = 0x00 + (0x00 - 0x00) * t;
        img.data[i * 4 + 3] = 0xff;
      }
    }
  };

  var tmpl = "https://cyberjapandata.gsi.go.jp/xyz/dem/{z}/{x}/{y}.txt";

  var DEMSlopeLayer = L.GridLayer.extend({
    getTileSize: function() {
      var a = 256 * Math.pow(2, Math.max(0, this._tileZoom - 14));
      return L.point(a, a);
    },
    createTile: function(coords, done) {

      var div = L.DomUtil.create('div', 'leaflet-tile');
      var cvs = div.appendChild(document.createElement('canvas'));
      cvs.width = 256;
      cvs.height = 256;
      if (coords.z > 14) {
        cvs.style.transform = "scale(" + Math.pow(2, coords.z - 14) + ")";
        cvs.style.transformOrigin = "0 0";
        coords.z = 14;
      }

      var unit = 10 * Math.pow(2, 14 - coords.z);

      fetch(L.Util.template(tmpl, coords)).then(function(a) {
        return a.text();
      }).then(function(txt) {
        var dem = txt.split(/[\n,]/, 0xffff).map(function(t) {
          return parseFloat(t) / unit;
        });
        if (dem.length === 0xffff) {
          var ctx = cvs.getContext('2d');
          var img = ctx.createImageData(256, 256);
          draw(img, dem);
          ctx.putImageData(img, 0, 0);
        }
        if (done) done(null, div);
      });
      return div;
    }
  });

  L.demSlopeLayer = function(option) {
    return new DEMSlopeLayer(option);
  };

})();
