// Full-screen photo frame for the gallery. The clock is the device's
// current local time, not the photo's taken date. One controller owns
// the clock, slideshow, and idle timers so they cannot stack.
(function (root) {
	var SLIDE_MS = 10000;
	var IDLE_MS = 4500;

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

	function hashSlug(href) {
		var value = href == null ? "" : String(href);
		var cut = value.indexOf("#");
		if (cut < 0) {
			return "";
		}
		var slug = value.slice(cut + 1);
		try {
			slug = decodeURIComponent(slug);
		} catch (err) {}
		return slug;
	}

	function selectPlaylist(sets) {
		var chosen = null;
		var i;
		sets = sets || [];
		for (i = 0; i < sets.length; i++) {
			if (sets[i] && sets[i].visible) {
				chosen = sets[i];
				break;
			}
		}
		if (!chosen) {
			for (i = 0; i < sets.length; i++) {
				if (sets[i] && sets[i].id === "gallery-all") {
					chosen = sets[i];
					break;
				}
			}
		}
		if (!chosen) {
			return [];
		}
		var links = chosen.links || [];
		var out = [];
		for (i = 0; i < links.length; i++) {
			var link = links[i];
			if (!link || !link.full) {
				continue;
			}
			out.push({
				src: link.full,
				slug: hashSlug(link.href || ""),
				alt: link.alt || link.title || ""
			});
		}
		return out;
	}

	function findHashIndex(items, hash) {
		var id = hashSlug(hash || "");
		if (!id) {
			return -1;
		}
		items = items || [];
		for (var i = 0; i < items.length; i++) {
			if (items[i] && items[i].slug === id) {
				return i;
			}
		}
		return -1;
	}

	function shouldSetHash(hasPhotoStack, openedOnPhoto, currentHash, slug) {
		if (!hasPhotoStack || !openedOnPhoto || !slug) {
			return false;
		}
		return hashSlug(currentHash || "") !== slug;
	}

	function activeAlbumId(tagTargetId, dataFrom) {
		if (tagTargetId) {
			return String(tagTargetId);
		}
		var from = String(dataFrom || "").replace(/[^a-z0-9-]/gi, "");
		return from || "gallery";
	}

	function createController(opts) {
		opts = opts || {};
		var slideMs = opts.slideMs || SLIDE_MS;
		var idleMs = opts.idleMs || IDLE_MS;
		var now = opts.now || function () { return new Date(); };
		var locales = opts.locales;
		var playlist = opts.playlist || function () { return []; };
		var onSlide = opts.onSlide || function () {};
		var onClock = opts.onClock || function () {};
		var onIdle = opts.onIdle || function () {};
		var onPause = opts.onPause || function () {};
		var onOpenChange = opts.onOpenChange || function () {};
		var exitFullscreen = opts.exitFullscreen || function () {};
		var setIntervalFn = opts.setInterval || setInterval;
		var clearIntervalFn = opts.clearInterval || clearInterval;
		var setTimeoutFn = opts.setTimeout || setTimeout;
		var clearTimeoutFn = opts.clearTimeout || clearTimeout;
		var timers = { clock: 0, slide: 0, idle: 0 };
		var seq = { clock: 0, slide: 0, idle: 0 };
		var items = [];
		var lastClock = "";
		var state = {
			open: false,
			index: 0,
			paused: false,
			idle: false,
			usingFullscreen: false
		};

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

		function emitSlide() {
			if (!items.length) {
				onSlide(null, 0, 0);
				return;
			}
			if (state.index < 0 || state.index >= items.length) {
				state.index = 0;
			}
			onSlide(items[state.index], state.index, items.length);
		}

		function armSlide() {
			clearNamed("slide");
			if (!state.open || state.paused || items.length < 2) {
				return;
			}
			var token = seq.slide;
			timers.slide = setTimeoutFn(function () {
				if (token !== seq.slide || !state.open || state.paused || items.length < 2) {
					return;
				}
				timers.slide = 0;
				state.index = stepIndex(state.index, 1, items.length);
				emitSlide();
				armSlide();
			}, slideMs);
		}

		function tickClock() {
			var text = formatClock(now(), locales);
			var key = text.time + "\n" + text.date;
			if (key === lastClock) {
				return;
			}
			lastClock = key;
			onClock(text);
		}

		function armClock() {
			clearNamed("clock");
			lastClock = "";
			tickClock();
			timers.clock = setIntervalFn(tickClock, 1000);
		}

		function armIdle() {
			clearNamed("idle");
			if (!state.open) {
				return;
			}
			var token = seq.idle;
			timers.idle = setTimeoutFn(function () {
				if (token !== seq.idle || !state.open) {
					return;
				}
				timers.idle = 0;
				if (opts.idleBlocked && opts.idleBlocked()) {
					armIdle();
					return;
				}
				state.idle = true;
				onIdle(true);
			}, idleMs);
		}

		function poke() {
			if (!state.open) {
				return;
			}
			state.idle = false;
			onIdle(false);
			armIdle();
		}

		function open(startIndex) {
			if (state.open) {
				return state;
			}
			items = (playlist() || []).slice();
			state.open = true;
			state.paused = false;
			state.idle = false;
			state.usingFullscreen = false;
			state.index = 0;
			if (typeof startIndex === "number" && startIndex >= 0 && startIndex < items.length) {
				state.index = startIndex;
			}
			onOpenChange(true);
			onPause(false);
			emitSlide();
			armClock();
			armIdle();
			armSlide();
			return state;
		}

		function close() {
			if (!state.open) {
				return;
			}
			state.open = false;
			clearNamed("clock");
			clearNamed("slide");
			clearNamed("idle");
			state.idle = false;
			var shouldExit = state.usingFullscreen;
			state.usingFullscreen = false;
			onOpenChange(false);
			if (shouldExit) {
				exitFullscreen();
			}
		}

		function noteFullscreen(on) {
			if (!state.open) {
				return;
			}
			state.usingFullscreen = !!on;
		}

		function onFullscreenExit() {
			if (!state.open || !state.usingFullscreen) {
				return;
			}
			state.usingFullscreen = false;
			close();
		}

		function togglePause() {
			if (!state.open) {
				return state.paused;
			}
			state.paused = !state.paused;
			if (state.paused) {
				clearNamed("slide");
			} else {
				armSlide();
			}
			onPause(state.paused);
			poke();
			return state.paused;
		}

		function go(delta) {
			if (!state.open) {
				return;
			}
			if (items.length >= 2) {
				state.index = stepIndex(state.index, delta, items.length);
				emitSlide();
				if (!state.paused) {
					armSlide();
				}
			}
			poke();
		}

		return {
			open: open,
			close: close,
			togglePause: togglePause,
			go: go,
			poke: poke,
			noteFullscreen: noteFullscreen,
			onFullscreenExit: onFullscreenExit,
			state: state,
			current: function () {
				return items.length ? items[state.index] : null;
			}
		};
	}

	var api = {
		SLIDE_MS: SLIDE_MS,
		IDLE_MS: IDLE_MS,
		stepIndex: stepIndex,
		formatClock: formatClock,
		hashSlug: hashSlug,
		selectPlaylist: selectPlaylist,
		findHashIndex: findHashIndex,
		shouldSetHash: shouldSetHash,
		activeAlbumId: activeAlbumId,
		createController: createController
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = api;
	}

	if (typeof document === "undefined" || root.galleryDisplay) {
		return;
	}

	var doc = document;
	var win = root;
	var ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 6L8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
	var ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
	var ICON_PAUSE = '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6v12M16 6v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
	var ICON_PLAY = '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6.5v11l9-5.5-9-5.5z" fill="currentColor"></path></svg>';
	var ICON_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';

	var frame = doc.createElement("div");
	frame.className = "gallery-frame";
	frame.id = "gallery-frame";
	frame.setAttribute("role", "dialog");
	frame.setAttribute("aria-modal", "true");
	frame.setAttribute("aria-label", "Photo display");
	frame.tabIndex = -1;
	frame.hidden = true;
	frame.innerHTML = '<div class="gallery-frame-stage"><img class="gallery-frame-photo is-shown" alt="" draggable="false"><img class="gallery-frame-photo" alt="" draggable="false" aria-hidden="true"></div><p class="gallery-frame-empty" hidden>No photos to display</p><div class="gallery-frame-clock"><div class="gallery-frame-time"></div><div class="gallery-frame-date"></div></div><div class="gallery-frame-controls" role="toolbar" aria-label="Display controls"><button type="button" data-frame-act="prev" aria-label="Previous photo">' + ICON_PREV + '</button><button type="button" class="gallery-frame-pause" data-frame-act="pause" aria-pressed="false" aria-label="Pause slideshow">' + ICON_PAUSE + ICON_PLAY + '</button><button type="button" data-frame-act="next" aria-label="Next photo">' + ICON_NEXT + '</button><button type="button" data-frame-act="exit" aria-label="Exit display">' + ICON_EXIT + '</button></div>';
	doc.body.appendChild(frame);

	var photos = frame.querySelectorAll(".gallery-frame-photo");
	var front = photos[0];
	var back = photos[1];
	var empty = frame.querySelector(".gallery-frame-empty");
	var timeEl = frame.querySelector(".gallery-frame-time");
	var dateEl = frame.querySelector(".gallery-frame-date");
	var controls = frame.querySelector(".gallery-frame-controls");
	var pauseBtn = frame.querySelector(".gallery-frame-pause");
	var prevBtn = controls.querySelector('[data-frame-act="prev"]');
	var nextBtn = controls.querySelector('[data-frame-act="next"]');
	var playlistItems = [];
	var generation = 0;
	var keyboardNav = false;
	var openedOnPhoto = false;
	var returnFocus = null;
	var swipe = null;

	function reducedMotion() {
		try {
			return !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
		} catch (err) {
			return false;
		}
	}

	function fullscreenElement() {
		return doc.fullscreenElement || doc.webkitFullscreenElement || null;
	}

	function requestFrameFullscreen(el) {
		var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
		var target = el;
		if (!req && doc.documentElement) {
			target = doc.documentElement;
			req = target.requestFullscreen || target.webkitRequestFullscreen || target.webkitRequestFullScreen;
		}
		if (!req) {
			return Promise.resolve(false);
		}
		try {
			var result = req.call(target);
			if (result && typeof result.then === "function") {
				return result.then(function () { return true; }, function () { return false; });
			}
			return Promise.resolve(true);
		} catch (err) {
			return Promise.resolve(false);
		}
	}

	function exitFrameFullscreen() {
		if (!fullscreenElement()) {
			return;
		}
		var exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.webkitCancelFullScreen;
		if (!exit) {
			return;
		}
		try {
			var pending = exit.call(doc);
			if (pending && typeof pending.catch === "function") {
				pending.catch(function () {});
			}
		} catch (err) {}
	}

	function warmNext(index, count) {
		if (count < 2) {
			return;
		}
		var next = playlistItems[stepIndex(index, 1, count)];
		if (!next || !next.src) {
			return;
		}
		var img = new Image();
		img.src = next.src;
	}

	function showPhoto(item, index, count) {
		var single = !count || count < 2;
		prevBtn.disabled = single;
		nextBtn.disabled = single;
		generation += 1;
		var gen = generation;
		if (!item) {
			front.classList.remove("is-shown");
			back.classList.remove("is-shown");
			front.removeAttribute("src");
			back.removeAttribute("src");
			front.setAttribute("aria-hidden", "true");
			back.setAttribute("aria-hidden", "true");
			front.alt = "";
			empty.hidden = false;
			return;
		}
		empty.hidden = true;
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
			other.classList.remove("is-shown");
			other.setAttribute("aria-hidden", "true");
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
			commit(back);
		};
		pre.src = item.src;
	}

	function focusReturn() {
		var backFocus = returnFocus;
		returnFocus = null;
		if (backFocus && typeof backFocus.focus === "function") {
			var visible = false;
			try {
				visible = !!(backFocus.offsetParent || (backFocus.getClientRects && backFocus.getClientRects().length));
			} catch (err) {}
			if (visible) {
				try {
					backFocus.focus();
					return;
				} catch (err2) {}
			}
		}
		var entries = doc.querySelectorAll(".gallery-display-entry");
		for (var i = 0; i < entries.length; i++) {
			if (entries[i].offsetParent) {
				try {
					entries[i].focus();
				} catch (err3) {}
				return;
			}
		}
	}

	function dismissLightbox() {
		var box = doc.querySelector(".photo-lightbox.is-open");
		if (!box) {
			return;
		}
		box.classList.remove("is-open", "is-zoomed", "is-panning", "is-pinching", "is-anim");
		if (doc.body) {
			doc.body.classList.remove("photo-lightbox-open");
		}
		var lightImg = box.querySelector("img");
		if (lightImg) {
			lightImg.style.transform = "";
		}
	}

	var controller = createController({
		playlist: function () {
			return playlistItems;
		},
		onSlide: function (item, index, count) {
			showPhoto(item, index, count);
		},
		onClock: function (text) {
			timeEl.textContent = text.time;
			dateEl.textContent = text.date;
		},
		onIdle: function (idle) {
			frame.classList.toggle("is-idle", !!idle);
		},
		onPause: function (paused) {
			pauseBtn.classList.toggle("is-paused", !!paused);
			pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
			pauseBtn.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow");
		},
		onOpenChange: function (isOpen) {
			if (isOpen) {
				frame.hidden = false;
				doc.body.classList.add("gallery-frame-open");
				frame.classList.remove("is-idle", "is-fallback");
				return;
			}
			var item = controller.current();
			frame.hidden = true;
			frame.classList.remove("is-idle", "is-fallback");
			doc.body.classList.remove("gallery-frame-open");
			if (item && shouldSetHash(!!doc.getElementById("photo-stack"), openedOnPhoto, win.location.hash, item.slug)) {
				win.location.hash = item.slug;
			}
			focusReturn();
		},
		exitFullscreen: exitFrameFullscreen,
		idleBlocked: function () {
			return keyboardNav && controls.contains(doc.activeElement);
		}
	});

	function playlistFromDocument() {
		var sets = doc.querySelectorAll(".gallery-set");
		var tagTarget = doc.querySelector(".tag-anchor:target");
		var wanted = activeAlbumId(tagTarget && tagTarget.id, doc.documentElement.getAttribute("data-from"));
		var plain = [];
		for (var i = 0; i < sets.length; i++) {
			var set = sets[i];
			var links = set.querySelectorAll("a[href]");
			var items = [];
			for (var j = 0; j < links.length; j++) {
				var link = links[j];
				var full = link.getAttribute("data-full") || "";
				if (!full) {
					continue;
				}
				var href = link.getAttribute("href") || "";
				var slug = hashSlug(href);
				var alt = "";
				if (slug) {
					var sheetImg = doc.querySelector('.photo-sheet[data-slug="' + slug.replace(/"/g, "") + '"] img');
					if (sheetImg) {
						alt = sheetImg.getAttribute("alt") || "";
					}
				}
				items.push({
					full: full,
					href: href,
					alt: alt,
					title: link.getAttribute("title") || ""
				});
			}
			plain.push({
				id: set.id || "",
				visible: (set.getAttribute("data-tag") || "") === wanted,
				links: items
			});
		}
		return selectPlaylist(plain);
	}

	function openFromGesture() {
		if (controller.state.open) {
			return;
		}
		playlistItems = playlistFromDocument();
		var found = findHashIndex(playlistItems, win.location.hash);
		openedOnPhoto = found >= 0;
		returnFocus = doc.activeElement;
		keyboardNav = false;
		dismissLightbox();
		frame.hidden = false;
		var pending = requestFrameFullscreen(frame);
		controller.open(found >= 0 ? found : 0);
		pending.then(function (ok) {
			if (!controller.state.open) {
				return;
			}
			if (ok && fullscreenElement()) {
				controller.noteFullscreen(true);
				frame.classList.remove("is-fallback");
			} else {
				frame.classList.add("is-fallback");
			}
		});
		try {
			frame.focus({ preventScroll: true });
		} catch (err) {
			try {
				frame.focus();
			} catch (err2) {}
		}
	}

	var entries = doc.querySelectorAll(".gallery-display-entry");
	for (var e = 0; e < entries.length; e++) {
		entries[e].addEventListener("click", openFromGesture);
	}

	controls.addEventListener("click", function (event) {
		var btn = event.target.closest ? event.target.closest("[data-frame-act]") : null;
		if (!btn || btn.disabled || !controller.state.open) {
			return;
		}
		var act = btn.getAttribute("data-frame-act");
		if (act === "prev") {
			controller.go(-1);
		} else if (act === "next") {
			controller.go(1);
		} else if (act === "pause") {
			controller.togglePause();
		} else if (act === "exit") {
			controller.close();
		}
	});

	frame.addEventListener("pointerdown", function (event) {
		if (!controller.state.open) {
			return;
		}
		keyboardNav = false;
		controller.poke();
		if (event.target.closest && event.target.closest(".gallery-frame-controls")) {
			return;
		}
		if (event.pointerType === "mouse" && event.button !== 0) {
			return;
		}
		swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
	});

	frame.addEventListener("pointerup", function (event) {
		if (!swipe || swipe.id !== event.pointerId) {
			return;
		}
		var dx = event.clientX - swipe.x;
		var dy = event.clientY - swipe.y;
		swipe = null;
		if (!controller.state.open) {
			return;
		}
		if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) {
			return;
		}
		controller.go(dx < 0 ? 1 : -1);
	});

	frame.addEventListener("pointercancel", function () {
		swipe = null;
	});

	frame.addEventListener("pointermove", function (event) {
		if (!controller.state.open || event.pointerType === "touch") {
			return;
		}
		controller.poke();
	});

	frame.addEventListener("dragstart", function (event) {
		event.preventDefault();
	});

	doc.addEventListener("keydown", function (event) {
		if (!controller.state.open) {
			return;
		}
		keyboardNav = true;
		var key = event.key || "";
		if (key === "Escape" || event.keyCode === 27) {
			event.preventDefault();
			event.stopPropagation();
			controller.close();
			return;
		}
		if (key === "ArrowLeft" || event.keyCode === 37) {
			event.preventDefault();
			event.stopPropagation();
			controller.go(-1);
			return;
		}
		if (key === "ArrowRight" || event.keyCode === 39) {
			event.preventDefault();
			event.stopPropagation();
			controller.go(1);
			return;
		}
		if (key === "Tab") {
			var buttons = controls.querySelectorAll("button:not(:disabled)");
			var first = buttons[0];
			var last = buttons[buttons.length - 1];
			var active = doc.activeElement;
			if (!buttons.length) {
				event.preventDefault();
				frame.focus();
			} else if (event.shiftKey && (active === first || active === frame || !controls.contains(active))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
			controller.poke();
			return;
		}
		if (key === " " || key === "Spacebar" || event.keyCode === 32) {
			var onControl = event.target && event.target.closest && event.target.closest(".gallery-frame-controls button");
			if (onControl) {
				controller.poke();
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			controller.togglePause();
			return;
		}
		controller.poke();
	}, true);

	function onFullscreenChange() {
		if (!controller.state.open) {
			return;
		}
		if (fullscreenElement()) {
			controller.noteFullscreen(true);
			frame.classList.remove("is-fallback");
			return;
		}
		controller.onFullscreenExit();
	}
	function onFullscreenError() {
		if (!controller.state.open) {
			return;
		}
		frame.classList.add("is-fallback");
	}
	doc.addEventListener("fullscreenchange", onFullscreenChange);
	doc.addEventListener("webkitfullscreenchange", onFullscreenChange);
	doc.addEventListener("fullscreenerror", onFullscreenError);
	doc.addEventListener("webkitfullscreenerror", onFullscreenError);

	win.addEventListener("pagehide", function () {
		controller.close();
	});

	root.galleryDisplay = {
		open: openFromGesture
	};
})(typeof globalThis !== "undefined" ? globalThis : this);
