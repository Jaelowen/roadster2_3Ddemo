import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createThrusters } from './thrusters.js';

const VIEWS = {
  front: [4.5, 2.2, 5.1],
  rear: [-4.6, 2.4, -6.3],
  top: [0.01, 8.4, 0.12],
};
const MIN_DISTANCE = 4.8;
const MAX_DISTANCE = 13;

export function createScene(container, callbacks = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#171d1f', 12, 30);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  camera.position.fromArray(VIEWS.front);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Roadster 2.0 三维模型，支持拖动和缩放');
  container.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.95, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.minPolarAngle = 0.03;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.update();

  // 程序生成的摄影棚环境，车辆和字体以外不依赖外部网络。
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.85;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#e2eef5', '#1e2624', 1.0));
  const key = new THREE.DirectionalLight('#fff4e6', 3.5);
  key.position.set(3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0002;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#b5d9e8', 3.5);
  rim.position.set(-4, 4, -5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#e7e7dc', 1.2);
  fill.position.set(-5, 2, 5);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ color: '#171d1f', metalness: 0.05, roughness: 0.9, envMapIntensity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const rings = new THREE.Group();
  for (const radius of [3.25, 3.4]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.008, 160), new THREE.MeshBasicMaterial({ color: '#788b80', transparent: true, opacity: 0.16, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    rings.add(ring);
  }
  scene.add(rings);

  // 柔和接触阴影，悬浮时会变淡和扩散。
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,.7)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,.4)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 6.7), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.8 }));
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.009;
  scene.add(contactShadow);

  const vehicle = new THREE.Group();
  vehicle.position.y = 0.06;
  vehicle.visible = false;
  scene.add(vehicle);
  const thrusters = createThrusters(vehicle, renderer.getPixelRatio());
  const glow = new THREE.PointLight('#6acbff', 0, 5, 2);
  glow.position.set(0, 0.45, -2.6);
  vehicle.add(glow);

  let disposed = false;
  let ready = false;
  let model = null;
  let paintColor = '#b51b28';
  const paintMaterials = new Set();
  const targetThrust = { rear: 0.35, side: 0, lift: 0 };
  const actual = { lift: 0, side: 0 };
  let transition = null;
  let lastTime = 0;
  let elapsed = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function disposeObject(object) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    object.traverse(child => {
      if (!child.isMesh) return;
      geometries.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    textures.forEach(item => item.dispose());
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('/models/roadster.glb', async gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    try {
      model = gltf.scene;
      let box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.scale.multiplyScalar(4.8 / size.z);
      box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.y -= box.min.y;
      model.position.z -= center.z;
      model.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = false;
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          material.envMapIntensity = 1.1;
          if (/car.?main.?paint/i.test(material.name)) {
            paintMaterials.add(material);
            material.color.set(paintColor);
            material.metalness = 0.72;
            material.roughness = 0.23;
            if ('clearcoat' in material) { material.clearcoat = 1; material.clearcoatRoughness = 0.12; }
          }
          if (/glass/i.test(material.name)) {
            material.depthWrite = false;
            material.roughness = Math.min(material.roughness, 0.18);
          }
        }
      });
      vehicle.add(model);
      thrusters.mount(model);
      vehicle.visible = true;
      callbacks.onProgress?.(98);
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      ready = true;
      callbacks.onReady?.();
    } catch (error) { if (!disposed) callbacks.onError?.(error); }
  }, event => {
    if (!disposed && event.total) callbacks.onProgress?.(Math.min(94, event.loaded / event.total * 94));
  }, error => { if (!disposed) callbacks.onError?.(error); });

  let portrait = false;
  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    const nextPortrait = camera.aspect < 1;
    if (nextPortrait !== portrait) {
      const direction = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).addScaledVector(direction, nextPortrait ? 1.2 : 1 / 1.2);
      portrait = nextPortrait;
    }
    camera.fov = portrait ? 46 : 36;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function updateZoomOutput() {
    const distance = camera.position.distanceTo(controls.target);
    callbacks.onZoom?.(THREE.MathUtils.clamp((MAX_DISTANCE - distance) / (MAX_DISTANCE - MIN_DISTANCE) * 100, 0, 100));
  }
  function onInteraction() { transition = null; callbacks.onInteraction?.(); }
  controls.addEventListener('start', onInteraction);
  controls.addEventListener('change', updateZoomOutput);
  updateZoomOutput();

  function animate(now) {
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = now;
    elapsed += delta;
    actual.lift = THREE.MathUtils.damp(actual.lift, targetThrust.lift, 4.5, delta);
    actual.side = THREE.MathUtils.damp(actual.side, targetThrust.side, 4.5, delta);
    vehicle.position.y = 0.06 + actual.lift * 0.68;
    vehicle.rotation.z = reducedMotion.matches ? 0 : Math.sin(elapsed * 2) * actual.side * 0.012;
    vehicle.rotation.x = reducedMotion.matches ? 0 : Math.sin(elapsed * 1.5) * actual.lift * 0.008;
    contactShadow.material.opacity = 0.8 - actual.lift * 0.45;
    contactShadow.scale.setScalar(1 + actual.lift * 0.2);
    thrusters.update(elapsed, delta, targetThrust);
    glow.intensity = targetThrust.rear * 3;
    if (transition) {
      transition.progress = Math.min(1, transition.progress + delta / 0.85);
      const t = reducedMotion.matches ? 1 : 1 - Math.pow(1 - transition.progress, 3);
      camera.position.lerpVectors(transition.from, transition.to, t);
      if (t >= 1) transition = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);
  function onVisibility() {
    renderer.setAnimationLoop(document.hidden ? null : animate);
    lastTime = 0;
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setThrust(values) {
      for (const key of Object.keys(targetThrust)) if (values[key] !== undefined) targetThrust[key] = THREE.MathUtils.clamp(values[key], 0, 1);
    },
    setColor(color) { paintColor = color; paintMaterials.forEach(material => material.color.set(color)); },
    setView(name) {
      const destination = VIEWS[name];
      if (!destination) return;
      const to = new THREE.Vector3().fromArray(destination);
      if (portrait) to.sub(controls.target).multiplyScalar(1.2).add(controls.target);
      transition = { from: camera.position.clone(), to, progress: 0 };
    },
    setZoom(value) {
      transition = null;
      const direction = camera.position.clone().sub(controls.target).normalize();
      const distance = THREE.MathUtils.lerp(MAX_DISTANCE, MIN_DISTANCE, value / 100);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update();
    },
    inspect() {
      return { ready, paintColor, paintMaterialCount: paintMaterials.size, lift: vehicle.position.y, camera: camera.position.toArray(), cameraDistance: camera.position.distanceTo(controls.target), jets: thrusters.inspect(), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      resizeObserver.disconnect();
      controls.dispose();
      thrusters.dispose();
      if (model) disposeObject(model);
      disposeObject(floor); disposeObject(rings); disposeObject(contactShadow);
      environment.dispose();
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
