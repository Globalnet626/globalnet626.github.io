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
	}

	function pinTop() {
		window.scrollTo(0, 0);
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
	lightbox.innerHTML = '<button type="button" class="photo-lightbox-close" aria-label="Close"><span class="fa fa-times"></span></button><img alt="">';
	document.body.appendChild(lightbox);
	var lightImg = lightbox.querySelector("img");
	var closeBtn = lightbox.querySelector("button");

	function openLight(src, alt) {
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

	stack.addEventListener("click", function (event) {
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

	closeBtn.addEventListener("click", function (event) {
		event.stopPropagation();
		closeLight();
	});

	lightbox.addEventListener("click", function (event) {
		if (event.target === lightbox) {
			closeLight();
		}
	});

	document.addEventListener("keydown", function (event) {
		if ((event.key === "Escape" || event.keyCode === 27) && lightbox.classList.contains("is-open")) {
			closeLight();
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
