import { getMapSize } from "./common";

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
