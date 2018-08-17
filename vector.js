import GeometryType from 'ol/geom/geometrytype';
import olproj from 'ol/proj';
import olcolor from 'ol/color';

import { isClockWise } from './utils/helpers';

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

// pushes stuff into the geoms
function renderPolygonGeometry(olGeom, olStyle, polyGeom, lineGeom) {
  if (!olStyle) {
    return;
  }

  const ends = olGeom.getEnds();
  if (ends.length === 0) {
    return null;
  }

  const stride = olGeom.getStride();
  const flatCoordinates = olGeom.getFlatCoordinates();

  // get parameters from style
  const fillColor = olStyle.getFill()
    ? olcolor.asArray(olStyle.getFill().getColor())
    : [0, 0, 0, 0];
  const strokeColor = olStyle.getStroke()
    ? olcolor.asArray(olStyle.getStroke().getColor())
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
  const lineParams = {
    join: lineJoin,
    cap: lineCap,
    miterLimit: lineMiterLimit,
    closed: true
  };

  let outerStart,
    outerEnd,
    ringStart,
    ringEnd,
    holeEnds = [];

  for (let i = 0; i < ends.length; i++) {
    if (ends[i] === ends[i - 1]) {
      continue;
    }

    ringStart = i > 0 ? ends[i - 1] : 0;
    ringEnd = ends[i];

    // render rings
    strokeColor &&
      lineGeom.pushLine(
        lineParams,
        lineWidth,
        strokeColor,
        flatCoordinates,
        ringStart,
        ringEnd,
        stride
      );

    // this is an outer ring: generate the previous polygon and initiate new one
    // TODO: USE A PARAMETER FOR THIS
    if (!isClockWise(flatCoordinates, ringStart, ringEnd, stride)) {
      if (outerStart !== undefined) {
        polyGeom.pushPolygon(
          fillColor,
          stride,
          flatCoordinates,
          outerStart,
          outerEnd,
          holeEnds
        );
      }
      outerStart = ringStart;
      outerEnd = ringEnd;
      holeEnds.length = 0;
    } else if (outerStart !== undefined) {
      holeEnds.push(ringEnd);
    }
  }

  // generate the last pending polygon
  if (outerStart !== undefined) {
    polyGeom.pushPolygon(
      fillColor,
      stride,
      flatCoordinates,
      outerStart,
      outerEnd,
      holeEnds
    );
  }
}

// pushes lines into the LinestringGeometry
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
