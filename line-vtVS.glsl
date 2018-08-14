varying vec2 vScreenUV;
varying vec4 vColor;
varying vec2 vTilePos;
varying float vTileZoom;

attribute vec4 color;
attribute vec4 params;   // flags, line width, miter limit, <available>
attribute vec4 neighbours;

uniform float resolution;

float epsilon = 0.00000001;

void alongNormal(out vec2 offset, in vec2 tangent, in float direction, in float linewidth) {
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));
  offset = linewidth / 2.0 * normal * direction;
}

bool checkFlag(in float flags, in float bit) {
  return abs(mod(floor(flags / pow(2.0, bit)), 2.0) - 1.0) < epsilon;
}

void main(void) {
  // apply model matrix to a unit
  float unitSize = length(modelMatrix * vec4(1.0, 0.0, 0.0, 1.0) - modelMatrix * vec4(0.0, 0.0, 0.0, 1.0));

  vec2 offset = vec2(0.0);
  float flags = abs(params.x);
  bool isLineStart = checkFlag(flags, 0.0);
  bool isCap = checkFlag(flags, 1.0);
  bool isRound = checkFlag(flags, 2.0);
  float direction = sign(params.x);
  float linewidth = params.y * resolution / unitSize;    // line width is always the same regardless of eye pos
  float miterLimit = params.z;
  vec2 prev = neighbours.xy;
  vec2 current = position.xy;
  vec2 next = neighbours.zw;

  if (isCap) {
    // todo
  } else if (isLineStart) {
    alongNormal(offset, next - current, direction, linewidth);
  } else {
    alongNormal(offset, current - prev, direction, linewidth);
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(current + offset, 0.0, 1.0);
  vScreenUV = vec2(
    gl_Position.x / gl_Position.z * 0.5 + 0.5,
    gl_Position.y / gl_Position.z * 0.5 + 0.5
  );
  vColor = color;
  vTileZoom = position.z;
  vTilePos = current + offset;
}
