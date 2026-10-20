precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uProgress; // 0.0 to 1.0

void main(void) {
  vec4 fromColor = texture2D(uFrom, vTextureCoord);
  vec4 toColor = texture2D(uTo, vTextureCoord);
  // Crossfade transition
  gl_FragColor = mix(fromColor, toColor, uProgress);
}
