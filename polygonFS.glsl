uniform sampler2D uMaskTexture;

varying vec2 vScreenUV;
varying vec4 vColor;
varying float vTileZoom;

void main(void) {
  vec4 maskValue = texture2D(uMaskTexture, vScreenUV);
  if (maskValue.r > (vTileZoom * 0.01 + 0.009)) {
    discard;
  } else {
    gl_FragColor = vColor;
  }
}
