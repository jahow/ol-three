import { WebGLRenderer } from "three/src/renderers/WebGLRenderer";

export function getMapSize() {
	var mapEl = document.getElementById("map");
	return [mapEl.clientWidth, mapEl.clientHeight];
}

let renderer;
export function getRenderer() {
	if (!renderer) {
		renderer = new WebGLRenderer();
	}
	return renderer;
}
