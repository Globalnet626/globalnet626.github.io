// gleebsal.scr: five scenes in a 256-colour framebuffer.
(function (root) {
	var IDLE_MS = 5 * 60 * 1000;
	// Long enough for the second click of a double-click on gleebsal.scr.
	var GRACE_MS = 500;
	var MOVE_PX = 10;
	var PRESS = { keydown: true, pointerdown: true, mousedown: true, touchstart: true, wheel: true };

	function canStart(state) {
		return !state.hidden && !state.fullscreen && !state.iframe && !state.disabled;
	}

	function createIdle(opts) {
		var now = opts.now || Date.now;
		var setIntervalFn = opts.setInterval || setInterval;
		var clearIntervalFn = opts.clearInterval || clearInterval;
		var lastActivity = now();
		var started = 0;
		var running = false;
		var timer = null;
		var mouseX, mouseY, moved;

		function start(options) {
			if (running) return false;
			started = now();
			moved = 0;
			running = opts.onStart(options) !== false;
			if (!running) lastActivity = started;
			return running;
		}

		function stop(reason) {
			if (!running) return false;
			running = false;
			lastActivity = now();
			opts.onStop(reason);
			return true;
		}

		function check() {
			if (!running && now() - lastActivity >= IDLE_MS && canStart(opts.eligibility())) {
				start();
			}
		}

		function activity(type, x, y) {
			var stamp = now();
			lastActivity = stamp;
			if (type === "mousemove") {
				if (running && mouseX !== undefined && stamp - started >= GRACE_MS) {
					var dx = x - mouseX;
					var dy = y - mouseY;
					moved += Math.sqrt(dx * dx + dy * dy);
				}
				mouseX = x;
				mouseY = y;
				if (running && moved >= MOVE_PX) return stop(type);
			} else if (running && PRESS[type]) {
				if (stamp - started < GRACE_MS) return false;
				return stop(type);
			}
			return false;
		}

		return {
			start: start,
			stop: stop,
			isRunning: function () { return running; },
			activity: activity,
			watch: function () {
				if (timer === null) timer = setIntervalFn(check, 1000);
			},
			unwatch: function () {
				if (timer === null) return;
				clearIntervalFn(timer);
				timer = null;
			}
		};
	}

	if (typeof module !== "undefined" && module.exports) {
		module.exports = { IDLE_MS: IDLE_MS, GRACE_MS: GRACE_MS, createIdle: createIdle };
	}
	if (typeof document === "undefined" || root.gleebsalScreensaver) return;

	var soundtrack = root.gleebsalScreensaverMusic;
	var player = soundtrack.createPlayer();
	var PART_SECONDS = soundtrack.PART_SECONDS;
	var TAU = Math.PI * 2;
	var STAR_COUNT = 400;
	var FIRE_STEP = 1 / 50;
	var LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
	var PLASMA = [[12, 17, 52], [43, 26, 108], [112, 38, 133], [211, 67, 123],
		[249, 153, 100], [36, 146, 154], [16, 72, 108], [12, 17, 52]];
	var COPPER = [
		[[51, 19, 40], [180, 64, 53], [255, 195, 114]],
		[[10, 39, 57], [19, 126, 141], [149, 244, 219]],
		[[32, 21, 68], [105, 56, 161], [219, 168, 250]]
	];
	var TUNNEL = [[0, 0, 127], [0, 128, 130], [191, 184, 191]];
	var FLAME = [[0, 0, 0], [26, 0, 12], [96, 3, 13], [207, 19, 11], [255, 75, 8],
		[255, 145, 25], [255, 208, 72], [255, 239, 151], [255, 255, 255]];
	var INKS = [[12, 86, 72], [23, 119, 161], [81, 23, 118], [152, 67, 53]];
	var CORNERS = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
		[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
	var FACES = [[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4],
		[7, 6, 2, 3], [4, 7, 3, 0], [1, 2, 6, 5]];
	var doc = document;
	var overlay, canvas, ctx, screen;
	var raf = 0;
	var clickTimer = 0;
	var dismissKey = null;
	var pressTypes = Object.keys(PRESS);
	var pressOptions = { capture: true, passive: false };
	var lastTime = null;
	var slower;
	var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)");
	var sine = new Int8Array(1024);
	var vertices = CORNERS.slice();

	for (var i = 0; i < sine.length; i++) sine[i] = Math.round(31 * Math.sin(i * TAU / sine.length));
	FACES.forEach(function (face) {
		var a = CORNERS[face[0]];
		var c = CORNERS[face[2]];
		vertices.push([(a[0] + c[0]) * 0.61, (a[1] + c[1]) * 0.61, (a[2] + c[2]) * 0.61]);
	});

	function rgb(palette, index, r, g, b) {
		var p = index * 3;
		palette[p] = r;
		palette[p + 1] = g;
		palette[p + 2] = b;
	}

	function ramp(palette, first, count, stops) {
		for (var i = 0; i < count; i++) {
			var t = i * (stops.length - 1) / (count - 1);
			var step = Math.min(stops.length - 2, t | 0);
			var f = t - step;
			var a = stops[step];
			var b = stops[step + 1];
			rgb(palette, first + i, a[0] + (b[0] - a[0]) * f,
				a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
		}
	}

	function setPalette(s, part) {
		var p = s.palette;
		var i, j, shade, color, r, g, b;
		p.fill(0);
		if (part === 0) {
			ramp(p, 1, 63, [[9, 13, 27], [26, 39, 70], [76, 103, 149], [175, 209, 221], [252, 239, 204]]);
		} else if (part === 1) {
			ramp(p, 1, 128, PLASMA);
			for (i = 0; i < COPPER.length; i++) {
				for (j = 0; j < 16; j++) {
					shade = Math.max(0, 1 - Math.abs(j - 5) / 10);
					color = COPPER[i][shade < 0.55 ? 0 : 1];
					var next = COPPER[i][shade < 0.55 ? 1 : 2];
					var f = shade < 0.55 ? shade / 0.55 : (shade - 0.55) / 0.45;
					rgb(p, 129 + i * 16 + j, color[0] + (next[0] - color[0]) * f,
						color[1] + (next[1] - color[1]) * f, color[2] + (next[2] - color[2]) * f);
				}
			}
		} else if (part === 2) {
			for (i = 0; i < TUNNEL.length * 3; i++) {
				color = TUNNEL[(i / 3) | 0];
				for (j = 0; j < 16; j++) {
					shade = j / 15;
					var bevel = i % 3;
					var light = shade * (bevel === 0 ? 0.62 : 1);
					var glint = bevel === 2 ? shade * 24 : 0;
					rgb(p, i * 16 + j, color[0] * light + glint,
						color[1] * light + glint, color[2] * light + glint);
				}
			}
		} else if (part === 3) {
			ramp(p, 0, 224, FLAME);
		} else {
			// The low nibble is the backdrop. Each face ink adds one bit.
			for (i = 0; i < 224; i++) {
				shade = i & 15;
				r = 4 + shade * 2.6;
				g = 6 + shade * 2.4;
				b = 16 + shade * 4.6;
				for (j = 0; j < INKS.length; j++) {
					if (!(i & (16 << j))) continue;
					r += INKS[j][0];
					g += INKS[j][1];
					b += INKS[j][2];
				}
				rgb(p, i, Math.min(255, r), Math.min(255, g), Math.min(255, b));
			}
		}
	}

	function present(s, fade, cycle) {
		var p = s.palette;
		var colours = s.colours;
		for (var i = 0; i < 256; i++) {
			var index = cycle && i >= 1 && i <= 128 ? 1 + ((i - 1 + cycle) & 127) : i;
			var j = index * 3;
			var r = (p[j] * fade) | 0;
			var g = (p[j + 1] * fade) | 0;
			var b = (p[j + 2] * fade) | 0;
			colours[i] = LITTLE_ENDIAN ? 0xff000000 | b << 16 | g << 8 | r : r << 24 | g << 16 | b << 8 | 255;
		}
		for (var at = 0; at < s.pixels.length; at++) s.rgba[at] = colours[s.pixels[at]];
		ctx.putImageData(s.image, 0, 0);
	}

	function star(s, i, z) {
		s.stars[i] = (Math.random() - 0.5) * 3.8;
		s.stars[i + 1] = (Math.random() - 0.5) * 3.8;
		s.stars[i + 2] = z;
	}

	function starfield(s, delta, t) {
		var pixels = s.pixels;
		var distance = delta * (0.72 + 0.95 * smooth((t - 9.5) / 4.5));
		var sin = Math.sin(t * 0.094);
		var cos = Math.cos(t * 0.094);
		pixels.fill(0);
		for (var i = 0; i < s.stars.length; i += 3) {
			var z = s.stars[i + 2] - distance;
			if (z < 0.24) {
				z = 4.5 - (0.24 - z) % 4.26;
				star(s, i, z);
			}
			s.stars[i + 2] = z;
			var sx = s.stars[i] * s.short;
			var sy = s.stars[i + 1] * s.short;
			var x = sx * cos - sy * sin;
			var y = sx * sin + sy * cos;
			var ink = 7 + (((4.5 - z) / 4.26 * 56) | 0);
			var length = 1 + ((4.5 - z) * (4.5 - z) / 4 | 0);
			for (var j = length - 1; j >= 0; j--) {
				var inv = 1 / (z + j * 0.035);
				var px = Math.floor(s.w / 2 + x * inv);
				var py = Math.floor(s.h / 2 + y * inv);
				if (px >= 0 && px < s.w && py >= 0 && py < s.h) pixels[py * s.w + px] = ink - j * 5;
			}
		}
	}

	function plasma(s, t) {
		var pixels = s.pixels;
		var a = (t * 112) | 0;
		var b = (t * 79) | 0;
		var c = (t * 137) | 0;
		var d = (t * 57) | 0;
		var x, y, at = 0;
		for (x = 0; x < s.w; x++) s.wave[x] = sine[(x * 9 + a) & 1023];
		for (y = 0; y < s.h; y++) {
			var row = sine[(y * 13 - b) & 1023];
			var diag = y * 6 + d;
			for (x = 0; x < s.w; x++, at++, diag += 5) {
				pixels[at] = 1 + ((128 + s.wave[x] + row + sine[diag & 1023] + sine[(s.rings[at] - c) & 1023]) >> 1);
			}
		}
		for (var bar = 0; bar < 3; bar++) {
			var top = (s.h * (0.46 + 0.29 * Math.sin(t * (1.37 + bar * 0.23) + bar * 2.1))) | 0;
			for (y = 0; y < 16; y++) {
				at = (top + y) * s.w;
				pixels.fill(129 + bar * 16 + y, at, at + s.w);
			}
		}
	}

	function makeTunnel(s) {
		var pad = Math.ceil(s.short * 0.09);
		var w = s.w + 2 * pad;
		var h = s.h + 2 * pad;
		var maps = {
			pad: pad,
			w: w,
			distance: new Uint8Array(w * h),
			angle: new Uint8Array(w * h),
			shade: new Uint8Array(w * h),
			texture: new Uint8Array(128 * 128)
		};
		for (var y = 0, i = 0; y < h; y++) {
			for (var x = 0; x < w; x++, i++) {
				var dx = x - w / 2;
				var dy = y - h / 2;
				var radius = Math.sqrt(dx * dx + dy * dy);
				maps.distance[i] = (s.short * 84 / Math.max(1, radius)) & 127;
				maps.angle[i] = (Math.atan2(dy, dx) * 128 / TAU + 128) & 127;
				maps.shade[i] = Math.min(15, 19 * Math.pow(Math.min(1, radius * 2 / s.short), 0.72));
			}
		}
		for (var v = 0; v < 128; v++) {
			for (var u = 0; u < 128; u++) {
				var tile = ((u >> 4) ^ (v >> 5)) & 3;
				var material = tile === 3 ? 1 : tile;
				var edge = 1;
				if ((u & 15) === 15 || (v & 31) === 31) edge = 0;
				else if (!(u & 15) || !(v & 31)) edge = 2;
				maps.texture[v * 128 + u] = (material * 3 + edge) * 16;
			}
		}
		return maps;
	}

	function tunnel(s, t) {
		var m = s.tunnel;
		var x0 = m.pad + Math.round(Math.sin(t * 1.31) * m.pad * 0.92);
		var y0 = m.pad + Math.round(Math.sin(t * 1.87 + 1.1) * m.pad * 0.72);
		var turn = (t * 14 + 8 * Math.sin(t * 0.64)) | 0;
		var advance = (t * 58) | 0;
		var distance = m.distance;
		var angle = m.angle;
		var shade = m.shade;
		var texture = m.texture;
		var pixels = s.pixels;
		for (var y = 0, dest = 0; y < s.h; y++) {
			var src = (y + y0) * m.w + x0;
			var end = src + s.w;
			for (; src < end; src++, dest++) {
				pixels[dest] = texture[(((distance[src] + advance) & 127) << 7) + ((angle[src] + turn) & 127)] + shade[src];
			}
		}
	}

	function fire(s, t) {
		var w = s.w;
		var heat = s.heat;
		var bottom = (s.h - 1) * w;
		var target = (t / FIRE_STEP) | 0;
		var first = Math.max(s.fireTick + 1, target - 3);
		for (var tick = first; tick <= target; tick++) {
			var noise = tick * 137;
			var wind = sine[(tick * 3) & 1023];
			for (var x = 0; x < w; x++) {
				var plume = sine[(x * 31 + tick * 7) & 1023] + sine[(x * 11 - tick * 9) & 1023];
				heat[bottom + x] = Math.min(223, 104 + plume + wind + (Math.random() * 51 | 0));
			}
			for (var at = 0; at < bottom - w;) {
				var below = at + w;
				var end = below;
				heat[at++] = 0;
				below++;
				for (; at < end - 1; at++, below++, noise++) {
					var temp = ((heat[below - 1] + heat[below] + heat[below + 1] + heat[below + w]) >> 2) - s.cool[noise & 4095];
					heat[at] = Math.max(0, temp);
				}
				heat[at++] = 0;
			}
			for (x = bottom - w; x < bottom; x++) heat[x] = heat[x + w];
		}
		s.fireTick = target;
		s.pixels.set(heat);
	}

	function scanTriangle(s, a, b, c, ink) {
		var x = s.projectX;
		var y = s.projectY;
		var swap;
		if (y[b] < y[a]) { swap = a; a = b; b = swap; }
		if (y[c] < y[a]) { swap = a; a = c; c = swap; }
		if (y[c] < y[b]) { swap = b; b = c; c = swap; }
		var top = y[a];
		var mid = y[b];
		var bottom = y[c];
		if (bottom === top) return;
		var long = (x[c] - x[a]) / (bottom - top);
		var upper = mid === top ? 0 : (x[b] - x[a]) / (mid - top);
		var lower = bottom === mid ? 0 : (x[c] - x[b]) / (bottom - mid);
		var start = Math.max(0, Math.ceil(top - 0.5));
		var end = Math.min(s.h, Math.ceil(bottom - 0.5));
		var pixels = s.pixels;
		for (var row = start; row < end; row++) {
			var sample = row + 0.5;
			var p = x[a] + (sample - top) * long;
			var q = sample < mid ? x[a] + (sample - top) * upper : x[b] + (sample - mid) * lower;
			var left = Math.max(0, Math.ceil(Math.min(p, q) - 0.5));
			var right = Math.min(s.w, Math.ceil(Math.max(p, q) - 0.5));
			var line = row * s.w;
			for (var at = line + left; at < line + right; at++) pixels[at] |= ink;
		}
	}

	function makeGrid(s) {
		var grid = new Uint8Array(s.pixels.length);
		var horizon = (s.h * 0.43) | 0;
		var next = horizon + 7;
		var gap = 4;
		for (var y = 0; y < s.h; y++) {
			var row = y * s.w;
			var depth = Math.max(1, y - horizon);
			var band = y > horizon ? Math.min(6, 3 + (depth / 30 | 0)) : y / 34 | 0;
			grid.fill(band, row, row + s.w);
			if (depth < 7) continue;
			var line = y === next;
			if (line) {
				next += Math.round(gap);
				gap *= 1.44;
			}
			for (var x = 0; x < s.w; x++) {
				var ray = (x - s.w / 2) / (depth * 0.52);
				if ((line && (x & 1) === 0) || Math.abs(ray - Math.round(ray)) * depth < 0.9) {
					grid[row + x] = band + (depth > 18 ? 5 : 2);
				}
			}
		}
		return grid;
	}

	function glenz(s, t) {
		var ax = 0.42 + t * 0.54;
		var ay = 0.61 + t * 0.74;
		var az = t * 0.32;
		var cx = Math.cos(ax), sx = Math.sin(ax);
		var cy = Math.cos(ay), sy = Math.sin(ay);
		var cz = Math.cos(az), sz = Math.sin(az);
		var px = s.projectX;
		var py = s.projectY;
		s.pixels.set(s.grid);
		for (var i = 0; i < vertices.length; i++) {
			var v = vertices[i];
			var y = v[1] * cx - v[2] * sx;
			var z = v[1] * sx + v[2] * cx;
			var x = v[0] * cy + z * sy;
			z = z * cy - v[0] * sy;
			var scale = s.short * 0.75 / (z + 3.9);
			px[i] = s.w / 2 + (x * cz - y * sz) * scale;
			py[i] = s.h * 0.41 + (x * sz + y * cz) * scale;
		}
		for (var face = 0; face < FACES.length; face++) {
			var c = face + CORNERS.length;
			for (var edge = 0; edge < 4; edge++) {
				var a = FACES[face][edge];
				var b = FACES[face][(edge + 1) & 3];
				var cross = (px[b] - px[a]) * (py[c] - py[a]) - (py[b] - py[a]) * (px[c] - px[a]);
				var ink = 16 << ((cross < 0 ? 0 : 2) + ((face + edge) & 1));
				if (cross) scanTriangle(s, a, b, c, ink);
			}
		}
	}

	function smooth(f) {
		f = Math.max(0, Math.min(1, f));
		return f * f * (3 - 2 * f);
	}

	function paint(position, delta) {
		var s = screen;
		var part = position.part;
		var t = position.partTime;
		var fadeTime = slower ? 0.32 : 0.20;
		var fade = smooth(Math.min(t, PART_SECONDS - t) / fadeTime);
		var cycle = 0;
		if (position.scene !== s.scene) {
			setPalette(s, part);
			if (part === 0) {
				for (var i = 0; i < s.stars.length; i += 3) star(s, i, 0.24 + Math.random() * 4.26);
			} else if (part === 3) {
				s.heat.fill(0);
				s.fireTick = -1;
			}
			s.scene = position.scene;
		}
		if (part === 0) starfield(s, Math.min(delta, t), t);
		else if (part === 1) {
			plasma(s, t);
			cycle = (t * 19 | 0) & 127;
		} else if (part === 2) tunnel(s, t);
		else if (part === 3) fire(s, t);
		else glenz(s, t);
		present(s, fade, cycle);
	}

	function resize() {
		var vw = root.innerWidth || 1;
		var vh = root.innerHeight || 1;
		var w = vw > vh ? Math.min(480, Math.round(200 * vw / vh)) : 200;
		var h = vh > vw ? Math.min(480, Math.round(200 * vh / vw)) : 200;
		if (screen && screen.w === w && screen.h === h) return;
		canvas.width = w;
		canvas.height = h;
		var image = ctx.createImageData(w, h);
		var s = {
			w: w, h: h, short: Math.min(w, h),
			image: image,
			rgba: new Uint32Array(image.data.buffer),
			pixels: new Uint8Array(w * h),
			palette: new Uint8Array(256 * 3),
			colours: new Uint32Array(256),
			stars: new Float32Array(STAR_COUNT * 3),
			wave: new Int8Array(w),
			rings: new Uint16Array(w * h),
			heat: new Uint8Array(w * h),
			cool: new Uint8Array(4096),
			projectX: new Float64Array(vertices.length),
			projectY: new Float64Array(vertices.length),
			scene: -1
		};
		for (var y = 0, i = 0; y < h; y++) {
			for (var x = 0; x < w; x++, i++) {
				var dx = x - w * 0.54;
				var dy = y - h * 0.46;
				s.rings[i] = Math.sqrt(dx * dx + dy * dy) * 14;
			}
		}
		// Low cooling lets the flames climb past mid-screen.
		for (i = 0; i < s.cool.length; i++) s.cool[i] = Math.random() * 3 | 0;
		s.tunnel = makeTunnel(s);
		s.grid = makeGrid(s);
		screen = s;
	}

	function frame() {
		raf = 0;
		if (!idle.isRunning() || doc.hidden) return;
		var seconds = player.time();
		var delta = lastTime === null ? 0 : Math.max(0, seconds - lastTime) / (slower ? 2 : 1);
		lastTime = seconds;
		paint(soundtrack.positionAt(seconds, slower), delta);
		raf = root.requestAnimationFrame(frame);
	}

	function pause() {
		if (raf) root.cancelAnimationFrame(raf);
		raf = 0;
		lastTime = null;
	}

	function ensureOverlay() {
		if (ctx) return true;
		canvas = doc.createElement("canvas");
		ctx = canvas.getContext("2d", { alpha: false });
		if (!ctx) return false;
		overlay = doc.createElement("div");
		overlay.className = "gleebsal-screensaver";
		overlay.setAttribute("aria-hidden", "true");
		overlay.appendChild(canvas);
		var style = doc.createElement("style");
		style.textContent = ".gleebsal-screensaver{position:fixed;inset:0;z-index:2147483647;" +
			"background:#000;cursor:none;touch-action:none}" +
			".gleebsal-screensaver canvas{display:block;width:100%;height:100%;object-fit:contain;" +
			"image-rendering:pixelated;pointer-events:none}" +
			".gleebsal-screensaver.is-dismissing{background:transparent;cursor:auto}" +
			".gleebsal-screensaver.is-dismissing canvas{display:none}";
		doc.head.appendChild(style);
		return true;
	}

	function removeOverlay() {
		if (clickTimer) root.clearTimeout(clickTimer);
		clickTimer = 0;
		if (overlay && overlay.parentNode) {
			pressTypes.forEach(function (type) { root.removeEventListener(type, dismissOnPress, true); });
			overlay.parentNode.removeChild(overlay);
		}
	}

	function open(options) {
		if (!ensureOverlay()) return false;
		removeOverlay();
		overlay.classList.remove("is-dismissing");
		var part = options && Number(options.part);
		part = part >= 1 && part <= 5 && part % 1 === 0 ? part - 1 : 0;
		slower = !!(reduced && reduced.matches);
		resize();
		doc.body.appendChild(overlay);
		pressTypes.forEach(function (type) { root.addEventListener(type, dismissOnPress, pressOptions); });
		player.start(part, slower, doc.hidden);
		if (!doc.hidden) raf = root.requestAnimationFrame(frame);
		return true;
	}

	function close(reason) {
		pause();
		player.stop();
		screen = null;
		canvas.width = canvas.height = 0;
		if (reason === "pointerdown" || reason === "mousedown" || reason === "touchstart") {
			overlay.classList.add("is-dismissing");
			clickTimer = root.setTimeout(removeOverlay, 400);
		} else {
			removeOverlay();
		}
	}

	var idle = createIdle({
		now: function () { return root.performance.now(); },
		setInterval: function (fn, ms) { return root.setInterval(fn, ms); },
		clearInterval: function (timer) { root.clearInterval(timer); },
		eligibility: function () {
			var active = doc.activeElement;
			return {
				hidden: doc.hidden,
				fullscreen: !!doc.fullscreenElement,
				iframe: active && active.tagName === "IFRAME",
				disabled: doc.body.getAttribute("data-screensaver") === "off"
			};
		},
		onStart: open,
		onStop: close
	});

	function swallow(event) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}

	function activity(event) {
		var type = event.type;
		if (type === "mousemove") {
			var dismissed = idle.activity(type, event.clientX, event.clientY);
			if (dismissed || idle.isRunning() || clickTimer) event.stopImmediatePropagation();
		} else if (type === "scroll" || !idle.isRunning()) {
			idle.activity(type);
		}
	}

	function dismissOnPress(event) {
		var dismissed = idle.activity(event.type);
		if (dismissed && event.type === "keydown") dismissKey = event.code || event.key;
		if (dismissed || idle.isRunning() || (clickTimer && event.type !== "keydown")) swallow(event);
	}

	["mousemove", "mousedown", "pointerdown", "keydown", "wheel", "touchstart", "scroll"].forEach(function (type) {
		root.addEventListener(type, activity, { capture: true, passive: true });
	});
	root.addEventListener("keydown", function (event) {
		if (dismissKey !== null && event.repeat && dismissKey === (event.code || event.key)) swallow(event);
	}, true);
	["mouseup", "pointerup", "touchend", "auxclick", "contextmenu"].forEach(function (type) {
		root.addEventListener(type, function (event) {
			if (idle.isRunning() || clickTimer) swallow(event);
		}, true);
	});
	root.addEventListener("keyup", function (event) {
		var dismissed = dismissKey !== null && dismissKey === (event.code || event.key);
		if (dismissed) dismissKey = null;
		if (dismissed || idle.isRunning()) swallow(event);
	}, true);
	root.addEventListener("blur", function () { dismissKey = null; });
	root.addEventListener("click", function (event) {
		if (idle.isRunning() || clickTimer) {
			swallow(event);
			if (clickTimer) removeOverlay();
			return;
		}
		var link = event.target.closest && event.target.closest("[data-screensaver-launch]");
		if (link) {
			event.preventDefault();
			idle.start();
		}
	}, true);
	root.addEventListener("resize", function () {
		if (idle.isRunning() && !doc.hidden) resize();
	});
	doc.addEventListener("visibilitychange", function () {
		if (doc.hidden) {
			pause();
			player.pause();
		} else {
			idle.activity("visible");
			if (idle.isRunning() && !raf) {
				resize();
				player.resume();
				raf = root.requestAnimationFrame(frame);
			}
		}
	});
	root.addEventListener("pagehide", function () {
		idle.stop();
		player.pause();
		idle.unwatch();
		removeOverlay();
	});
	root.addEventListener("pageshow", function (event) {
		if (!event.persisted) return;
		idle.activity("visible");
		idle.watch();
	});
	root.gleebsalScreensaver = { start: idle.start, stop: idle.stop, isRunning: idle.isRunning };
	idle.watch();
})(typeof globalThis !== "undefined" ? globalThis : this);
