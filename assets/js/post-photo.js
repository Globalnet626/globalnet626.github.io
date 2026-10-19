// Opens post-only photos in a window on the post. Gallery photos use /gallery/.
(function () {
	var root = document.getElementById("post-photo-viewer");
	if (!root) {
		return;
	}
	if (root.parentNode !== document.body) {
		document.body.appendChild(root);
	}

	var win = root.querySelector(".post-photo-viewer-window");
	var img = document.getElementById("post-photo-viewer-img");
	var title = document.getElementById("post-photo-viewer-title");
	var datePane = document.getElementById("post-photo-status-date");
	var cameraPane = document.getElementById("post-photo-status-camera");
	var captionPane = document.getElementById("post-photo-status-caption");
	var links = [];
	var index = 0;
	var opener = null;
	var touchX = null;

	function field(el, name) {
		var value = el.getAttribute(name) || "";
		return value.replace(/^\s+|\s+$/g, "");
	}

	function cameraDetails(el) {
		var parts = [];
		var camera = field(el, "data-camera");
		var lens = field(el, "data-lens");
		if (camera) parts.push(camera);
		if (lens && lens.toLowerCase() !== camera.toLowerCase()) parts.push(lens);
		var fstop = field(el, "data-fstop");
		if (fstop) parts.push(fstop.slice(0, 2).toLowerCase() === "f/" ? fstop : "f/" + fstop);
		var iso = field(el, "data-iso");
		if (iso) parts.push(iso.toLowerCase().indexOf("iso") === 0 ? iso : "ISO " + iso);
		var shutter = field(el, "data-shutter");
		if (shutter) {
			if (shutter.slice(-1).toLowerCase() !== "s") shutter += "s";
			parts.push(shutter);
		}
		var focal = field(el, "data-focal");
		if (focal) {
			if (focal.slice(-2).toLowerCase() !== "mm") focal += "mm";
			parts.push(focal);
		}
		return parts.join(" · ");
	}

	function collect() {
		links = [].slice.call(document.querySelectorAll("a.post-photo-open"));
	}

	function closeMenus() {
		var open = root.querySelectorAll(".photo-menu.is-open");
		for (var i = 0; i < open.length; i++) {
			open[i].classList.remove("is-open");
			var button = open[i].querySelector("button[aria-expanded]");
			if (button) button.setAttribute("aria-expanded", "false");
		}
	}

	function show(next) {
		collect();
		if (!links.length) {
			return;
		}
		index = (next + links.length) % links.length;
		var el = links[index];
		var caption = field(el, "data-caption") || "Photo";
		var label = caption;
		if (links.length) {
			label += " (" + (index + 1) + "/" + links.length + ")";
		}
		title.textContent = label;
		img.alt = field(el, "data-alt") || caption;
		img.src = field(el, "data-full") || el.getAttribute("href");
		datePane.textContent = "Date: " + field(el, "data-date");
		cameraPane.textContent = "Camera: " + cameraDetails(el);
		captionPane.textContent = caption;
		root.classList.add("is-open");
		root.setAttribute("aria-hidden", "false");
		document.body.classList.add("post-photo-viewer-open");
		var closeBtn = root.querySelector('[data-act="close"]');
		if (closeBtn) closeBtn.focus();
	}

	function closeViewer() {
		closeMenus();
		root.classList.remove("is-open");
		root.setAttribute("aria-hidden", "true");
		win.classList.remove("is-max");
		document.body.classList.remove("post-photo-viewer-open");
		img.removeAttribute("src");
		if (opener && opener.focus) opener.focus();
	}

	document.addEventListener("click", function (event) {
		var link = event.target.closest ? event.target.closest("a.post-photo-open") : null;
		if (link) {
			event.preventDefault();
			opener = link;
			collect();
			var found = links.indexOf(link);
			show(found < 0 ? 0 : found);
			return;
		}
		if (!root.classList.contains("is-open")) {
			return;
		}
		if (event.target === root) {
			closeViewer();
			return;
		}
		var menuBtn = event.target.closest ? event.target.closest(".photo-menu > button[aria-haspopup]") : null;
		if (menuBtn && root.contains(menuBtn)) {
			var menu = menuBtn.parentNode;
			var willOpen = !menu.classList.contains("is-open");
			closeMenus();
			if (willOpen) {
				menu.classList.add("is-open");
				menuBtn.setAttribute("aria-expanded", "true");
			}
			return;
		}
		var actEl = event.target.closest ? event.target.closest("#post-photo-viewer [data-act]") : null;
		if (!actEl) {
			if (!event.target.closest || !event.target.closest(".photo-menu")) closeMenus();
			return;
		}
		var act = actEl.getAttribute("data-act");
		closeMenus();
		if (act === "close" || act === "min") closeViewer();
		else if (act === "max") win.classList.toggle("is-max");
		else if (act === "original") window.location = img.getAttribute("src") || (opener && opener.getAttribute("href")) || "";
		else if (act === "prev") show(index - 1);
		else if (act === "next") show(index + 1);
	});

	document.addEventListener("keydown", function (event) {
		if (!root.classList.contains("is-open")) {
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			closeViewer();
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			show(index - 1);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			show(index + 1);
		}
	});

	root.addEventListener("touchstart", function (event) {
		if (event.touches.length === 1) touchX = event.touches[0].clientX;
	}, { passive: true });

	root.addEventListener("touchend", function (event) {
		if (touchX == null || !event.changedTouches.length) return;
		var dx = event.changedTouches[0].clientX - touchX;
		touchX = null;
		if (Math.abs(dx) < 50) return;
		show(index + (dx < 0 ? 1 : -1));
	}, { passive: true });
})();
