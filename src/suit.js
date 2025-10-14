import * as THREE from 'three';

// ---- In-place sanitizers (mutate the object you pass in) ----
function isFiniteVec3(v) {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
function sanitizeVec3InPlace(v) {
  if (!isFiniteVec3(v)) v.set(0, 0, 0);
  return v;
}
function sanitizeQuatInPlace(q) {
  const { x, y, z, w } = q;
  if (![x, y, z, w].every(Number.isFinite)) {
    q.set(0, 0, 0, 1);
  }
  // guard tiny norms
  if (Math.abs(q.w) <= 1e-12) q.set(0, 0, 0, 1);
  return q.normalize();
}

export class SuitRig {
  constructor(rig) {
    this.rig = rig;
    this.velocity   = new THREE.Vector3();
    this.angularVel = new THREE.Vector3();

    this.maxSpeed = 5;
    this.maxSpin  = Math.PI;

    this.linearDamping  = 0.0;
    this.angularDamping = 0.0;

    this.thrustAccel = 3.0;

    // Hold-to-brake
    this.braking = false;
    this.brakeAccel = 6.0;            // m/s^2 linear decel
    this.angularBrakeAccel = Math.PI; // rad/s^2 angular decel

    this._tmp = new THREE.Vector3();
    this._dq  = new THREE.Quaternion();
  }

  rotAccel = { yaw: 2.5, pitch: 2.0, roll: 2.0 };  // tweak to taste

addAngular(localYawPitchRoll, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  // sanitize current state
  this.angularVel.set(
    Number.isFinite(this.angularVel.x) ? this.angularVel.x : 0,
    Number.isFinite(this.angularVel.y) ? this.angularVel.y : 0,
    Number.isFinite(this.angularVel.z) ? this.angularVel.z : 0
  );

  // apply yaw/pitch/roll accel in local rig axes
  const yaw   = Number.isFinite(localYawPitchRoll.yaw)   ? localYawPitchRoll.yaw   : 0;
  const pitch = Number.isFinite(localYawPitchRoll.pitch) ? localYawPitchRoll.pitch : 0;
  const roll  = Number.isFinite(localYawPitchRoll.roll)  ? localYawPitchRoll.roll  : 0;

  this.angularVel.y += yaw   * this.rotAccel.yaw   * dt;   // yaw = turn left/right
  this.angularVel.x += pitch * this.rotAccel.pitch * dt;   // (not used yet)
  this.angularVel.z += roll  * this.rotAccel.roll  * dt;   // (not used yet)

  this._clampVelocities();
}

  addThrustLocal(localVec, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    // Transform local → world, using a sanitized rig orientation
    const dir = this._tmp.copy(localVec).applyQuaternion(sanitizeQuatInPlace(this.rig.quaternion));
    sanitizeVec3InPlace(dir);

    // Accumulate into velocity
    sanitizeVec3InPlace(this.velocity);
    this.velocity.addScaledVector(dir, this.thrustAccel * dt);
    this._clampVelocities();
  }

  setBrake(on) { this.braking = !!on; }

  brakeHard() {
    this.velocity.set(0, 0, 0);
    this.angularVel.set(0, 0, 0);
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;

    // --- Smooth braking (no instant stop) ---
    sanitizeVec3InPlace(this.velocity);
    sanitizeVec3InPlace(this.angularVel);

    if (this.braking) {
      const speed = this.velocity.length();
      if (speed > 0) {
        const decel = Math.min(this.brakeAccel * dt, speed);
        // setLength(0) is safe; never passes NaN now that speed is finite
        this.velocity.setLength(speed - decel);
      }
      const spin = this.angularVel.length();
      if (spin > 0) {
        const decelW = Math.min(this.angularBrakeAccel * dt, spin);
        this.angularVel.setLength(spin - decelW);
      }
    }

    // --- Integrate linear ---
    this.rig.position.addScaledVector(this.velocity, dt);
    sanitizeVec3InPlace(this.rig.position);

    // --- Integrate angular ---
    if (this.angularVel.lengthSq() > 0) {
      this._dq.set(
        this.angularVel.x * dt * 0.5,
        this.angularVel.y * dt * 0.5,
        this.angularVel.z * dt * 0.5,
        1
      ).normalize();
      this.rig.quaternion.multiply(this._dq);
    }
    sanitizeQuatInPlace(this.rig.quaternion);

    // Optional background damping
    if (this.linearDamping)  this.velocity.multiplyScalar(Math.max(0, 1 - this.linearDamping * dt));
    if (this.angularDamping) this.angularVel.multiplyScalar(Math.max(0, 1 - this.angularDamping * dt));

    this._clampVelocities();
    sanitizeVec3InPlace(this.velocity);
  }

  _clampVelocities() {
    if (this.velocity.length() > this.maxSpeed) this.velocity.setLength(this.maxSpeed);
    this.angularVel.x = THREE.MathUtils.clamp(this.angularVel.x, -this.maxSpin, this.maxSpin);
    this.angularVel.y = THREE.MathUtils.clamp(this.angularVel.y, -this.maxSpin, this.maxSpin);
    this.angularVel.z = THREE.MathUtils.clamp(this.angularVel.z, -this.maxSpin, this.maxSpin);
  }
}
