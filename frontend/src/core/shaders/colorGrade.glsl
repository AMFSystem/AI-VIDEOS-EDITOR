precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uBrightness; // 0.0 default
uniform float uContrast;   // 1.0 default
uniform float uSaturation; // 1.0 default

void main(void) {
  vec4 color = texture2D(uSampler, vTextureCoord);
  // Apply Brightness
  vec3 rgb = color.rgb + vec3(uBrightness);
  // Apply Contrast
  rgb = (rgb - 0.5) * uContrast + 0.5;
  // Apply Saturation
  float luminance = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(luminance), rgb, uSaturation);

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
