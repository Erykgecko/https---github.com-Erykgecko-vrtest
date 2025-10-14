// src/controls.js
// Normalizes XR gamepad input into a simple control state.
// For now: forward/back thrust (right stick Y) + hold-to-brake (R3 or B).

function isFiniteNumber(n){ return typeof n === 'number' && Number.isFinite(n); }
function safeAxis(axes, idx, fb=0){ const v = axes && axes.length>idx ? axes[idx] : undefined; return isFiniteNumber(v) ? v : fb; }
function dz(v, dead=0.15){
  if(!isFiniteNumber(v)) return 0;
  const a = Math.abs(v);
  if(a < dead) return 0;
  const sign = Math.sign(v);
  return sign * Math.min(1, (a - dead) / (1 - dead));
}
function btn(gp, i){
  const b = gp?.buttons?.[i];
  return { pressed: !!b?.pressed, touched: !!b?.touched, value: isFiniteNumber(b?.value) ? b.value : 0 };
}
function pressedAny(gp, idx=[]) { return idx.some(i => btn(gp, i).pressed); }

export class XRControls {
  constructor(renderer){
    this.renderer = renderer;
    // one-time log to discover mappings if needed
    this._logged = false;
  }

  _getPads(){
    const pads = { left:null, right:null };
    const session = this.renderer.xr.getSession();
    if(!session) return pads;
    for(const src of session.inputSources){
      const gp = src.gamepad;
      if(!gp) continue;
      if(src.handedness === 'left')  pads.left  = gp;
      if(src.handedness === 'right') pads.right = gp;
    }
    return pads;
  }

  // Call once per frame; returns a normalized control state
  sample(){
    const { left, right } = this._getPads();

    if (right && !this._logged) {
      // Uncomment to inspect mapping:
      // console.log('Right axes:', Array.from(right.axes||[]));
      // console.log('Right buttons:', right.buttons?.map(b=>({p:!!b?.pressed,t:!!b?.touched,v:b?.value||0})));
      this._logged = true;
    }

    // Right stick Y → forward/back scalar in [-1,1]
    // Prefer axes[3], fallback to [1]
    const rawY = right?.axes ? safeAxis(right.axes, 3, safeAxis(right.axes, 1, 0)) : 0;
    const fwd = -dz(rawY); // push up (−1) → +1 forward

     // Typical mapping: axes[2]. Fallback to [0] if needed.
    const rawX = left?.axes ? safeAxis(left.axes, 2, safeAxis(left.axes, 2, 0)) : 0;
    const strafe = dz(rawX); // right = +, left = − (local +X)

    // NEW: left stick X → yaw (turn). Typical mapping: axes[0]; fallback axes[2].
const rawYaw = right?.axes ? safeAxis(right.axes, 2, safeAxis(right.axes, 2, 0)) : 0;
const yaw = -dz(rawYaw);   // right = +yaw, left = −yaw

    // Hold-to-brake: R3 (9/10) or B (4) as fallback
    const braking = right ? (pressedAny(right, [3,9,10]) || pressedAny(right, [4])) : false;

    this._lastDebug = {
      leftAxes: Array.from(left?.axes ?? []),
      rightAxes: Array.from(right?.axes ?? []),
      yaw, braking
    };

    return {
      // translation thrust in local suit axes we currently drive:
      thrust: { x: 0, y: 0, z: fwd }, // z>0 means forward along local -Z (we'll convert in suit)
      braking,
      // placeholders we’ll fill next step:
      strafe,   // local X
      lift:   0,   // local Y
      rot: { yaw, pitch:0, roll:0 }, // rad/s inputs later
    };
  }
  // 👇 read-only snapshot for logging from main
  debugState(){ return this._lastDebug; }
}
