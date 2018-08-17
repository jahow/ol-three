// OpenLayers imports
import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import olsize from 'ol/size';
import TileState from 'ol/tilestate';
import Units from 'ol/proj/units';

// Three.js imports
import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { InterleavedBuffer } from 'three/src/core/InterleavedBuffer';
import { InterleavedBufferAttribute } from 'three/src/core/InterleavedBufferAttribute';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { RawShaderMaterial } from 'three/src/materials/RawShaderMaterial';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Scene } from 'three/src/scenes/Scene';
import { Texture } from 'three/src/textures/Texture';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import { addJobToQueue } from './jobqueue';
import {
  getMaxResolution,
  getActiveCamera,
  getDistanceFromResolution
} from './view';
import { getMapSize } from './common';

// A tile layer simply generates meshes based on the current view
// Implementations will have to redefine the generateTileMesh method
// All tile meshes must have this.rootMesh as parent

var BaseTileLayer = function(olTileSource) {
  this.rootMesh = new Mesh();

  this.tileMeshes = {}; // will hold all tile meshes; key is tile.getKey()

  this.tmpSize = [0, 0];
  this.tmpExtent = olextent.createEmpty();

  this.renderedTileRange = null;
  this.renderedFramebufferExtent = null;
  this.renderedRevision = -1;

  this.source = olTileSource;
};

Object.assign(BaseTileLayer.prototype, {
  generateTileMesh: function(tile) {
    return new Mesh();
  },

  disposeTileMesh: function(mesh) {},

  updateTileMesh: function(mesh) {},

  preUpdate: function() {},

  postUpdate: function() {},

  update: function() {
    this.preUpdate();

    // get a list of tiles to load based on the camera position
    var projection = this.source.getProjection();
    var tileGrid = this.source.getTileGrid();
    var visibleTiles = []; // tiles are stored as [x, y, z] arrays

    var z = tileGrid.getZForResolution(getMaxResolution());
    var zDistance;
    var center = [getActiveCamera().position.x, getActiveCamera().position.y];
    var alpha, radius, tileRange;
    var x, y;

    // loop on z values to load tiles on all levels
    while (z >= 0) {
      zDistance = getDistanceFromResolution(tileGrid.getResolution(z));

      // todo: improve this to always render the broader zoom level
      if (z === 1) {
        tileRange = tileGrid.getFullTileRange(z);
      } else {
        alpha = Math.acos(getActiveCamera().position.z / zDistance);
        radius = Math.sin(alpha) * zDistance;
        tileRange = tileGrid.getTileRangeForExtentAndZ(
          [
            center[0] - radius,
            center[1] - radius,
            center[0] + radius,
            center[1] + radius
          ],
          z
        );
      }

      for (x = tileRange.minX; x <= tileRange.maxX; x++) {
        for (y = tileRange.minY; y <= tileRange.maxY; y++) {
          visibleTiles.push([x, y, z]);
        }
      }

      z--;
    }

    // loop on tile range to load missing tiles and generate new meshes

    // mark all existing tile meshes as unused (removed later)
    Object.keys(this.tileMeshes).forEach(key => {
      if (this.tileMeshes[key]) this.tileMeshes[key].toDelete = true;
    });

    for (var i = 0; i < visibleTiles.length; i++) {
      var tile = this.source.getTile(
        visibleTiles[i][2],
        visibleTiles[i][0],
        visibleTiles[i][1],
        1,
        projection
      );
      var tileKey = tile.getKey();

      if (tile.getState() != TileState.LOADED) {
        tile.load();
      } else if (
        tile.getState() == TileState.LOADED &&
        !this.tileMeshes[tileKey]
      ) {
        // handle tiles in tile-pixel coords
        tile.tileKeys &&
          tile.tileKeys.forEach(tileKey => {
            const sourceTile = tile.getTile(tileKey);
            const tileProjection = sourceTile.getProjection();
            var sourceTileCoord = sourceTile.tileCoord;
            var sourceTileExtent = tileGrid.getTileCoordExtent(sourceTileCoord);

            // handle coords in tile-pixels (ie Mapbox Vector Tiles)
            if (tileProjection.getUnits() == Units.TILE_PIXELS) {
              tileProjection.setWorldExtent(sourceTileExtent);
              tileProjection.setExtent(sourceTile.getExtent());
            }
          });

        // mesh generation is added to queue
        let tileCopy = tile;
        // uncomment to use job queue
        addJobToQueue(
          function() {
            this._reprojectTileAndGenerate(tileCopy);
          },
          this,
          3000
        );

        // placeholder
        this.tileMeshes[tileKey] = {
          toDelete: false
        };
      }

      if (this.tileMeshes[tileKey]) {
        this.tileMeshes[tileKey].toDelete = false;
      }
    }

    // loop on meshes
    Object.keys(this.tileMeshes).forEach(key => {
      if (!this.tileMeshes[key]) return;

      // remove unused meshes
      if (this.tileMeshes[key].toDelete) {
        this.disposeTileMesh(this.tileMeshes[key]);
        this.rootMesh.remove(this.tileMeshes[key]);
        this.tileMeshes[key] = null;
        return;
      }
    });

    // TODO: reimplement skipping when visible tiles did not change

    Object.keys(this.tileMeshes).forEach(key => {
      if (!this.tileMeshes[key]) return;

      this.updateTileMesh(this.tileMeshes[key]);
    });

    this.postUpdate();
  },

  _reprojectTileAndGenerate(olTile) {
    var start = Date.now();
    // var projection = this.source.getProjection();
    var tileGrid = this.source.getTileGrid();
    var tileKey = olTile.getKey();
    var tileExtent = tileGrid.getTileCoordExtent(
      olTile.tileCoord,
      this.tmpExtent
    );

    const mesh = this.generateTileMesh(
      olTile,
      this.tileMeshes[tileKey] === null,
      // projection,
      tileExtent
    );
    if (mesh) {
      this.rootMesh.add(mesh);
      this.tileMeshes[tileKey] = mesh;
    }

    // change tile projection (as tile geoms should have been projected by now)
    // olTile.tileKeys &&
    //   olTile.tileKeys.forEach(tileKey => {
    //     const sourceTile = olTile.getTile(tileKey);
    //     if (!olproj.equivalent(projection, sourceTile.getProjection())) {
    //       sourceTile.setProjection(projection);
    //     }
    //   });

    console.log(`tile [${tileKey}] generated in ${Date.now() - start}ms`);
  },

  getStyleFunction() {
    return this._styleFunction;
  },
  setStyleFunction(olStyleFunc) {
    this._styleFunction = olStyleFunc;
  }
});

export default BaseTileLayer;
