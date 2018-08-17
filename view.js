import { getMapSize } from './common';
import { Vector4, Vector3 } from 'three/src/Three';

let activeCamera;
export function setActiveCamera(camera) {
  activeCamera = camera;
}
export function getActiveCamera() {
  return activeCamera;
}

let cameraTarget;
export function setCameraTarget(target) {
  cameraTarget = target;
}
export function getCameraTarget() {
  return cameraTarget;
}

// utils for computing map resolution & tiles based on active camera
// for now, the map plane is always Z = 0

// return the highest resolution in the map, ie the closest point to the camera
export function getMaxResolution() {
  // scale is computed based on camera position
  let dist = activeCamera.position.z;
  let scale = dist * Math.tan((activeCamera.fov / 360) * Math.PI) * 2;
  return scale / getMapSize()[1];
}

// return the resolution at the point of the map where the camera looks (sort of)
const tempVector = new Vector3(0, 0, 0);
const tempVector2 = new Vector3(0, 0, 0);
export function getCenterResolution() {
  getActiveCamera().getWorldDirection(tempVector.set(0, 0, -1));
  // compute the intersection with the map place (temp: z = 0)
  const alpha = tempVector.angleTo(tempVector2.set(0, 0, -1)) * 0.75;
  let dist = activeCamera.position.z / Math.cos(alpha);
  let scale = dist * Math.tan((activeCamera.fov / 360) * Math.PI) * 2;
  return scale / getMapSize()[1];
}

// TODO: this should simply be the camera distance to the map with a factor
export function getDistanceFromResolution(resolution) {
  let dist =
    (resolution * getMapSize()[1]) /
    (Math.tan((activeCamera.fov / 360) * Math.PI) * 2);
  return dist;
}
