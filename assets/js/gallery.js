// Sets the document-window title from the open gallery photo.
(function () {
	var stack = document.getElementById("photo-stack");
	var heading = document.getElementById("photo-window-title");
	if (!stack || !heading) {
		return;
	}

	function currentSheet() {
		var id = window.location.hash.replace(/^#/, "");
		if (!id) {
			return null;
		}
		return stack.querySelector('.photo-sheet[data-slug="' + id.replace(/"/g, "") + '"]');
	}

	var countEl = document.getElementById("photo-count");
	var pinUntil = 0;
	var pinTimer = 0;
	var preloaded = {};

	function hashId() {
		var id = window.location.hash.replace(/^#/, "");
		try {
			id = decodeURIComponent(id);
		} catch (err) {}
		return id;
	}

	function folderItems() {
		var from = document.documentElement.getAttribute("data-from") || "gallery";
		var safe = from.replace(/[^a-z0-9-]/gi, "");
		var set = document.querySelector('.gallery-set[data-tag="' + safe + '"]') || document.getElementById("gallery-all");
		if (!set) {
			return [];
		}
		var links = set.querySelectorAll("a[href]");
		var items = [];
		for (var i = 0; i < links.length; i++) {
			var href = links[i].getAttribute("href") || "";
			var cut = href.indexOf("#");
			if (cut < 0) {
				continue;
			}
			var slug = href.slice(cut + 1);
			try {
				slug = decodeURIComponent(slug);
			} catch (err) {}
			items.push({ slug: slug, link: links[i] });
		}
		return items;
	}

	function preload(src) {
		if (!src || preloaded[src]) {
			return;
		}
		var im = new Image();
		im.src = src;
		preloaded[src] = im;
	}

	function markSelected(slug) {
		var links = document.querySelectorAll(".post_list_gallery .gallery-set a[href]");
		var chosen = null;
		for (var i = 0; i < links.length; i++) {
			var href = links[i].getAttribute("href") || "";
			var cut = href.indexOf("#");
			var id = cut < 0 ? "" : href.slice(cut + 1);
			try {
				id = decodeURIComponent(id);
			} catch (err) {}
			var on = id === slug;
			links[i].classList.toggle("is-selected", on);
			if (on) {
				links[i].setAttribute("aria-current", "true");
			} else {
				links[i].removeAttribute("aria-current");
			}
			if (on && links[i].offsetParent) {
				chosen = links[i];
			}
		}
		if (!chosen) {
			return;
		}
		var pane = chosen.closest(".post_list");
		if (!pane) {
			return;
		}
		var linkRect = chosen.getBoundingClientRect();
		var paneRect = pane.getBoundingClientRect();
		if (linkRect.top < paneRect.top) {
			pane.scrollTop -= paneRect.top - linkRect.top;
		} else if (linkRect.bottom > paneRect.bottom) {
			pane.scrollTop += linkRect.bottom - paneRect.bottom;
		}
	}

	function show() {
		var sheet = currentSheet();
		if (!sheet) {
			return;
		}
		var caption = sheet.getAttribute("data-caption") || "gallery";
		heading.textContent = caption;
		document.title = caption;
		var img = sheet.querySelector("img.js-photo");
		if (img) {
			var full = img.getAttribute("data-src");
			if (full && img.getAttribute("src") !== full) {
				img.src = full;
			}
		}
		var items = folderItems();
		var id = sheet.getAttribute("data-slug") || hashId();
		var idx = 0;
		for (var i = 0; i < items.length; i++) {
			if (items[i].slug === id) {
				idx = i;
				break;
			}
		}
		if (countEl && items.length) {
			countEl.textContent = (idx + 1) + " of " + items.length;
		}
		markSelected(id);
		if (items.length) {
			var prev = items[(idx - 1 + items.length) % items.length];
			var next = items[(idx + 1) % items.length];
			[prev, next].forEach(function (item) {
				var neighbor = stack.querySelector('.photo-sheet[data-slug="' + item.slug.replace(/"/g, "") + '"]');
				var neighborImg = neighbor && neighbor.querySelector("img.js-photo");
				if (neighborImg) {
					preload(neighborImg.getAttribute("data-src"));
				}
			});
		}
		if (img && lightbox.classList.contains("is-open")) {
			var src = img.getAttribute("src") || img.getAttribute("data-src");
			if (src) {
				resetZoom(false);
				lightImg.src = src;
				lightImg.alt = img.getAttribute("alt") || "";
			}
		}
	}

	function step(delta) {
		var items = folderItems();
		if (!items.length || !currentSheet()) {
			return;
		}
		var id = hashId();
		var idx = 0;
		for (var i = 0; i < items.length; i++) {
			if (items[i].slug === id) {
				idx = i;
				break;
			}
		}
		var next = (idx + delta) % items.length;
		if (next < 0) {
			next += items.length;
		}
		if (items[next].slug === id) {
			return;
		}
		window.location.hash = items[next].slug;
	}

	function pinTop() {
		if (!window.location.hash) {
			return;
		}
		pinUntil = Date.now() + 800;
		window.scrollTo(0, 0);
		if (pinTimer) {
			return;
		}
		pinTimer = setInterval(function () {
			if (Date.now() > pinUntil) {
				clearInterval(pinTimer);
				pinTimer = 0;
				return;
			}
			if (window.scrollY !== 0) {
				window.scrollTo(0, 0);
			}
		}, 40);
	}

	if ("scrollRestoration" in window.history) {
		window.history.scrollRestoration = "manual";
	}

	function clickedPhoto(node) {
		while (node && node !== stack) {
			if (node.classList && node.classList.contains("js-photo")) {
				return node;
			}
			node = node.parentNode;
		}
		return null;
	}

	var lightbox = document.createElement("div");
	lightbox.className = "photo-lightbox";
	lightbox.innerHTML = '<button type="button" class="photo-lightbox-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg></button><img alt="" draggable="false">';
	document.body.appendChild(lightbox);
	var lightImg = lightbox.querySelector("img");
	var closeBtn = lightbox.querySelector("button");
	var pointers = {};
	var startedOnPhoto = false;
	var scale = 1;
	var tx = 0;
	var ty = 0;
	var mode = "none";
	var dragMoved = false;
	var pinch = null;
	var panOrigin = null;
	var lastTap = null;
	var suppressClick = false;
	var animTimer = 0;
	var DRAG_PX = 6;
	var TAP_MS = 300;
	var TAP_PX = 28;

	function allowsClickZoom(pointerType) {
		// Touch taps must not toggle zoom. A mouse or pen is a fine pointer
		// even when the primary device media query says otherwise.
		if (pointerType === "mouse" || pointerType === "pen") {
			return true;
		}
		if (pointerType === "touch") {
			return false;
		}
		return window.matchMedia("(hover: hover), (pointer: fine)").matches;
	}

	function clamp(nextScale, x, y) {
		var visW = lightImg.offsetWidth * nextScale;
		var visH = lightImg.offsetHeight * nextScale;
		var vw = lightbox.clientWidth;
		var vh = lightbox.clientHeight;
		if (!lightImg.offsetWidth || visW <= vw + 0.5) {
			x = 0;
		} else {
			var maxX = (visW - vw) / 2;
			if (x > maxX) x = maxX;
			if (x < -maxX) x = -maxX;
		}
		if (!lightImg.offsetHeight || visH <= vh + 0.5) {
			y = 0;
		} else {
			var maxY = (visH - vh) / 2;
			if (y > maxY) y = maxY;
			if (y < -maxY) y = -maxY;
		}
		return { x: x, y: y };
	}

	function applyTransform(animate) {
		if (animate) {
			lightbox.classList.add("is-anim");
			clearTimeout(animTimer);
			animTimer = setTimeout(function () {
				lightbox.classList.remove("is-anim");
			}, 200);
		} else if (lightbox.classList.contains("is-anim")) {
			lightbox.classList.remove("is-anim");
		}
		if (scale === 1 && tx === 0 && ty === 0) {
			lightImg.style.transform = "";
		} else {
			lightImg.style.transform = "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";
		}
		lightbox.classList.toggle("is-zoomed", scale > 1.01);
	}

	function resetZoom(animate) {
		scale = 1;
		tx = 0;
		ty = 0;
		mode = "none";
		pinch = null;
		lightbox.classList.remove("is-panning", "is-pinching");
		applyTransform(animate);
	}

	function zoomAt(clientX, clientY) {
		if (!lightImg.offsetWidth || !lightImg.offsetHeight) {
			return;
		}
		var dx = clientX - lightbox.clientWidth / 2;
		var dy = clientY - lightbox.clientHeight / 2;
		scale = 2;
		var next = clamp(scale, -dx * 2, -dy * 2);
		tx = next.x;
		ty = next.y;
		applyTransform(true);
	}

	function pointerIds() {
		var ids = [];
		for (var id in pointers) {
			if (Object.prototype.hasOwnProperty.call(pointers, id)) {
				ids.push(id);
			}
		}
		return ids;
	}

	function armSuppress() {
		suppressClick = true;
		setTimeout(function () {
			suppressClick = false;
		}, 400);
	}

	function onPointerDown(event) {
		if (closeBtn.contains(event.target)) {
			return;
		}
		if (event.pointerType === "mouse" && event.button !== 0) {
			return;
		}
		var active = pointerIds().length;
		if (event.target !== lightImg && active === 0) {
			return;
		}
		if (active === 0) {
			startedOnPhoto = event.target === lightImg;
		}
		if (event.pointerType === "touch") {
			event.preventDefault();
		}
		pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
		armSuppress();
		try {
			lightbox.setPointerCapture(event.pointerId);
		} catch (err) {}
		var ids = pointerIds();
		if (ids.length >= 2) {
			mode = "pinch";
			dragMoved = true;
			lastTap = null;
			var a = pointers[ids[0]];
			var b = pointers[ids[1]];
			pinch = {
				dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
				scale: scale,
				tx: tx,
				ty: ty,
				midX: (a.x + b.x) / 2,
				midY: (a.y + b.y) / 2
			};
			lightbox.classList.add("is-pinching");
			lightbox.classList.remove("is-anim", "is-panning");
			return;
		}
		mode = "down";
		dragMoved = false;
		panOrigin = { x: event.clientX, y: event.clientY, tx: tx, ty: ty };
	}

	function onPointerMove(event) {
		if (!pointers[event.pointerId]) {
			return;
		}
		pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
		if (mode === "pinch" && pinch) {
			event.preventDefault();
			var ids = pointerIds();
			if (ids.length < 2) {
				return;
			}
			var a = pointers[ids[0]];
			var b = pointers[ids[1]];
			var dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
			var midX = (a.x + b.x) / 2;
			var midY = (a.y + b.y) / 2;
			var nextScale = pinch.scale * (dist / pinch.dist);
			if (nextScale < 1) nextScale = 1;
			if (nextScale > 4) nextScale = 4;
			var cx = lightbox.clientWidth / 2;
			var cy = lightbox.clientHeight / 2;
			var s0 = pinch.scale || 1;
			var lx = (pinch.midX - cx - pinch.tx) / s0;
			var ly = (pinch.midY - cy - pinch.ty) / s0;
			var next = clamp(nextScale, midX - cx - lx * nextScale, midY - cy - ly * nextScale);
			scale = nextScale;
			tx = next.x;
			ty = next.y;
			applyTransform(false);
			return;
		}
		if (!panOrigin) {
			return;
		}
		var dx = event.clientX - panOrigin.x;
		var dy = event.clientY - panOrigin.y;
		if (!dragMoved && dx * dx + dy * dy > DRAG_PX * DRAG_PX) {
			dragMoved = true;
			if (scale > 1.01) {
				mode = "pan";
				lightbox.classList.add("is-panning");
				lightbox.classList.remove("is-anim");
			}
		}
		if (mode === "pan") {
			event.preventDefault();
			var moved = clamp(scale, panOrigin.tx + dx, panOrigin.ty + dy);
			tx = moved.x;
			ty = moved.y;
			applyTransform(false);
		}
	}

	function onPointerUp(event) {
		if (!pointers[event.pointerId]) {
			return;
		}
		delete pointers[event.pointerId];
		var ids = pointerIds();
		if (mode === "pinch") {
			lightbox.classList.remove("is-pinching");
			if (scale <= 1.01) {
				resetZoom(true);
			}
			if (ids.length >= 1) {
				var stay = pointers[ids[0]];
				panOrigin = { x: stay.x, y: stay.y, tx: tx, ty: ty };
				dragMoved = true;
				mode = scale > 1.01 ? "pan" : "down";
				if (mode === "pan") {
					lightbox.classList.add("is-panning");
				}
			} else {
				mode = "none";
				pinch = null;
				startedOnPhoto = false;
			}
			return;
		}
		if (ids.length > 0) {
			return;
		}
		var wasDrag = dragMoved;
		var pointerType = event.pointerType;
		var x = event.clientX;
		var y = event.clientY;
		var dx = panOrigin ? event.clientX - panOrigin.x : 0;
		var dy = panOrigin ? event.clientY - panOrigin.y : 0;
		var photoGesture = startedOnPhoto;
		startedOnPhoto = false;
		mode = "none";
		pinch = null;
		panOrigin = null;
		dragMoved = false;
		lightbox.classList.remove("is-panning");
		if (wasDrag || !photoGesture) {
			if (wasDrag && pointerType === "touch" && scale <= 1.01 && Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.2) {
				step(dx < 0 ? 1 : -1);
			}
			return;
		}
		if (!allowsClickZoom(pointerType)) {
			var now = Date.now();
			if (lastTap && now - lastTap.t < TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < TAP_PX) {
				if (scale > 1.01) {
					resetZoom(true);
				}
				lastTap = null;
			} else {
				lastTap = { t: now, x: x, y: y };
			}
			return;
		}
		if (scale > 1.01) {
			resetZoom(true);
		} else {
			zoomAt(x, y);
		}
	}

	function openLight(src, alt) {
		resetZoom(false);
		lastTap = null;
		lightImg.src = src;
		lightImg.alt = alt || "";
		lightbox.classList.add("is-open");
		document.body.classList.add("photo-lightbox-open");
		var req = lightbox.requestFullscreen || lightbox.webkitRequestFullscreen;
		if (req) {
			try {
				var pending = req.call(lightbox);
				if (pending && pending.catch) {
					pending.catch(function () {});
				}
			} catch (err) {}
		}
	}

	function closeLight() {
		resetZoom(false);
		lastTap = null;
		startedOnPhoto = false;
		pointers = {};
		lightbox.classList.remove("is-open");
		document.body.classList.remove("photo-lightbox-open");
		var fs = document.fullscreenElement || document.webkitFullscreenElement;
		if (fs) {
			var exit = document.exitFullscreen || document.webkitExitFullscreen;
			if (exit) {
				exit.call(document);
			}
		}
	}

	var photoSwipe = null;
	var suppressOpen = false;

	stack.addEventListener("pointerdown", function (event) {
		if (event.pointerType !== "touch" || !clickedPhoto(event.target)) {
			return;
		}
		photoSwipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
	});

	stack.addEventListener("pointerup", function (event) {
		if (!photoSwipe || event.pointerId !== photoSwipe.id) {
			return;
		}
		var dx = event.clientX - photoSwipe.x;
		var dy = event.clientY - photoSwipe.y;
		photoSwipe = null;
		if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) {
			return;
		}
		suppressOpen = true;
		step(dx < 0 ? 1 : -1);
	});

	stack.addEventListener("pointercancel", function () {
		photoSwipe = null;
	});

	stack.addEventListener("click", function (event) {
		if (suppressOpen) {
			suppressOpen = false;
			return;
		}
		var img = clickedPhoto(event.target);
		if (!img) {
			return;
		}
		var src = img.getAttribute("src") || img.getAttribute("data-src");
		if (!src) {
			return;
		}
		openLight(src, img.getAttribute("alt"));
	});

	var prevBtn = document.getElementById("photo-prev");
	var nextBtn = document.getElementById("photo-next");
	var fullBtn = document.getElementById("photo-full");
	if (prevBtn) {
		prevBtn.addEventListener("click", function () { step(-1); });
	}
	if (nextBtn) {
		nextBtn.addEventListener("click", function () { step(1); });
	}
	if (fullBtn) {
		fullBtn.addEventListener("click", function () {
			var sheet = currentSheet();
			var img = sheet && sheet.querySelector("img.js-photo");
			if (!img) {
				return;
			}
			var src = img.getAttribute("src") || img.getAttribute("data-src");
			if (src) {
				openLight(src, img.getAttribute("alt"));
			}
		});
	}

	closeBtn.addEventListener("click", function (event) {
		event.stopPropagation();
		closeLight();
	});

	lightbox.addEventListener("click", function (event) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (event.target === lightbox) {
			closeLight();
		}
	});

	lightbox.addEventListener("pointerdown", onPointerDown);
	lightbox.addEventListener("pointermove", onPointerMove);
	lightbox.addEventListener("pointerup", onPointerUp);
	lightbox.addEventListener("pointercancel", onPointerUp);
	lightImg.addEventListener("dragstart", function (event) {
		event.preventDefault();
	});

	document.addEventListener("keydown", function (event) {
		if ((event.key === "Escape" || event.keyCode === 27) && lightbox.classList.contains("is-open")) {
			closeLight();
			return;
		}
		if (event.altKey || event.ctrlKey || event.metaKey || !currentSheet()) {
			return;
		}
		if (event.key === "ArrowLeft" || event.keyCode === 37) {
			event.preventDefault();
			step(-1);
		} else if (event.key === "ArrowRight" || event.keyCode === 39) {
			event.preventDefault();
			step(1);
		}
	});

	function onFullscreenEnd() {
		var fs = document.fullscreenElement || document.webkitFullscreenElement;
		if (!fs && lightbox.classList.contains("is-open")) {
			closeLight();
		}
	}
	document.addEventListener("fullscreenchange", onFullscreenEnd);
	document.addEventListener("webkitfullscreenchange", onFullscreenEnd);

	window.addEventListener("hashchange", function () {
		show();
		pinTop();
	});
	window.addEventListener("load", pinTop);
	show();
	pinTop();
})();
