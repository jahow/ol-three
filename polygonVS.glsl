varying vec2 vScreenUV;
varying vec4 vColor;
varying float vTileZoom;
attribute vec4 color;

void main(void) {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vScreenUV = vec2(
    gl_Position.x / gl_Position.z * 0.5 + 0.5,
    gl_Position.y / gl_Position.z * 0.5 + 0.5
  );
  vColor = color;
  vTileZoom = position.z;
}
