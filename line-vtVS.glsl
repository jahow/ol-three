varying vec4 vColor;
varying vec2 vTilePos;
varying float vTileZoom;

attribute vec4 color;
attribute vec4 params;   // flags, line width, miter limit, <available>
attribute vec4 neighbours;

uniform float resolution;
uniform vec2 uScreenSize;
uniform float fov;		// in rads

float epsilon = 0.00000001;

void alongNormal(out vec2 offset, in vec2 tangent, in float direction, in float linewidth) {
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));
  offset = linewidth / 2.0 * normal * direction;
}

bool checkFlag(in float flags, in float bit) {
  return abs(mod(floor(flags / pow(2.0, bit)), 2.0) - 1.0) < epsilon;
}

void main(void) {
  vec2 prev = neighbours.xy;
  vec2 current = position.xy;
  vec2 next = neighbours.zw;

  // compute the size of one unit on screen; used to render a constant line width
  vec4 worldPos = modelMatrix * vec4(current, 0.0, 1.0);
  float angle = fov / uScreenSize.y;
  float scaling = modelMatrix[0][0];
  float unitSize = length(cameraPosition - worldPos.xyz) * tan(angle) / scaling;

  vec2 offset = vec2(0.0);
  float flags = abs(params.x);
  bool isLineStart = checkFlag(flags, 0.0);
  bool isCap = checkFlag(flags, 1.0);
  bool isRound = checkFlag(flags, 2.0);
  float direction = sign(params.x);
  float linewidth = params.y * unitSize;    // line width is always the same regardless of eye pos
  float miterLimit = params.z;

  if (isCap) {
    // todo
  } else if (isLineStart) {
    alongNormal(offset, next - current, direction, linewidth);
  } else {
    alongNormal(offset, current - prev, direction, linewidth);
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(current + offset, 0.0, 1.0);
  vColor = color;
  vTileZoom = position.z;
  vTilePos = current + offset;
}
