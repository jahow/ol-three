// OpenLayers imports
import OSM from 'ol/source/osm';
import VectorTile from 'ol/source/vectortile';
import Feature from 'ol/feature';
import KML from 'ol/format/kml';
import MVT from 'ol/format/mvt';
import Style from 'ol/style/style';
import Fill from 'ol/style/fill';
import Stroke from 'ol/style/stroke';
import Icon from 'ol/style/icon';
import Text from 'ol/style/text';

// Three.js imports
import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { Color } from 'three/src/math/Color';
import { InterleavedBuffer } from 'three/src/core/InterleavedBuffer';
import { InterleavedBufferAttribute } from 'three/src/core/InterleavedBufferAttribute';
import { Matrix4 } from 'three/src/math/Matrix4';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { RawShaderMaterial } from 'three/src/materials/RawShaderMaterial';
import { Scene } from 'three/src/scenes/Scene';

import { Shape } from 'three/src/extras/core/Shape';
import { ShapeBufferGeometry } from 'three/src/geometries/ShapeGeometry';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Vector3 } from 'three/src/math/Vector3';

// Local imports
import { TrackballControls } from './TrackballControls.js';
import { OrbitControls } from './OrbitControls';
import RasterTileLayer from './rastertilelayer';
import VectorTileLayer from './vectortilelayer';
import { renderFeature } from './vector';
import { GEOM_KML } from './test_geom';
import { addJobToQueue, updateJobQueue } from './jobqueue';
import { setActiveCamera, setCameraTarget } from './view';
import { createMapboxStreetsV6Style } from './mapbox-streets-v6-style';
import { getRenderer } from './common';
import Stats from './lib/stats';
import { RendererStats } from './lib/rendererstats';

//
// main
//

var mapEl = document.getElementById('map');
var mapWidth = mapEl.clientWidth;
var mapHeight = mapEl.clientHeight;
var mapSize = [mapWidth, mapHeight];

// var osmSource = new OSM();
// var osmLayer = new RasterTileLayer(osmSource);

// vt layer
var key = 'pk.eyJ1IjoiYWhvY2V2YXIiLCJhIjoiRk1kMWZaSSJ9.E5BkluenyWQMsBLsuByrmg';

var vtSource = new VectorTile({
  format: new MVT(),
  url:
    'https://{a-d}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/' +
    '{z}/{x}/{y}.vector.pbf?access_token=' +
    key
});
var vtLayer = new VectorTileLayer(vtSource);
vtLayer.setStyleFunction(
  createMapboxStreetsV6Style(Style, Fill, Stroke, Icon, Text)
);

// test vector stuff
var format = new KML();
var feature = format.readFeature(GEOM_KML, {
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857'
});

const scene = new Scene();
// scene.add(osmLayer.rootMesh)
scene.add(vtLayer.rootMesh);

// let featureMesh = renderFeature(feature)
// featureMesh.renderOrder = 10
// scene.add.apply(scene, featureMesh);

// renderer

var renderer = getRenderer();
renderer.setSize(mapWidth, mapHeight);
renderer.setClearColor(new Color(0xf8f4f0));
mapEl.appendChild(renderer.domElement);

// var projectionExtent = osmSource.getProjection().getExtent();
var aspectRatio = mapWidth / mapHeight;

var initialCenter = [595641.3047094788, 5626334.968589892];

var camera = new PerspectiveCamera(50, aspectRatio, 1, 100000000);
camera.up.set(0, 0, 1);
camera.position.z = 500000;
camera.position.x = initialCenter[0];
camera.position.y = initialCenter[1];
setActiveCamera(camera);

var controls = new OrbitControls(camera, mapEl);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.minDistance = 100;
controls.target.x = initialCenter[0];
controls.target.y = initialCenter[1] + 100;
controls.target.z = 0;
controls.zoomSpeed = 3;
setCameraTarget(controls.target);

// stats
var stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

var rendererStats = new RendererStats();
rendererStats.domElement.style.position = 'absolute';
rendererStats.domElement.style.left = '0px';
rendererStats.domElement.style.bottom = '0px';
document.body.appendChild(rendererStats.domElement);

(function animate() {
  requestAnimationFrame(animate);
  stats.begin();

  controls.update();

  renderer.clear();
  // osmLayer.update();
  vtLayer.update();

  updateJobQueue();

  renderer.render(scene, camera, undefined);
  // renderer.render(vtLayer.maskScene, camera, undefined);

  stats.end();
  rendererStats.update(renderer);
})();
