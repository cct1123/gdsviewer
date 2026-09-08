// Bevel/refraction adapted from liquidGL v2.0.2, MIT © NaughtyDuk.
// See vendor/VENDORED.md and vendor/LIQUIDGL-LICENSE.txt.
// This renderer samples a procedural decorative background, never layout pixels or DOM snapshots.
(() => {
  "use strict";

  const root = document.querySelector(".viewer");
  if (!root) return;
  const panes = Array.from(root.querySelectorAll("[data-liquid-pane]"));
  const reducedTransparency = matchMedia("(prefers-reduced-transparency: reduce)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let surface = null;
  let gl = null;
  let program = null;
  let buffer = null;
  let uniforms = null;
  let frame = null;
  let observer = null;
  let light = null;
  let suspended = false;

  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 u_size;
    uniform vec4 u_pane;
    uniform vec2 u_light;
    uniform float u_radius;
    uniform float u_squircle;
    uniform float u_lens;

    // A softly lit backdrop shared by the plain background and refracted regions.
    vec3 backdrop(vec2 uv) {
      vec3 color = vec3(0.89, 0.90, 0.88);
      float shade = exp(-dot((uv - vec2(0.08, 0.24)) * vec2(2.0, 1.3),
                           (uv - vec2(0.08, 0.24)) * vec2(2.0, 1.3)) * 3.0);
      float warmth = exp(-dot((uv - vec2(0.91, 0.14)) * vec2(1.6, 2.0),
                           (uv - vec2(0.91, 0.14)) * vec2(1.6, 2.0)) * 4.0);
      color = mix(color, vec3(0.69, 0.72, 0.68), shade * 0.42);
      color = mix(color, vec3(0.91, 0.90, 0.86), warmth * 0.4);
      float curve = uv.x + 0.23 * sin(uv.y * 4.0 + 0.5);
      float ribbon = smoothstep(0.17, 0.19, curve) - smoothstep(0.32, 0.46, curve);
      float rim = exp(-pow((curve - 0.18) * 110.0, 2.0));
      color = mix(color, vec3(0.77, 0.80, 0.75), ribbon * 0.22);
      color += rim * 0.025;
      float second = uv.y - 0.14 * sin(uv.x * 5.0);
      color += exp(-pow((second - 0.83) * 32.0, 2.0)) * 0.025;
      return color;
    }

    // liquidGL's rounded-box bevel, extended with an L4 corner for CSS squircles.
    float boxDistance(vec2 p, vec2 halfSize, float radius) {
      vec2 q = abs(p) - halfSize + radius;
      vec2 outside = max(q, 0.0);
      float roundCorner = length(outside);
      float smoothCorner = pow(pow(outside.x, 4.0) + pow(outside.y, 4.0), 0.25);
      return mix(roundCorner, smoothCorner, u_squircle) + min(max(q.x, q.y), 0.0) - radius;
    }

    void main() {
      vec2 pixel = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y);
      vec2 uv = pixel / u_size;
      if (u_lens < 0.5) {
        gl_FragColor = vec4(backdrop(uv), 1.0);
        return;
      }
      vec2 halfSize = u_pane.zw * 0.5;
      vec2 p = pixel - u_pane.xy - halfSize;
      float distance = boxDistance(p, halfSize, u_radius);
      if (distance > 0.7) discard;
      float bevel = 1.0 - smoothstep(0.0, min(halfSize.x, halfSize.y) * 0.20, -distance);
      vec2 gradient = vec2(
        boxDistance(p + vec2(0.5, 0.0), halfSize, u_radius) - boxDistance(p - vec2(0.5, 0.0), halfSize, u_radius),
        boxDistance(p + vec2(0.0, 0.5), halfSize, u_radius) - boxDistance(p - vec2(0.0, 0.5), halfSize, u_radius)
      );
      vec2 normal = gradient / max(length(gradient), 0.001);
      // As in liquidGL, refraction grows sharply at the bevel. Dispersion stays at the rim.
      float amount = bevel * 0.012 + pow(bevel, 10.0) * 0.04;
      vec2 offset = normal * amount * min(u_pane.z, u_pane.w) / u_size;
      vec3 refracted = backdrop(uv + offset);
      refracted.r = backdrop(uv + offset * 0.75).r;
      refracted.b = backdrop(uv + offset * 1.25).b;
      vec3 color = mix(refracted, vec3(1.0), 0.26);
      vec2 lightDirection = (u_light - pixel) / max(length(u_light - pixel), 1.0);
      float specular = pow(max(dot(normal, lightDirection), 0.0), 3.0);
      float edge = 1.0 - smoothstep(0.0, 2.2, -distance);
      color += edge * (0.04 + specular * 0.13);
      color -= bevel * (1.0 - specular) * 0.045;
      float coverage = 1.0 - smoothstep(-0.7, 0.7, distance);
      gl_FragColor = vec4(mix(backdrop(uv), color, coverage), 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Glass shader unavailable");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error("Glass shader compilation failed");
    }
    return shader;
  }

  function draw() {
    frame = null;
    if (!gl || document.hidden) return;
    const bounds = surface.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    // Limit decorative GPU work independently of file size and monitor pixel density.
    const maxDimension = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    const ratio = Math.min(devicePixelRatio || 1, 1.5,
      Math.sqrt(1500000 / (bounds.width * bounds.height)),
      maxDimension / Math.max(bounds.width, bounds.height));
    const width = Math.max(1, Math.floor(bounds.width * ratio));
    const height = Math.max(1, Math.floor(bounds.height * ratio));
    if (surface.width !== width || surface.height !== height) {
      surface.width = width;
      surface.height = height;
    }
    const sx = width / bounds.width;
    const sy = height / bounds.height;
    gl.viewport(0, 0, width, height);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(program);
    gl.uniform2f(uniforms.size, width, height);
    gl.uniform2f(uniforms.light, light ? (light.x - bounds.left) * sx : width * 0.18,
      light ? (light.y - bounds.top) * sy : -height * 0.15);
    gl.uniform1f(uniforms.lens, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.uniform1f(uniforms.lens, 1);
    gl.enable(gl.SCISSOR_TEST);
    for (const pane of panes) {
      const rect = pane.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const x = (rect.left - bounds.left) * sx;
      const y = (rect.top - bounds.top) * sy;
      const w = rect.width * sx;
      const h = rect.height * sy;
      const left = Math.max(0, Math.floor(x));
      const top = Math.max(0, Math.floor(y));
      const right = Math.min(width, Math.ceil(x + w));
      const bottom = Math.min(height, Math.ceil(y + h));
      if (right <= left || bottom <= top) continue;
      const style = getComputedStyle(pane);
      const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, rect.width / 2, rect.height / 2) * sx;
      gl.scissor(left, height - bottom, right - left, bottom - top);
      gl.uniform4f(uniforms.pane, x, y, w, h);
      gl.uniform1f(uniforms.radius, radius);
      const squircle = style.cornerShape === "squircle" || style.cornerShape === "superellipse(2)";
      gl.uniform1f(uniforms.squircle, squircle ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  function schedule() {
    if (!gl || frame !== null || document.hidden) return;
    frame = requestAnimationFrame(() => {
      try { draw(); } catch { dispose(); }
    });
  }

  function dispose() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    observer?.disconnect();
    observer = null;
    surface?.removeEventListener("webglcontextlost", contextLost);
    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    surface?.remove();
    surface = gl = program = buffer = uniforms = null;
    root.dataset.glass = "fallback";
  }

  function contextLost(event) {
    event.preventDefault();
    dispose();
  }

  function initialize() {
    if (surface || suspended || reducedTransparency.matches || !panes.length) return;
    root.dataset.glass = "fallback";
    try {
      surface = document.createElement("canvas");
      surface.id = "liquid-glass-surface";
      surface.setAttribute("aria-hidden", "true");
      gl = surface.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
      if (!gl) throw new Error("Decorative WebGL unavailable");
      program = gl.createProgram();
      let vertex = null;
      let fragment = null;
      try {
        vertex = compile(gl.VERTEX_SHADER, vertexSource);
        fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Glass program unavailable");
      } finally {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
      }
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Glass buffer unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = Object.fromEntries(["size", "pane", "light", "radius", "squircle", "lens"].map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
      surface.addEventListener("webglcontextlost", contextLost);
      root.prepend(surface);
      root.dataset.glass = "webgl";
      draw();
      observer = new ResizeObserver(schedule);
      observer.observe(root);
      for (const pane of panes) observer.observe(pane);
    } catch {
      dispose();
    }
  }

  // Event-driven light, with no idle animation or work during canvas navigation.
  root.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || !event.target.closest("[data-liquid-pane]")) return;
    light = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true });
  root.addEventListener("pointerleave", () => { light = null; schedule(); }, { passive: true });
  root.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("pagehide", () => { suspended = true; dispose(); });
  window.addEventListener("pageshow", () => { suspended = false; initialize(); });
  reducedTransparency.addEventListener("change", () => { dispose(); initialize(); });
  reducedMotion.addEventListener("change", () => { light = null; schedule(); });
  initialize();
})();
