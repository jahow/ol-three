import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { Float32BufferAttribute } from 'three/src/core/BufferAttribute';
import * as earcut from 'earcut';

const LINE_OPS = {
  STARTCAP_UP: 0,
  STARTCAP_DOWN: 1,
  ENDCAP_UP: 2,
  ENDCAP_DOWN: 3,
  LINESTART_UP: 4,
  LINESTART_DOWN: 5,
  LINEEND_UP: 6,
  LINEEND_DOWN: 7
};

export class PolygonGeometry extends BufferGeometry {
  constructor(params) {
    super();

    this._arrays = {
      positions: [],
      colors: [],
      uvs: [],
      indices: []
    };
    this._baseZ = (params && params.baseZ) || 0;
  }

  hasGeometry() {
    return !!this._arrays.positions.length;
  }

  // coords are expected to be flat arrays with a stride of 3
  // color is an array of 4 values between 0 and 1
  pushPolygon(color, stride, coords, outerStart, outerEnd, holeEnds) {
    const indexOffset = this._arrays.positions.length / 3;
    let i,
      l = holeEnds.length ? holeEnds[holeEnds.length - 1] : outerEnd;

    // add vertices & colors to arrays (up to end of last hole)
    for (i = outerStart; i < l; i += stride) {
      this._arrays.positions.push(coords[i], coords[i + 1], this._baseZ);
      this._arrays.colors.push(
        color[0] / 255,
        color[1] / 255,
        color[2] / 255,
        color[3]
      );
      this._arrays.uvs.push(coords[i], coords[i + 1]); // world uvs
    }

    const holeStarts = holeEnds.slice();
    holeStarts.unshift(outerEnd);
    holeStarts.pop();
    for (i = 0; i < holeStarts.length; i++) {
      holeStarts[i] = (holeStarts[i] - outerStart) / stride;
    }

    // triangulate shape to add indices
    const prevLength = this._arrays.indices.length;
    Array.prototype.push.apply(
      this._arrays.indices,
      earcut(this._arrays.positions.slice(indexOffset * 3), holeStarts, 3)
    );
    for (i = prevLength; i < this._arrays.indices.length; i++) {
      this._arrays.indices[i] += indexOffset;
    }

    return this;
  }

  // applies all pending modifications to the mesh
  // (previous geometry will be lost)
  commit() {
    this.addAttribute(
      'position',
      new Float32BufferAttribute(this._arrays.positions, 3)
    );
    this.addAttribute(
      'color',
      new Float32BufferAttribute(this._arrays.colors, 4)
    );
    this.addAttribute('uv', new Float32BufferAttribute(this._arrays.uvs, 2));
    this.setIndex(this._arrays.indices);

    this._arrays.positions.length = 0;
    this._arrays.uvs.length = 0;
    this._arrays.colors.length = 0;
    this._arrays.indices.length = 0;
  }
}

export class LinestringGeometry extends BufferGeometry {
  constructor(params) {
    super();

    this._arrays = {
      positions: [],
      neighbours: [],
      colors: [],
      params: [],
      indices: []
    };
    this._baseZ = (params && params.baseZ) || 0;
  }

  hasGeometry() {
    return !!this._arrays.positions.length;
  }

