import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { setupControllers } from './controllers.js';
import { SuitRig } from './suit.js';
import { createForwardIndicator } from './hud.js';
import { XRControls } from './controls.js'; 

// --- renderer (WebXR enabled) ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor'); // align Y=0 to physical floor
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// --- scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

// --- camera (XR will drive pose; keep at origin for VR) ---
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 100);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
// desktop fallback only (if not in XR):
if (!navigator.xr) camera.position.set(0, 1.6, 3);

// --- lights (simple, cheap) ---
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1));
const dir = new THREE.DirectionalLight(0xffffff, 0.7);
dir.position.set(3, 5, 2);
scene.add(dir);

// --- floor plane at Y=0 (visual check of height) ---
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x202024, metalness: 0, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2; // lay flat
floor.position.y = 0;            // exactly at Y=0 (physical floor)
floor.receiveShadow = true;
scene.add(floor);

// optional: a reference cube in front, ~chest height
const marker = new THREE.Mesh(
  new THREE.BoxGeometry(0.25, 0.25, 0.25),
  new THREE.MeshStandardMaterial({ color: 0x4caf50 })
);
marker.position.set(0, 1.2, -1.2);
scene.add(marker);

// --- controllers ---
const xrHands = setupControllers(renderer, rig, { rayLength: 0.5 });

// --- suit rig (zero-G) ---
const suit = new SuitRig(rig);

// After: const suit = new SuitRig(rig);
suit.rotAccel.yaw = 6.0; // TEMP: make yaw obviously visible

// Add this tiny once-per-250ms logger near the top-level:
let _nextLog = 0;

// HUD forward indicator
const hud = createForwardIndicator(scene);

// Control Scheme
const input = new XRControls(renderer); 


// --- resize ---
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// keep camera clean for XR so HMD fully controls it
renderer.xr.addEventListener('sessionstart', () => {
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
});

// --- render loop ---
let lastT = performance.now() * 0.001;
renderer.setAnimationLoop(() => {
  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, now - lastT); // clamp dt for stability
  lastT = now;

  // Update HUD so it stays near your view but points suit-forward
  hud.update(camera, rig);

// --- read normalized controls
  const c = input.sample();
const dbg = input.debugState();
  // forward/back thrust (local Z): positive = forward along suit -Z
  if (c.strafe !== 0 || c.thrust.z !== 0) {
  const local = new THREE.Vector3(
    c.strafe,              // left/right
    0,
    -c.thrust.z            // forward is along -Z
  );
  suit.addThrustLocal(local, dt);
}

if (c.rot.yaw !== 0) {
  suit.addAngular({ yaw: c.rot.yaw, pitch: 0, roll: 0 }, dt);
}

  // hold-to-brake
  suit.setBrake(c.braking);

  // 🔎 periodic debug (every ~250ms)
if (performance.now() > _nextLog) {
  // derive an easy-to-read yaw angle from the rig quaternion
  const e = new THREE.Euler().setFromQuaternion(rig.quaternion, 'YXZ');
  console.log({
    leftAxes: dbg.leftAxes.map(v => +v.toFixed(2)),
    rightAxes: dbg.rightAxes.map(v => +v.toFixed(2)),
    yawInput: +dbg.yaw.toFixed(2),
    braking: dbg.braking,
    angVelY: +suit.angularVel.y.toFixed(3),
    rigYawDeg: +(THREE.MathUtils.radToDeg(e.y).toFixed(1))
  });
  _nextLog = performance.now() + 250;
}

  suit.update(dt);
  renderer.render(scene, camera);
});
