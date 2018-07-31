varying vec2 vScreenUV;
varying vec4 vColor;
varying float vTileZoom;

void main(void) {
  gl_FragColor = vec4(vTileZoom * 0.01, 0.0, 0.0, 1.0);
}
