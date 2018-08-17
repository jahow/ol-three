// OpenLayers imports
import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import Projection from 'ol/proj/projection';
import olsize from 'ol/size';
import TileState from 'ol/tilestate';

// Three.js imports
import { Scene } from 'three/src/scenes/Scene';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';
import { Mesh } from 'three/src/objects/Mesh';
import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { Float32BufferAttribute } from 'three/src/core/BufferAttribute';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';

import BaseTileLayer from './basetilelayer';

import { renderFeature } from './vector';
import { getMaxResolution, getCenterResolution, getActiveCamera } from './view';
import { getMapSize, getRenderer } from './common';
import { PolygonGeometry, LinestringGeometry } from './utils/meshes.geometry';

import polygonVS from './polygon-vtVS.glsl';
import polygonFS from './polygon-vtFS.glsl';
import polygonMaskFS from './polygon-maskFS.glsl';
import lineVS from './line-vtVS.glsl';
import lineFS from './line-vtFS.glsl';

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
  depthTest: false
});

const lineMaterial = new ShaderMaterial({
  uniforms: {},
  vertexShader: lineVS,
  fragmentShader: lineFS,
  transparent: true,
  depthTest: false
});

// tiles are projected to a mvt style proj (0-4096 relative to origin of tile)
const tileRenderProjCode = 'EPSG:3857';
const tileRenderExtentSize = 4096;

var VectorTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);

  this.maskRenderTarget = new WebGLRenderTarget(
    getMapSize()[0],
    getMapSize()[1],
    {
      depthBuffer: false,
      stencilBuffer: false
    }
  );
  this.maskScene = new Scene();
  this.maskMeshes = {};

  // TODO: make this a property of the layer, or update uniform to handle several layers
  polygonMaterial.uniforms.uMaskTexture = {
    value: this.maskRenderTarget.texture
  };
  polygonMaterial.uniforms.uScreenSize = {
    value: getMapSize()
  };
  lineMaterial.uniforms.resolution = {
    value: 0
  };
  lineMaterial.uniforms.uMaskTexture = {
    value: this.maskRenderTarget.texture
  };
  lineMaterial.uniforms.uScreenSize = {
    value: getMapSize()
  };
};

VectorTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(VectorTileLayer.prototype, {
  generateTileMesh: function(tile, isCached, tileExtent) {
    if (!tile.tileKeys || !tile.tileKeys.length) {
      return;
    }

    const z = tile.getTileCoord()[0];

    const polyGeom = new PolygonGeometry({
      baseZ: z
    });
    const lineGeom = new LinestringGeometry({
      baseZ: z
    });

    const styleFunction = this.getStyleFunction();
    const tileRenderProj = new Projection({
      code: tileRenderProjCode,
      extent: [0, 0, tileRenderExtentSize, tileRenderExtentSize],
      worldExtent: tileExtent,
      units: 'tile-pixels',
      axisOrientation: 'enu'
    });

    tile.tileKeys.forEach(tileKey => {
      const sourceTile = tile.getTile(tileKey);
      const features = sourceTile.getFeatures();
      const tileProj = sourceTile.getProjection();

      features.forEach(feature => {
        const styles = styleFunction(feature, getMaxResolution());
        styles &&
          renderFeature(
            feature,
            styles,
            polyGeom,
            lineGeom,
            tileProj,
            tileRenderProj
          );
      });

      // save new projection on tile
      sourceTile.setProjection(tileRenderProj);
    });

    // generate polygon mesh
    polyGeom.commit();
    const rootMesh = new Mesh(polyGeom, polygonMaterial);

    // set position & scale of rootMesh
    const worldExtent = tileRenderProj.getWorldExtent();
    const sizeX = worldExtent[2] - worldExtent[0];
    const sizeY = worldExtent[3] - worldExtent[1];
    rootMesh.scale.x = sizeX / tileRenderExtentSize;
    rootMesh.scale.y = -sizeY / tileRenderExtentSize;
    rootMesh.position.x = worldExtent[0];
    rootMesh.position.y = worldExtent[3];

    // generate line mesh
    if (lineGeom.hasGeometry()) {
      lineGeom.commit();
      const lineMesh = new Mesh(lineGeom, lineMaterial);
      rootMesh._lineMesh = lineMesh;
      rootMesh.add(lineMesh);
    }

    // add a mesh with the same geom on the mask scene
    const maskGeom = new BufferGeometry();
    maskGeom.setIndex([0, 1, 2, 0, 2, 3]);
    maskGeom.addAttribute(
      'position',
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
    if (mesh._lineMesh && mesh._lineMesh.geometry) {
      mesh._lineMesh.geometry.dispose();
    }
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh._maskMesh) {
      mesh._maskMesh.geometry.dispose();
      this.maskScene.remove(mesh._maskMesh);
    }
  },

  updateTileMesh: function(mesh) {
    if (mesh._lineMesh) {
      mesh._lineMesh.renderOrder = mesh.renderOrder + 1;
    }
  },

  preUpdate: function() {
    lineMaterial.uniforms.resolution = {
      value: getCenterResolution()
    };
    lineMaterial.uniforms.fov = {
      value: (getActiveCamera().fov * Math.PI * 2) / 360
    };
  },

  postUpdate: function() {
    getRenderer().render(
      this.maskScene,
      getActiveCamera(),
      this.maskRenderTarget,
      true
    );
  }
});

export default VectorTileLayer;
