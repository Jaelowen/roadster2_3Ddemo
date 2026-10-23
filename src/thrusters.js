import * as THREE from 'three';

const plumeVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const plumeFragment = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPower;
  uniform vec3 uColor;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.3);
    float wave = 0.7 + 0.3 * sin(vUv.y * 55.0 - uTime * 22.0);
    float band = 0.7 + 0.3 * sin(vUv.x * 31.4159 + vUv.y * 10.0);
    vec3 color = mix(uColor, vec3(0.88, 0.97, 1.0), pow(1.0 - vUv.y, 4.0));
    float alpha = fade * wave * band * (0.25 + uPower * 0.45);
    gl_FragColor = vec4(color, alpha);
  }
`;
const particleVertex = `
  uniform float uTime;
  uniform float uPower;
  uniform float uLength;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    float t = fract(position.y + uTime * (0.6 + aSeed * 0.4));
    vec3 p = vec3(position.x * (0.3 + t * 1.1), t * uLength, position.z * (0.3 + t * 1.1));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(20.0, (1.5 + aSeed * 2.0) * uPixelRatio * (4.0 / max(-mv.z, 0.5)));
    vAlpha = (1.0 - t) * uPower;
  }
`;
const particleFragment = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(uColor, pow(1.0 - d, 2.0) * vAlpha);
  }
`;

