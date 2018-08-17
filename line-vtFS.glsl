uniform sampler2D uMaskTexture;
uniform vec2 uScreenSize;

varying vec4 vColor;
varying vec2 vTilePos;
varying float vTileZoom;

void main(void) {
  // filter out gutters
  if (vTilePos.x < 0.0 || vTilePos.x > 4096.0 || vTilePos.y < 0.0 || vTilePos.y > 4096.0) {
    discard;
  }

  // test against mask
  vec2 screen_uv = gl_FragCoord.xy / uScreenSize;
  vec4 maskValue = texture2D(uMaskTexture, screen_uv);
  if (maskValue.r > (vTileZoom * 0.01 + 0.005)) {
    discard;
  }
  gl_FragColor = vColor;
}
