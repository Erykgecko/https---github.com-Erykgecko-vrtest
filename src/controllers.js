// src/controllers.js
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

/**
 * Sets up left/right controllers with a visible forward ray and Quest model.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Object3D} parent
 * @param {{ rayLength?: number }} options
 * @returns {{ controllers: THREE.Group[], grips: THREE.Group[] }}
 */
export function setupControllers(renderer, parent, { rayLength = 0.5 } = {}) {
  const controllerModelFactory = new XRControllerModelFactory();
  const controllers = [];
  const grips = [];

  for (let i = 0; i < 2; i++) {
    // Controller target that follows your real hand
    const controller = renderer.xr.getController(i);
    parent.add(controller);
    controllers.push(controller);

    // Visible forward ray to show orientation
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    line.name = 'ray';
    line.scale.z = rayLength;
    controller.add(line);

    // Grip with an auto controller model (Quest 3 model in WebXR)
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModelFactory.createControllerModel(grip));
    parent.add(grip);
    grips.push(grip);
  }

  return { controllers, grips };
}
