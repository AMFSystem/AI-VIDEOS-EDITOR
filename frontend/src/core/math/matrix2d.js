// 2D affine transformation matrix for canvas scaling, translation, and rotation
export class Matrix2D {
  constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }

  translate(x, y) {
    this.tx += this.a * x + this.c * y;
    this.ty += this.b * x + this.d * y;
    return this;
  }

  scale(sx, sy = sx) {
    this.a *= sx;
    this.b *= sx;
    this.c *= sy;
    this.d *= sy;
    return this;
  }

  rotate(radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const a = this.a * cos + this.c * sin;
    const b = this.b * cos + this.d * sin;
    const c = this.a * -sin + this.c * cos;
    const d = this.b * -sin + this.d * cos;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    return this;
  }

  transformPoint(x, y) {
    return {
      x: x * this.a + y * this.c + this.tx,
      y: x * this.b + y * this.d + this.ty,
    };
  }
}
