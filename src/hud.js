import * as THREE from 'three';

/**
 * Creates a small forward indicator that sits near the HMD but points in the suit's forward (rig) direction.
 * It follows the camera position each frame, but its rotation matches the RIG (not the head).
 */
export function createForwardIndicator(scene) {
  const group = new THREE.Group();

  // Ring (like a reticle)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.003, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff })
  );
  group.add(ring);

  // Arrow tip (points along -Z of the rig)
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.06, 16),
    new THREE.MeshBasicMaterial({ color: 0x00e0ff })
  );
  tip.rotation.x = -Math.PI / 2;   // aim along -Z
  tip.position.z = -0.08;
  group.add(tip);

  // Make it sit “on top” of the view and be readable
  group.traverse(o => {
    if (o.material) {
      o.material.depthTest = false;   // draw on top
      o.renderOrder = 999;
    }
  });

  scene.add(group);

  // Per-frame updater: place near the head but orient to RIG forward
  function update(camera, rig) {
    const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // ~forehead height/distance in front of the HMD
    const pos = camPos.clone()
      .addScaledVector(camForward, 0.35)   // a bit in front of view
      .addScaledVector(camUp, 0.0);        // tweak if you want slightly up/down

    group.position.copy(pos);

    // Rotate to match the suit (rig) orientation, not the head
    group.quaternion.copy(rig.quaternion);
  }

  return { group, update };
}
