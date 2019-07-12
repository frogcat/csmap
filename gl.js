function $gl(gl) {
  var pg = gl.createProgram();
  var params = {};
  var length = 0;
  var textures = [];
  var frames = [];
  var getFrame = function(index) {
    if (!textures[index]) return null;
    if (!frames[index]) {
      frames[index] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, frames[index]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[index], 0);
    }
    return frames[index];
  };
  return {
    shader: function(src) {
      var s = gl.createShader(src.indexOf("gl_FragColor") === -1 ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(pg, s);
      src.split(";").forEach(function(a) {
        if (a.match(/^\s*(uniform|attribute)\s*([^\s]+)\s*([^\s]+)[\s]*$/))
          params[RegExp.$3] = RegExp.$1 + "/" + RegExp.$2;
      });
      if (gl.getAttachedShaders(pg).length === 2) {
        gl.linkProgram(pg);
        if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw gl.getProgramInfoLog(pg);
        gl.useProgram(pg);
      }
      return this;
    },
    bind: function(key, val) {
      switch (params[key]) {
        case "attribute/vec2":
          if (length === 0) {
            var buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(val), gl.STATIC_DRAW);
            var location = gl.getAttribLocation(pg, key);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
            length = val.length / 2;
          } else {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(val));
          }
          break;
        case "uniform/float":
          var location = gl.getUniformLocation(pg, key);
          gl.uniform1f(location, val);
          break;
        case "uniform/int":
          var location = gl.getUniformLocation(pg, key);
          gl.uniform1i(location, val);
          break;
        case "uniform/vec2":
          var location = gl.getUniformLocation(pg, key);
          gl.uniform2f(location, val[0], val[1]);
          break;
        case "uniform/vec3":
          var location = gl.getUniformLocation(pg, key);
          gl.uniform3f(location, val[0], val[1], val[2]);
          break;
        case "uniform/vec4":
          var location = gl.getUniformLocation(pg, key);
          gl.uniform4f(location, val[0], val[1], val[2], val[3]);
          break;
        case "uniform/mat2":
          var location = gl.getUniformLocation(pg, key);
          gl.uniformMatrix2fv(location, false, val);
          break;
        case "uniform/mat3":
          var location = gl.getUniformLocation(pg, key);
          gl.uniformMatrix3fv(location, false, val);
          break;
        case "uniform/mat4":
          var location = gl.getUniformLocation(pg, key);
          gl.uniformMatrix4fv(location, false, val);
          break;
        case "uniform/sampler2D":
          var texture = textures[val]; //(val instanceof WebGLTexture) ? val : this.texture(val);
          var index = val; //textures.indexOf(texture);
          gl.activeTexture(gl["TEXTURE" + index]);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          var location = gl.getUniformLocation(pg, key);
          gl.uniform1i(location, index);
          break;
        default:
          console.error("unknown type", key, params[key]);
      }
      return this;
    },
    texture: function(index, img) {
      if (!textures[index]) textures[index] = gl.createTexture();
      var t = textures[index];
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return this;
    },
    viewport: function(x, y, w, h) {
      gl.viewport(x, y, w, h);
      return this;
    },
    points: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.POINTS, 0, length);
      return this;
    },
    lines: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.LINES, 0, length);
      return this;
    },
    lineStrip: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.LINE_STRIP, 0, length);
      return this;
    },
    lineLoop: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.LINE_LOOP, 0, length);
      return this;
    },
    triangles: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.TRIANGLES, 0, length);
      return this;
    },
    triangleStrip: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, length);
      return this;
    },
    triangleFan: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.drawArrays(gl.TRIANGLE_FAN, 0, length);
      return this;
    },
    clear: function(index) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, getFrame(index));
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return this;
    },
    pixels: function() {
      var pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    }
  };
}
