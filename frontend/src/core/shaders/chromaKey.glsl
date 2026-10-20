precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec3 uKeyColor; // Default green: vec3(0.0, 1.0, 0.0)
uniform float uSimilarity; // e.g. 0.4
uniform float uSmoothness; // e.g. 0.1

void main(void) {
  vec4 color = texture2D(uSampler, vTextureCoord);
  float dist = distance(color.rgb, uKeyColor);
  float edge = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist);
  gl_FragColor = vec4(color.rgb * edge, color.a * edge);
}
