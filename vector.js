import GeometryType from 'ol/geom/geometrytype';
import olproj from 'ol/proj';
import olcolor from 'ol/color';

export function renderFeature(
  olFeature,
  olStyles,
  polyGeom,
  lineGeom,
  proj1,
  proj2
) {
  const olGeom = olFeature.getGeometry();

  if (!olGeom) {
    return;
  }

  if (proj1 && proj2 && !olproj.equivalent(proj1, proj2)) {
    olGeom.transform(proj1, proj2);
  }

  // big switch to handle everything
  switch (olGeom.getType()) {
    case GeometryType.LINE_STRING:
    case GeometryType.MULTI_LINE_STRING:
      return olStyles.forEach(style =>
        renderLinestringGeometry(olGeom, style, lineGeom)
      );
      break;
    case GeometryType.LINEAR_RING:
      break;
    case GeometryType.MULTI_POLYGON:
      break;
    case GeometryType.GEOMETRY_COLLECTION:
      break;
    case GeometryType.CIRCLE:
      break;
    case GeometryType.POINT:
      break;
    case GeometryType.POLYGON:
      return olStyles.forEach(style =>
        renderPolygonGeometry(olGeom, style, polyGeom, lineGeom)
      );
      break;
  }
}

// returns an array of meshes
// arrays can hold: indices, positions, colors, uvs,
// lineIndices, linePositions, lineNeighbours, lineParams, lineColors
function renderPolygonGeometry(olGeom, olStyle, arrays) {
  if (!olStyle) {
    return;
  }
  /*
  const ends = olGeom.getEnds();
  const stride = olGeom.getStride();
  const coordReduce = (acc, curr, i, array) => {
    if ((i + 1) % stride === 0) {
      acc.push(
        new Vector3(
          array[i - stride + 1],
          array[i - stride + 2],
          stride > 2 ? array[i - stride + 3] : 0
        )
      );
    }
    return acc;
  };
  const colorMap = (c, i) => (i < 3 ? c / 255 : c);

  const flatCoordinates = olGeom.getFlatCoordinates();

  if (ends.length === 0) {
    return null;
  }

  let ring, outerRing, hole, holeRings, i;

  // get parameters from style
  const fillColor = olStyle.getFill()
    ? olcolor.asArray(olStyle.getFill().getColor()).map(colorMap)
    : [0, 0, 0, 0];
  const strokeColor = olStyle.getStroke()
    ? olcolor.asArray(olStyle.getStroke().getColor()).map(colorMap)
    : null;
  const lineJoin = olStyle.getStroke()
    ? olStyle.getStroke().getLineJoin()
    : null;
  const lineWidth = olStyle.getStroke() ? olStyle.getStroke().getWidth() : null;
  const lineCap = olStyle.getStroke() ? olStyle.getStroke().getLineCap() : null;
  const lineMiterLimit = olStyle.getStroke()
    ? lineJoin === 'bevel'
      ? 0
      : olStyle.getStroke().getMiterLimit() || 10.0
    : null;

  // appends given arrays by triangulating outer & inner rings
  const appendArrays = () => {
    const indexOffset = arrays.positions ? arrays.positions.length / 3 : 0;

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

    // this code is horrible, please excuse
    const appendLineVertex = (currentPos, prevPos, nextPos, operation) => {
      if (!strokeColor) {
        return;
      }
      arrays.linePositions.push(currentPos.x, currentPos.y, 0);
      arrays.lineColors.push(
        strokeColor[0],
        strokeColor[1],
        strokeColor[2],
        strokeColor[3]
      );
      arrays.lineNeighbours.push(prevPos.x, prevPos.y, nextPos.x, nextPos.y);
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
          ? lineCap === 'round'
          : lineJoin === 'round';
      const flags =
        direction *
        ((isLineStart ? 1 : 0) + (isCap ? 2 : 0) + (isRound ? 4 : 0) + 8);
      arrays.lineParams.push(
        flags,
        lineWidth,
        lineMiterLimit,
        0.0 // free slot
      );
    };

    // add vertices & colors to arrays (outer ring and holes)
    let i, l;
    let j, hole;
    let lineOffset, currentPos, prevPos, nextPos, nextNextPos;
    let lineFirstOffset = arrays.linePositions.length / 3;
    for (i = 0, l = outerRing.length - 1; i < l; i++) {
      arrays.positions &&
        arrays.positions.push(outerRing[i].x, outerRing[i].y, 0);
      arrays.colors &&
        arrays.colors.push(
          fillColor[0],
          fillColor[1],
          fillColor[2],
          fillColor[3]
        );
      arrays.uvs && arrays.uvs.push(outerRing[i].x, outerRing[i].y); // world uvs

      // line (only joins, no cap)
      lineOffset = arrays.linePositions.length / 3;
      currentPos = outerRing[i];
      prevPos = i > 0 ? outerRing[i - 1] : outerRing[outerRing.length - 2];
      nextPos = i < l - 1 ? outerRing[i + 1] : outerRing[0];
      nextNextPos =
        i < l - 1
          ? i < l - 2
            ? outerRing[i + 2]
            : outerRing[0]
          : outerRing[1];
      appendLineVertex(currentPos, prevPos, nextPos, LINE_OPS.LINESTART_DOWN);
      appendLineVertex(currentPos, prevPos, nextPos, LINE_OPS.LINESTART_UP);
      appendLineVertex(nextPos, currentPos, nextNextPos, LINE_OPS.LINEEND_DOWN);
      appendLineVertex(nextPos, currentPos, nextNextPos, LINE_OPS.LINEEND_UP);
      // join area: TODO
      // segment
      arrays.lineIndices.push(
        lineOffset + 0,
        lineOffset + 2,
        lineOffset + 3,
        lineOffset + 0,
        lineOffset + 3,
        lineOffset + 1
      );
    }
    for (j = 0; j < holeRings.length; j++) {
      hole = holeRings[j];
      for (i = 0, l = hole.length - 1; i < l; i++) {
        arrays.positions && arrays.positions.push(hole[i].x, hole[i].y, 0);
        arrays.colors &&
          arrays.colors.push(
            fillColor[0],
            fillColor[1],
            fillColor[2],
            fillColor[3]
          );
        arrays.uvs && arrays.uvs.push(hole[i].x, hole[i].y); // world uvs

        // line (only joins, no cap)
        lineOffset = arrays.linePositions.length / 3;
        currentPos = hole[i];
        prevPos = i > 0 ? hole[i - 1] : hole[hole.length - 2];
        nextPos = i < l - 1 ? hole[i + 1] : hole[0];
        nextNextPos = i < l - 1 ? (i < l - 2 ? hole[i + 2] : hole[0]) : hole[1];
        appendLineVertex(currentPos, prevPos, nextPos, LINE_OPS.LINESTART_DOWN);
        appendLineVertex(currentPos, prevPos, nextPos, LINE_OPS.LINESTART_UP);
        appendLineVertex(
          nextPos,
          currentPos,
          nextNextPos,
          LINE_OPS.LINEEND_DOWN
        );
        appendLineVertex(nextPos, currentPos, nextNextPos, LINE_OPS.LINEEND_UP);
        // join area: TODO
        // segment
        arrays.lineIndices.push(
          lineOffset + 0,
          lineOffset + 2,
          lineOffset + 3,
          lineOffset + 0,
          lineOffset + 3,
          lineOffset + 1
        );
      }
    }

    // triangulate shape to add indices
    const faces = ShapeUtils.triangulateShape(outerRing, holeRings);
    for (i = 0, l = faces.length; i < l; i++) {
      arrays.indices &&
        arrays.indices.push(
          faces[i][0] + indexOffset,
          faces[i][1] + indexOffset,
          faces[i][2] + indexOffset
        );
    }
  };

  // loop on ends: create a new polygon with holes everytime
  // the ring is CW
  for (let i = 0; i < ends.length; i++) {
    if (ends[i] === ends[i - 1]) {
      continue;
    }

    ring = flatCoordinates
      .slice(i === 0 ? 0 : ends[i - 1], ends[i])
      .reduce(coordReduce, []);

    // this is an outer ring: generate the previous polygon and initiate new one
    // TODO: USE A PARAMETER FOR THIS
    if (!ShapeUtils.isClockWise(ring)) {
      if (outerRing) appendArrays();
      outerRing = ring;
      holeRings = [];
    }

    // this is an inner ring (hole)
    else if (outerRing) {
      holeRings.push(ring);
    }
  }

  // generate the last pending polygon
  if (outerRing) appendArrays();
  */
}

// returns an array of meshes
// arrays can hold: positions, colors
function renderLinestringGeometry(olGeom, olStyle, lineGeom) {
  if (!olStyle || !olStyle.getStroke()) {
    return;
  }

  const ends = olGeom.getEnds();
  if (ends.length === 0) {
    return null;
  }

  const stride = olGeom.getStride();
  const flatCoordinates = olGeom.getFlatCoordinates();

  const color = olcolor.asArray(olStyle.getStroke().getColor());
  const join = olStyle.getStroke().getLineJoin();
  const width = olStyle.getStroke().getWidth();
  const cap = olStyle.getStroke().getLineCap();
  const miterLimit =
    join === 'bevel' ? 0 : olStyle.getStroke().getMiterLimit() || 10.0;

  const params = {
    join,
    cap,
    miterLimit
  };
  // loop on ends: create a new line everytime
  for (let i = 0; i < ends.length; i++) {
    if (ends[i] === ends[i - 1]) {
      continue;
    }

    lineGeom.pushLine(
      params,
      width,
      color,
      flatCoordinates,
      i === 0 ? 0 : ends[i - 1],
      ends[i],
      stride
    );
  }
}
