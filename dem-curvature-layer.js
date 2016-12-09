(function() {

  var draw = function(img, dem) {

    for (var i = 0; i <= 0xffff; i++) {
      var c = 0x7f;
      if (i > 0x100)
        c += (dem[i] - dem[i - 0x100]);
      if (i < 0xff00)
        c += (dem[i] - dem[i + 0x100]);
      if (i % 256 !== 0)
        c += (dem[i] - dem[i - 1]);
      if (i % 256 !== 0xff)
        c += (dem[i] - dem[i + 1]);

      var t = c / 0xff;
      img.data[i * 4 + 0] = 0x00 + (0xff - 0x00) * t;
      img.data[i * 4 + 1] = 0x00 + (0xff - 0x00) * t;
      img.data[i * 4 + 2] = 0x40 + (0xff - 0x40) * t;
      img.data[i * 4 + 3] = 0xff;
    }
  }
  var tmpl = "https://cyberjapandata.gsi.go.jp/xyz/dem/{z}/{x}/{y}.txt";


  var DEMCurvatureLayer = L.GridLayer.extend({
    getTileSize: function() {
      var a = 512 * Math.pow(2, Math.max(0, this._tileZoom - 15));
      return L.point(a, a);
    },
    createTile: function(coords, done) {
      var scale = 2;
      coords.z--;
      while (coords.z > 14) {
        coords.z--;
        scale *= 2;
      }
      var div = L.DomUtil.create('div', 'leaflet-tile');
      var cvs = div.appendChild(document.createElement('canvas'));
      cvs.width = 256;
      cvs.height = 256;
      cvs.style.transform = "scale(" + scale + ")";
      cvs.style.transformOrigin = "0 0";

      var unit = 10 * Math.pow(2, 14 - coords.z);
      fetch(L.Util.template(tmpl, coords)).then(function(a) {
        return a.text();
      }).then(function(txt) {
        var dem = txt.split(/[\n,]/, 0xffff).map(function(t) {
          return Math.floor(parseFloat(t) * 0xff / unit);
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

  L.demCurvatureLayer = function(option) {
    return new DEMCurvatureLayer(option);
  };

})();
