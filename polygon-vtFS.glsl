uniform sampler2D uMaskTexture;
uniform vec2 uScreenSize;

varying vec2 vScreenUV;
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

  // debug: show tile seams
  // if (vTilePos.x < 256.0) {
  //   gl_FragColor.x = 0.0;
  // } else if (vTilePos.x > 4096.0 - 256.0) {
  //   gl_FragColor.x = 1.0;
  // }
  // if (vTilePos.y < 256.0) {
  //   gl_FragColor.y = 0.0;
  // } else if (vTilePos.y > 4096.0 - 256.0) {
  //   gl_FragColor.y = 1.0;
  // }
}
