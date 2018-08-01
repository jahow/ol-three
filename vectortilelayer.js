// OpenLayers imports
import olextent from "ol/extent";
import olmath from "ol/math";
import olproj from "ol/proj";
import Projection from "ol/proj/projection";
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
import { LineBasicMaterial } from "three/src/materials/LineBasicMaterial";

import BaseTileLayer from "./basetilelayer";

import { renderFeature } from "./vector";
import { getMaxResolution, getActiveCamera } from "./view";
import { getMapSize, getRenderer } from "./common";

import polygonVS from "./polygon-vtVS.glsl";
import polygonFS from "./polygon-vtFS.glsl";
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

const lineMaterial = new LineBasicMaterial({
  color: 0x2222ff,
  opacity: 0.1,
  linewidth: 1,
  transparent: true,
  depthTest: true
});

// tiles are projected to a mvt style proj (0-4096 relative to origin of tile)
const tileRenderProjCode = "EPSG:3857";
const tileRenderExtentSize = 4096;

var VectorTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);

  this.maskRenderTarget = new WebGLRenderTarget(
    getMapSize()[0],
    getMapSize()[1]
  );
  this.maskScene = new Scene();
  this.maskMeshes = {};

  // TODO: make this a property of the layer, or update uniform to handle several layers
  polygonMaterial.uniforms.uMaskTexture = {
    value: this.maskRenderTarget.texture
  };
};

VectorTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(VectorTileLayer.prototype, {
  generateTileMesh: function(tile, isCached, tileExtent) {
    if (!tile.tileKeys || !tile.tileKeys.length) {
      return;
    }

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
    const tileRenderProj = new Projection({
      code: tileRenderProjCode,
      extent: [0, 0, tileRenderExtentSize, tileRenderExtentSize],
      worldExtent: tileExtent,
      units: "tile-pixels",
      axisOrientation: "enu"
    });

    tile.tileKeys.forEach(tileKey => {
      const sourceTile = tile.getTile(tileKey);
      const features = sourceTile.getFeatures();
      const tileProj = sourceTile.getProjection();

      features.forEach(feature => {
        const styles = styleFunction(feature, getMaxResolution());
        styles &&
          renderFeature(feature, styles, arrays, tileProj, tileRenderProj);
      });

      // save new projection on tile
      sourceTile.setProjection(tileRenderProj);
    });

    // change z component of polygons
    const z = tile.getTileCoord()[0];
    for (let i = 0; i < arrays.positions.length; i++) {
      if ((i - 2) % 3 === 0) {
        arrays.positions[i] = z;
      }
    }

    // use arrays to generate a geometry
    const geom = new BufferGeometry();
    geom.setIndex(arrays.indices);
    geom.addAttribute(
      "position",
      new Float32BufferAttribute(arrays.positions, 3)
    );
    geom.addAttribute("color", new Float32BufferAttribute(arrays.colors, 4));
    geom.addAttribute("uv", new Float32BufferAttribute(arrays.uvs, 2));

    const rootMesh = new Mesh(geom, polygonMaterial);

    // set position & scale of rootMesh
    const worldExtent = tileRenderProj.getWorldExtent();
    const sizeX = worldExtent[2] - worldExtent[0];
    const sizeY = worldExtent[3] - worldExtent[1];
    rootMesh.scale.x = sizeX / tileRenderExtentSize;
    rootMesh.scale.y = -sizeY / tileRenderExtentSize;
    rootMesh.position.x = worldExtent[0];
    rootMesh.position.y = worldExtent[3];

    // generate line mesh
    const lineGeom = new BufferGeometry();
    lineGeom.addAttribute(
      "position",
      new Float32BufferAttribute(arrays.linePositions, 3)
    );
    lineGeom.addAttribute(
      "color",
      new Float32BufferAttribute(arrays.lineColors, 4)
    );
    rootMesh.add(new LineSegments(lineGeom, lineMaterial));

    // add a mesh with the same geom on the mask scene
    const maskGeom = new BufferGeometry();
    maskGeom.setIndex([0, 1, 2, 0, 2, 3]);
    maskGeom.addAttribute(
      "position",
      new Float32BufferAttribute(
        [
          worldExtent[0],
          worldExtent[1],
          z,
          worldExtent[2],
          worldExtent[1],
          z,
          worldExtent[2],
          worldExtent[3],
          z,
          worldExtent[0],
          worldExtent[3],
          z
        ],
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
    getRenderer().clear(this.maskScene, this.maskRenderTarget);
    getRenderer().render(
      this.maskScene,
      getActiveCamera(),
      this.maskRenderTarget
    );
  }
});

export default VectorTileLayer;
