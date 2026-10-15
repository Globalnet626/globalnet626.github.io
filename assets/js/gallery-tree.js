// Expand and collapse the gallery folder in the explorer tree.
(function () {
	var buttons = document.querySelectorAll(".tree-toggle");
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].addEventListener("click", function (event) {
			event.preventDefault();
			var branch = this.parentNode;
			var open = branch.classList.toggle("is-open");
			this.setAttribute("aria-expanded", open ? "true" : "false");
			this.setAttribute("aria-label", open ? "Collapse gallery" : "Expand gallery");
		});
	}

	function folderTitle() {
		var heading = document.querySelector(".default_title h1");
		var sets = document.querySelectorAll(".gallery-set");
		if (!heading || !sets.length) return;
		var id = window.location.hash.replace(/^#/, "");
		var current = id ? document.getElementById(id) : null;
		if (!current || !current.classList.contains("tag-anchor")) current = null;
		var label = current ? (current.getAttribute("data-label") || id) : "gallery";
		heading.textContent = label;
		document.title = label;
	}

	function pinTop() {
		if (!document.querySelector(".tag-anchor")) return;
		if (window.matchMedia("(max-width: 750px)").matches) {
			window.scrollTo(0, 0);
		}
	}

	window.addEventListener("hashchange", function () {
		folderTitle();
		pinTop();
	});
	window.addEventListener("load", pinTop);
	folderTitle();
	pinTop();
})();
