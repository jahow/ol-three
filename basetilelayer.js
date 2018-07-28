// OpenLayers imports
import olextent from "ol/extent";
import olmath from "ol/math";
import olproj from "ol/proj";
import olsize from "ol/size";
import TileState from "ol/tilestate";
import Units from "ol/proj/units";

// Three.js imports
import { BufferGeometry } from "three/src/core/BufferGeometry";
import { PlaneGeometry } from "three/src/geometries/PlaneGeometry";
import { InterleavedBuffer } from "three/src/core/InterleavedBuffer";
import { InterleavedBufferAttribute } from "three/src/core/InterleavedBufferAttribute";
import { Matrix4 } from "three/src/math/Matrix4";
import { Mesh } from "three/src/objects/Mesh";
import { OrthographicCamera } from "three/src/cameras/OrthographicCamera";
import { RawShaderMaterial } from "three/src/materials/RawShaderMaterial";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial";
import { Scene } from "three/src/scenes/Scene";
import { Texture } from "three/src/textures/Texture";
import { WebGLRenderTarget } from "three/src/renderers/WebGLRenderTarget";

import { addJobToQueue } from "./jobqueue";
import { getMaxResolution, getCameraTarget } from "./view";
import { getMapSize } from "./common";

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

  update: function() {
    // var target = getCameraTarget();
    // var size = getMapSize();
    // var center = [target.x, target.y];
    // let ratio = size[1] / size[0];
    // let rotation = 0;
    // let resolution = getMaxResolution();

    // var projection = this.source.getProjection();
    // var extent = olextent.getForViewAndSize(center, resolution, rotation, size);
    // var tileGrid = this.source.getTileGrid();
    // var z = tileGrid.getZForResolution(resolution);
    // var tileResolution = tileGrid.getResolution(z);
    // var tilePixelSize = this.source.getTilePixelSize(
    //   z,
    //   window.devicePixelRatio,
    //   projection
    // );
    // var pixelRatio =
    //   tilePixelSize[0] /
    //   olsize.toSize(tileGrid.getTileSize(z), this.tmpSize)[0];
    // var tilePixelResolution = tileResolution / pixelRatio;
    // var tileGutter =
    //   this.source.getTilePixelRatio(pixelRatio) *
    //   this.source.getGutter(projection);
    // var tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);

    // get a list of tiles to load based on the camera position
    var projection = this.source.getProjection();
    var tileGrid = this.source.getTileGrid();
    var visibleTiles = []; // tiles are stored as [x, y, z] arrays

    var z = tileGrid.getZForResolution(getMaxResolution());
    var resolution;
    var minX, maxX, minY, maxY;

    // loop on z values to load tiles on all levels
    while (z > 0) {
      // TODO: compute extent & add tiles in circle around the camera nearest point
      z--;
    }

    // loop on tile range to load missing tiles and generate new meshes

    // mark all existing tile meshes as unused (removed later)
    Object.keys(this.tileMeshes).forEach(key => {
      if (this.tileMeshes[key]) this.tileMeshes[key].toDelete = true;
    });

    for (var i = 0; i < visibleTiles; i++) {
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
        var tileCopy = tile;
        // uncomment to use job queue
        // addJobToQueue(function () {
        this._reprojectTileAndGenerate(tileCopy);
        // }, this, 1000);
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
  },

  _reprojectTileAndGenerate(tile) {
    var projection = this.source.getProjection();
    var tileGrid = this.source.getTileGrid();
    var tileKey = tile.getKey();
    var tileExtent = tileGrid.getTileCoordExtent(
      tile.tileCoord,
      this.tmpExtent
    );

    this.tileMeshes[tileKey] = this.generateTileMesh(
      tile,
      this.tileMeshes[tileKey] === null,
      projection,
      tileExtent
    );
    this.rootMesh.add(this.tileMeshes[tileKey]);

    // change tile projection (as tile geoms should have been projected by now)
    tile.tileKeys &&
      tile.tileKeys.forEach(tileKey => {
        const sourceTile = tile.getTile(tileKey);
        if (!olproj.equivalent(projection, sourceTile.getProjection())) {
          sourceTile.setProjection(projection);
        }
      });
  },

  getStyleFunction() {
    return this._styleFunction;
  },
  setStyleFunction(olStyleFunc) {
    this._styleFunction = olStyleFunc;
  }
});

export default BaseTileLayer;
