uniform sampler2D uMaskTexture;

varying vec2 vScreenUV;
varying vec4 vColor;
varying vec2 vTilePos;
varying float vTileZoom;

void main(void) {
  vec4 maskValue = texture2D(uMaskTexture, vScreenUV);
  if (maskValue.r > (vTileZoom * 0.01 + 0.009)) {
    discard;
  }
  if (vTilePos.x < 0.0 || vTilePos.x > 4096.0 || vTilePos.y < 0.0 || vTilePos.y > 4096.0) {
    discard;
  }
  gl_FragColor = vColor;
}
