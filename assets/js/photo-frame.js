// Hands-free photo frame. The clock is the device's current local time.
// One player owns the clock and the slideshow so they cannot stack.
(function (root) {
	var SLIDE_MS = 10000;

	function stepIndex(index, delta, length) {
		if (!length || length < 1) {
			return 0;
		}
		var next = (index + delta) % length;
		if (next < 0) {
			next += length;
		}
		return next;
	}

	function formatClock(date, locales) {
		return {
			time: date.toLocaleTimeString(locales, { hour: "numeric", minute: "2-digit" }),
			date: date.toLocaleDateString(locales, {
				weekday: "short",
				month: "short",
				day: "numeric",
				year: "numeric"
			})
		};
	}

	function createPlayer(opts) {
		opts = opts || {};
		var slideMs = opts.slideMs || SLIDE_MS;
		var now = opts.now || function () { return new Date(); };
		var locales = opts.locales;
		var playlist = opts.playlist || function () { return []; };
		var onSlide = opts.onSlide || function () {};
		var onClock = opts.onClock || function () {};
		var setIntervalFn = opts.setInterval || setInterval;
		var clearIntervalFn = opts.clearInterval || clearInterval;
		var setTimeoutFn = opts.setTimeout || setTimeout;
		var clearTimeoutFn = opts.clearTimeout || clearTimeout;
		var timers = { clock: 0, slide: 0 };
		var seq = { clock: 0, slide: 0 };
		var items = [];
		var index = 0;
		var lastClock = "";
		var running = false;

		function clearNamed(name) {
			var timer = timers[name];
			timers[name] = 0;
			seq[name] += 1;
			if (!timer) {
				return;
			}
			if (name === "clock") {
				clearIntervalFn(timer);
			} else {
				clearTimeoutFn(timer);
			}
		}

		function emit() {
			if (!items.length) {
				onSlide(null, 0, 0);
				return;
			}
			if (index < 0 || index >= items.length) {
				index = 0;
			}
			onSlide(items[index], index, items.length);
		}

		function armSlide() {
			clearNamed("slide");
			if (!running || items.length < 2) {
				return;
			}
			var token = seq.slide;
			timers.slide = setTimeoutFn(function () {
				if (token !== seq.slide || !running || items.length < 2) {
					return;
				}
				timers.slide = 0;
				index = stepIndex(index, 1, items.length);
				emit();
				armSlide();
			}, slideMs);
		}

		function tick() {
			var text = formatClock(now(), locales);
			var key = text.time + "\n" + text.date;
			if (key === lastClock) {
				return;
			}
			lastClock = key;
			onClock(text);
		}

		function start() {
			if (running) {
				return;
			}
			items = (playlist() || []).slice();
			index = 0;
			running = true;
			emit();
			clearNamed("clock");
			lastClock = "";
			tick();
			timers.clock = setIntervalFn(tick, 1000);
			armSlide();
		}

		function stop() {
			if (!running) {
				return;
			}
			running = false;
			clearNamed("clock");
			clearNamed("slide");
		}

		return {
			start: start,
			stop: stop,
			current: function () {
				return items.length ? items[index] : null;
			},
			state: function () {
				return { running: running, index: index };
			}
		};
	}

	var api = {
		SLIDE_MS: SLIDE_MS,
		stepIndex: stepIndex,
		formatClock: formatClock,
		createPlayer: createPlayer
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = api;
	}

	if (typeof document === "undefined" || root.__photoFrameStarted) {
		return;
	}
	root.__photoFrameStarted = true;

	var node = document.getElementById("frame-photos");
	var photos = [];
	if (node) {
		try {
			photos = JSON.parse(node.textContent || "[]");
		} catch (err) {
			photos = [];
		}
	}
	if (!photos || !photos.length) {
		photos = [];
	}

	var images = document.querySelectorAll(".frame-photo");
	var front = images[0];
	var back = images[1];
	var timeEl = document.querySelector(".frame-clock-time");
	var dateEl = document.querySelector(".frame-clock-date");
	var generation = 0;

	function reducedMotion() {
		try {
			return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
		} catch (err) {
			return false;
		}
	}

	function warmNext(index, count) {
		if (count < 2) {
			return;
		}
		var next = photos[stepIndex(index, 1, count)];
		if (!next || !next.src) {
			return;
		}
		var img = new Image();
		img.src = next.src;
	}

	function showPhoto(item, index, count) {
		generation += 1;
		var gen = generation;
		if (!item || !front) {
			return;
		}
		if (front.getAttribute("src") === item.src && front.classList.contains("is-shown")) {
			front.alt = item.alt || "";
			warmNext(index, count);
			return;
		}
		function commit(img) {
			if (gen !== generation) {
				return;
			}
			img.src = item.src;
			img.alt = item.alt || "";
			img.classList.add("is-shown");
			img.removeAttribute("aria-hidden");
			var other = img === front ? back : front;
			if (other) {
				other.classList.remove("is-shown");
				other.setAttribute("aria-hidden", "true");
			}
			front = img;
			back = other;
			warmNext(index, count);
		}
		if (reducedMotion() || !front.getAttribute("src")) {
			commit(front);
			return;
		}
		var pre = new Image();
		pre.onload = pre.onerror = function () {
			commit(back || front);
		};
		pre.src = item.src;
	}

	var player = createPlayer({
		playlist: function () {
			return photos;
		},
		onSlide: function (item, index, count) {
			showPhoto(item, index, count);
		},
		onClock: function (text) {
			if (timeEl) {
				timeEl.textContent = text.time;
			}
			if (dateEl) {
				dateEl.textContent = text.date;
			}
		}
	});

	player.start();
	root.addEventListener("pagehide", function () {
		player.stop();
	});
})(typeof globalThis !== "undefined" ? globalThis : this);
