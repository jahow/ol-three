export function isClockWise(coords, start, end, stride) {
  var sum = 0;
  for (var p = end - stride, q = start; q < end; p = q, q += stride) {
    sum += coords[p] * coords[q + 1] - coords[q] * coords[p + 1];
  }
  return sum < 0;
}

export function partialReverse(coords, start, end, stride) {
  var tmp,
    i,
    j,
    max = start + (end - start) / 2 - stride;
  for (i = start; i <= max; i += stride) {
    for (var j = 0; j < stride; j++) {
      tmp = coords[i + j];
      coords[i + j] = coords[end - (i - start) - stride + j];
      coords[end - (i - start) - stride + j] = tmp;
    }
  }
  return coords;
}