  _appendVertex(
    params,
    width,
    color,
    currX,
    currY,
    prevX,
    prevY,
    nextX,
    nextY,
    operation
  ) {
    this._arrays.positions.push(currX, currY, this._baseZ);
    this._arrays.colors.push(
      color[0] / 255,
      color[1] / 255,
      color[2] / 255,
      color[3]
    );
    this._arrays.neighbours.push(prevX, prevY, nextX, nextY);
    let direction =
      operation === LINE_OPS.STARTCAP_UP ||
      operation === LINE_OPS.LINESTART_UP ||
      operation === LINE_OPS.LINEEND_UP
        ? 1.0
        : -1.0;
    const isLineStart =
      operation === LINE_OPS.STARTCAP_UP ||
      operation === LINE_OPS.STARTCAP_DOWN ||
      operation === LINE_OPS.LINESTART_UP ||
      operation === LINE_OPS.LINESTART_DOWN;
    const isCap =
      operation === LINE_OPS.STARTCAP_UP ||
      operation === LINE_OPS.STARTCAP_DOWN ||
      operation === LINE_OPS.ENDCAP_UP ||
      operation === LINE_OPS.ENDCAP_DOWN;
    const isRound =
      operation === LINE_OPS.CAP_UP || operation === LINE_OPS.CAP_DOWN
        ? params.cap === 'round'
        : params.join === 'round';
    const flags =
      (isLineStart ? 1 : 0) + (isCap ? 2 : 0) + (isRound ? 4 : 0) + 8;
    this._arrays.params.push(
      flags * direction,
      width,
      params.miterLimit || 0,
      0.0 // free slot
    );
  }

  // a line is a series of segments
  // coords are expected to be flat arrays
  // params: join ('bevel'/'round'/null), cap ('square'/'round'/null), miterLimit, closed (bool)
  // color is an array of 4 values [0-255, 0-255, 0-255, 0-1]
  pushLine(params, width, color, coords, start, end, stride) {
    if (!color) {
      return;
    }
    let lineOffset,
      currX,
      currY,
      prevX,
      prevY,
      nextX,
      nextY,
      nextNextX,
      nextNextY;
    let i;
    for (i = start; i < end - stride; i += stride) {
      // line (only joins, no cap)
      lineOffset = this._arrays.positions.length / 3;
      currX = coords[i];
      currY = coords[i + 1];
      prevX = i > 0 ? coords[i - stride] : coords[start];
      prevY = i > 0 ? coords[i - stride + 1] : coords[start + 1];
      nextX = coords[i + stride];
      nextY = coords[i + stride + 1];
      nextNextX =
        i < end - stride * 2 ? coords[i + stride * 2] : coords[end - stride];
      nextNextY =
        i < end - stride * 2
          ? coords[i + stride * 2 + 1]
          : coords[end - stride + 1];
      this._appendVertex(
        params,
        width,
        color,
        currX,
        currY,
        prevX,
        prevY,
        nextX,
        nextY,
        LINE_OPS.LINESTART_DOWN
      );
      this._appendVertex(
        params,
        width,
        color,
        currX,
        currY,
        prevX,
        prevY,
        nextX,
        nextY,
        LINE_OPS.LINESTART_UP
      );
      this._appendVertex(
        params,
        width,
        color,
        nextX,
        nextY,
        currX,
        currY,
        nextNextX,
        nextNextY,
        LINE_OPS.LINEEND_DOWN
      );
      this._appendVertex(
        params,
        width,
        color,
        nextX,
        nextY,
        currX,
        currY,
        nextNextX,
        nextNextY,
        LINE_OPS.LINEEND_UP
      );
      // join area: TODO
      // segment
      this._arrays.indices.push(
        lineOffset + 0,
        lineOffset + 2,
        lineOffset + 3,
        lineOffset + 0,
        lineOffset + 3,
        lineOffset + 1
      );
    }

    return this;
  }

  // applies all pending modifications to the mesh
  // (previous geometry will be lost)
  commit() {
    this.addAttribute(
      'position',
      new Float32BufferAttribute(this._arrays.positions, 3)
    );
    this.addAttribute(
      'neighbours',
      new Float32BufferAttribute(this._arrays.neighbours, 4)
    );
    this.addAttribute(
      'params',
      new Float32BufferAttribute(this._arrays.params, 4)
    );
    this.addAttribute(
      'color',
      new Float32BufferAttribute(this._arrays.colors, 4)
    );
    this.setIndex(this._arrays.indices);

    this._arrays.positions.length = 0;
    this._arrays.neighbours.length = 0;
    this._arrays.params.length = 0;
    this._arrays.colors.length = 0;
    this._arrays.indices.length = 0;
  }
}