/** 所有喷口都是独立添加的概念效果，不修改原车辆模型。 */
export function createThrusters(parent, pixelRatio = 1) {
  const jets = [];
  const groups = { rear: [], side: [], lift: [] };
  const nozzleMaterial = new THREE.MeshStandardMaterial({ color: '#363c3f', metalness: 0.9, roughness: 0.27 });
  const nozzleGeometry = new THREE.TorusGeometry(0.085, 0.018, 8, 24);
  // 接收法兰嵌入车身，短管把法兰与喷口连起来，避免只有圆环悬空。
  const socketGeometry = new THREE.CylinderGeometry(0.085, 0.12, 0.17, 24, 1, true);
  const flangeGeometry = new THREE.TorusGeometry(0.111, 0.015, 8, 24);
  const throatGeometry = new THREE.CircleGeometry(0.073, 24);
  const throatMaterial = new THREE.MeshStandardMaterial({ color: '#080c0e', metalness: 0.3, roughness: 0.65, side: THREE.DoubleSide });
  const cone = new THREE.CylinderGeometry(0.006, 0.11, 1, 24, 1, true);
  cone.translate(0, 0.5, 0);

  function addJet(channel, position, direction, color, maxLength, radius = 1) {
    const group = new THREE.Group();
    group.position.fromArray(position);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().fromArray(direction));
    parent.add(group);

    const mount = new THREE.Group();
    mount.scale.setScalar(radius);
    group.add(mount);
    const socket = new THREE.Mesh(socketGeometry, nozzleMaterial);
    socket.position.y = -0.035;
    mount.add(socket);
    const flange = new THREE.Mesh(flangeGeometry, nozzleMaterial);
    flange.rotation.x = -Math.PI / 2;
    flange.position.y = -0.055;
    mount.add(flange);
    const throat = new THREE.Mesh(throatGeometry, throatMaterial);
    throat.rotation.x = -Math.PI / 2;
    throat.position.y = -0.025;
    mount.add(throat);
    const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.y = 0.05;
    mount.add(nozzle);

    const plume = new THREE.Group();
    plume.position.y = 0.05 * radius;
    group.add(plume);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: plumeVertex, fragmentShader: plumeFragment,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(cone, material);
    shell.scale.set(radius, maxLength, radius);
    plume.add(shell);
    const coreMaterial = material.clone();
    coreMaterial.uniforms.uColor.value.set('#e2f7ff');
    const core = new THREE.Mesh(cone, coreMaterial);
    core.scale.set(radius * 0.45, maxLength * 0.7, radius * 0.45);
    plume.add(core);

    const positions = new Float32Array(90 * 3);
    const seeds = new Float32Array(90);
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / 90) * 0.2 * radius;
      positions.set([Math.cos(a) * r, (i * 0.618034) % 1, Math.sin(a) * r], i * 3);
      seeds[i] = (i * 0.381966) % 1;
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const particlesMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uLength: { value: maxLength }, uPixelRatio: { value: pixelRatio }, uColor: { value: new THREE.Color(color) } },
      vertexShader: particleVertex, fragmentShader: particleFragment,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    particles.frustumCulled = false;
    plume.add(particles);
    const jet = { group, plume, shell, core, material, coreMaterial, particlesGeometry, particlesMaterial, maxLength, channel, power: 0, anchor: new THREE.Vector3().fromArray(position), direction: new THREE.Vector3().fromArray(direction), mounted: false };
    groups[channel].push(jet);
    jets.push(jet);
  }

  addJet('rear', [-0.59, 0.43, -2.39], [0, 0, -1], '#8ddcff', 2.7, 1.15);
  addJet('rear', [0.59, 0.43, -2.39], [0, 0, -1], '#8ddcff', 2.7, 1.15);
  addJet('side', [-0.94, 0.31, -0.65], [-1, 0, 0], '#7be0c9', 1.65, 0.75);
  addJet('side', [0.94, 0.31, -0.65], [1, 0, 0], '#7be0c9', 1.65, 0.75);
  for (const x of [-0.62, 0.62]) for (const z of [-1.25, 1.25]) {
    addJet('lift', [x, 0.12, z], [0, -1, 0], '#bfe7ff', 1.0, 0.65);
  }

  return {
    mount(model) {
      parent.updateWorldMatrix(true, true);
      const parentRotation = parent.getWorldQuaternion(new THREE.Quaternion());
      const raycaster = new THREE.Raycaster();
      for (const jet of jets) {
        // 从车外朝车体投射，找到这个位置真正的保险杠/侧裙/底盘表面。
        // 原来按外包围盒猜坐标，弧形保险杠处就会出现可见缝隙。
        const origin = jet.anchor.clone().addScaledVector(jet.direction, 1.5);
        parent.localToWorld(origin);
        const inward = jet.direction.clone().applyQuaternion(parentRotation).negate();
        raycaster.set(origin, inward);
        raycaster.far = 4;
        const hit = raycaster.intersectObject(model, true).find(item => item.face);
        if (!hit) continue;
        const surface = parent.worldToLocal(hit.point.clone());
        // 法兰与短管嵌入曲面；喷流仍保持该通道的轴向，后部两股气流平行。
        const outward = jet.direction;
        jet.group.position.copy(surface).addScaledVector(outward, 0.003);
        jet.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
        jet.mounted = true;
        jet.surface = surface;
      }
    },
    update(time, delta, target) {
      for (const jet of jets) {
        jet.power = THREE.MathUtils.damp(jet.power, target[jet.channel], 7, delta);
        if (target[jet.channel] === 0 && jet.power < 0.002) jet.power = 0;
        jet.plume.visible = jet.power > 0;
        const pulse = 1 + Math.sin(time * 27 + jet.group.position.x * 4) * 0.035;
        jet.plume.scale.y = (0.2 + jet.power * 0.8) * pulse;
        for (const mat of [jet.material, jet.coreMaterial, jet.particlesMaterial]) {
          mat.uniforms.uTime.value = time;
          mat.uniforms.uPower.value = jet.power;
        }
      }
    },
    inspect() { return jets.map(jet => ({ channel: jet.channel, visible: jet.plume.visible, power: jet.power, length: jet.maxLength * jet.plume.scale.y, mounted: jet.mounted, position: jet.group.position.toArray(), surfaceDistance: jet.surface ? jet.group.position.distanceTo(jet.surface) : null })); },
    dispose() {
      for (const jet of jets) {
        jet.material.dispose(); jet.coreMaterial.dispose(); jet.particlesMaterial.dispose(); jet.particlesGeometry.dispose();
        jet.group.removeFromParent();
      }
      nozzleGeometry.dispose(); socketGeometry.dispose(); flangeGeometry.dispose(); throatGeometry.dispose();
      nozzleMaterial.dispose(); throatMaterial.dispose(); cone.dispose();
    },
  };
}
