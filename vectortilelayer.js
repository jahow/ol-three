// OpenLayers imports
import olextent from "ol/extent";
import olmath from "ol/math";
import olproj from "ol/proj";
import olsize from "ol/size";
import TileState from "ol/tilestate";

// Three.js imports
import { Scene } from "three/src/scenes/Scene";
import { WebGLRenderTarget } from "three/src/renderers/WebGLRenderTarget";
import { Mesh } from "three/src/objects/Mesh";
import { BufferGeometry } from "three/src/core/BufferGeometry";
import { Float32BufferAttribute } from "three/src/core/BufferAttribute";
import { LineSegments } from "three/src/objects/LineSegments";
import { ShaderMaterial } from "three/src/materials/ShaderMaterial";

import BaseTileLayer from "./basetilelayer";

import { renderFeature, lineMaterial } from "./vector";
import { getMaxResolution, getActiveCamera } from "./view";
import { getMapSize, getRenderer } from "./common";

import polygonVS from "./polygonVS.glsl";
import polygonFS from "./polygonFS.glsl";
import polygonMaskFS from "./polygon-maskFS.glsl";

const polygonMaterial = new ShaderMaterial({
  uniforms: {},
  vertexShader: polygonVS,
  fragmentShader: polygonFS,
  transparent: true,
  depthTest: false
});

const polygonMaskMaterial = new ShaderMaterial({
  uniforms: {},
  vertexShader: polygonVS,
  fragmentShader: polygonMaskFS,
  transparent: false,
  depthTest: false
});

var VectorTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);

  this.maskTexture = new WebGLRenderTarget(getMapSize()[0], getMapSize()[1]);
  this.maskScene = new Scene();
  this.maskMeshes = {};

  // TODO: make this a property of the layer, or update uniform to handle several layers
  polygonMaterial.uniforms.uMaskTexture = { value: this.maskTexture };
};

VectorTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(VectorTileLayer.prototype, {
  generateTileMesh: function(tile, isCached, sourceProj) {
    const mesh = new Mesh();

    // generate arrays for colors, positions
    const arrays = {
      positions: [],
      colors: [],
      indices: [],
      linePositions: [],
      lineColors: [],
      lineEnds: []
    };

    const styleFunction = this.getStyleFunction();

    tile.tileKeys.forEach(tileKey => {
      const features = tile.getTile(tileKey).getFeatures();
      features.forEach(feature => {
        const styles = styleFunction(feature, getMaxResolution());
        styles &&
          renderFeature(
            feature,
            styles,
            arrays,
            tile.getTile(tileKey).getProjection(),
            sourceProj
          );
      });
    });

    // change z component of polygons
    const z = tile.getTileCoord()[0];
    for (let i = 2; i < arrays.positions.length; i += 3) {
      arrays.positions[i] = z;
    }

    // use arrays to generate a geometry
    const geom = new BufferGeometry();
    geom.setIndex(arrays.indices);
    geom.addAttribute(
      "position",
      new Float32BufferAttribute(
        arrays.positions,
        3
      )
    );
    geom.addAttribute("color", new Float32BufferAttribute(arrays.colors, 4));
    geom.addAttribute("uv", new Float32BufferAttribute(arrays.uvs, 2));

    const rootMesh = new Mesh(geom, polygonMaterial);

    // generate line mesh
    // const lineGeom = new BufferGeometry();
    // lineGeom.addAttribute(
    //   "position",
    //   new Float32BufferAttribute(arrays.linePositions, 3)
    // );
    // lineGeom.addAttribute(
    //   "color",
    //   new Float32BufferAttribute(arrays.lineColors, 4)
    // );
    // rootMesh.add(new LineSegments(lineGeom, lineMaterial));

    // add a mesh with the same geom on the mask scene
    // TEMP: add a square of color based on zoom level
    const ind = arrays.positions.length / 3;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let x, y;
    for (let i = 0; i < arrays.positions.length / 3; i += 3) {
      (x = arrays.positions[i]), (y = arrays.positions[i + 1]);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const maskGeom = new BufferGeometry();
    maskGeom.setIndex([0, 1, 2, 0, 2, 3]);
    maskGeom.addAttribute(
      "position",
      new Float32BufferAttribute(
        [minX, minY, z, maxX, minY, z, maxX, maxY, z, minX, maxY, z],
        3
      )
    );
    const maskMesh = new Mesh(maskGeom, polygonMaskMaterial);
    maskMesh.renderOrder = z;
    this.maskScene.add(maskMesh);
    rootMesh._maskMesh = maskMesh;

    return rootMesh;
  },

  disposeTileMesh: function(mesh) {
    if (mesh._maskMesh) {
      this.maskScene.remove(mesh._maskMesh);
    }
  },

  updateTileMesh: function(mesh) {},

  preUpdate: function() {},

  postUpdate: function() {
    getRenderer().clear(this.maskScene, this.maskTexture);
    getRenderer().render(this.maskScene, getActiveCamera(), this.maskTexture);
  }
});

export default VectorTileLayer;
