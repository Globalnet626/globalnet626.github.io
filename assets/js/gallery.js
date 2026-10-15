// Sets the document-window title from the open gallery photo.
(function () {
	var stack = document.getElementById("photo-stack");
	var heading = document.getElementById("photo-window-title");
	if (!stack || !heading) {
		return;
	}

	function currentSheet() {
		var id = window.location.hash.replace(/^#/, "");
		if (id) {
			var targeted = stack.querySelector('.photo-sheet[data-slug="' + id.replace(/"/g, "") + '"]');
			if (targeted) {
				return targeted;
			}
		}
		return stack.querySelector(".photo-sheet");
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

	window.addEventListener("hashchange", function () {
		show();
		pinTop();
	});
	window.addEventListener("load", pinTop);
	show();
	pinTop();
})();
