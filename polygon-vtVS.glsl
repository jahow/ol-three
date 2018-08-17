varying vec4 vColor;
varying vec2 vTilePos;
varying float vTileZoom;
attribute vec4 color;

void main(void) {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
  vColor = color;
  vTileZoom = position.z;
  vTilePos = position.xy;
}
