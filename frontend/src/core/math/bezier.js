// Cubic Bezier easing calculator for smooth keyframe interpolation
export function cubicBezier(p1x, p1y, p2x, p2y) {
  return function (t) {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    function sampleCurveX(t) {
      return ((ax * t + bx) * t + cx) * t;
    }

    function sampleCurveY(t) {
      return ((ay * t + by) * t + cy) * t;
    }

    // Binary subdivision to solve t for given x
    let t0 = 0;
    let t1 = 1;
    let t2 = t;
    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t2) - t;
      if (Math.abs(x2) < 1e-4) return sampleCurveY(t2);
      if (x2 > 0) t1 = t2;
      else t0 = t2;
      t2 = (t1 + t0) * 0.5;
    }
    return sampleCurveY(t2);
  };
}

export const easeInOut = cubicBezier(0.42, 0, 0.58, 1);
export const easeOut = cubicBezier(0, 0, 0.58, 1);
export const easeIn = cubicBezier(0.42, 0, 1, 1);
