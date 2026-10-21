// Visual mock only. The canvas is a still stand-in, not the FLYBY2 engine.
(function () {
	var win = document.querySelector(".flyby-window");
	var view = document.getElementById("flyby-view");
	var about = document.getElementById("flyby-about");
	var planeStatus = document.getElementById("flyby-status-plane");
	var speedStatus = document.getElementById("flyby-status-speed");
	if (!win || !view) return;

	function draw() {
		var w = view.clientWidth || 640;
		var h = view.clientHeight || 360;
		if (w < 2 || h < 2) return;
		view.width = w;
		view.height = h;
		var ctx = view.getContext("2d");
		var sky = h * 0.46;
		ctx.fillStyle = "#7eb6d8";
		ctx.fillRect(0, 0, w, sky);
		ctx.fillStyle = "#2f6a32";
		ctx.fillRect(0, sky, w, h - sky);
		ctx.strokeStyle = "#14306e";
		ctx.lineWidth = 1;
		var i, t, y, x;
		for (i = 1; i <= 8; i++) {
			t = i / 8;
			y = sky + (h - sky) * t * t;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
			ctx.stroke();
		}
		for (i = -6; i <= 6; i++) {
			ctx.beginPath();
			ctx.moveTo(w / 2, sky);
			ctx.lineTo(w / 2 + i * w * 0.16, h);
			ctx.stroke();
		}
		ctx.fillStyle = "#d0d4d8";
		ctx.strokeStyle = "#1c1c1c";
		ctx.lineWidth = 1;
		x = w * 0.62;
		y = h * 0.42;
		ctx.beginPath();
		ctx.moveTo(x + 46, y);
		ctx.lineTo(x - 10, y - 8);
		ctx.lineTo(x - 36, y - 3);
		ctx.lineTo(x - 18, y + 4);
		ctx.lineTo(x + 8, y + 6);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 4, y - 2);
		ctx.lineTo(x - 28, y - 22);
		ctx.lineTo(x + 6, y + 1);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x - 8, y + 3);
		ctx.lineTo(x - 22, y + 16);
		ctx.lineTo(x + 2, y + 5);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	function closeMenus() {
		Array.prototype.forEach.call(document.querySelectorAll(".flyby-menu.is-open"), function (menu) {
			menu.classList.remove("is-open");
			var btn = menu.querySelector("button");
			if (btn) btn.setAttribute("aria-expanded", "false");
		});
	}

	function openMenu(menu) {
		closeMenus();
		menu.classList.add("is-open");
		var btn = menu.querySelector("button");
		if (btn) btn.setAttribute("aria-expanded", "true");
	}

	Array.prototype.forEach.call(document.querySelectorAll(".flyby-menu"), function (menu) {
		var top = menu.querySelector("button");
		if (!top || top.id === "flyby-about-btn") return;
		top.addEventListener("click", function (event) {
			event.stopPropagation();
			if (menu.classList.contains("is-open")) closeMenus();
			else openMenu(menu);
		});
	});

	Array.prototype.forEach.call(document.querySelectorAll("[data-plane]"), function (item) {
		item.addEventListener("click", function () {
			Array.prototype.forEach.call(document.querySelectorAll("[data-plane]"), function (other) {
				other.setAttribute("aria-checked", other === item ? "true" : "false");
			});
			if (planeStatus) planeStatus.textContent = item.textContent;
			closeMenus();
		});
	});

	Array.prototype.forEach.call(document.querySelectorAll("[data-speed]"), function (item) {
		item.addEventListener("click", function () {
			Array.prototype.forEach.call(document.querySelectorAll("[data-speed]"), function (other) {
				other.setAttribute("aria-checked", other === item ? "true" : "false");
			});
			if (speedStatus) speedStatus.textContent = item.textContent;
			closeMenus();
		});
	});

	function showAbout(on) {
		if (!about) return;
		closeMenus();
		about.hidden = !on;
		about.classList.toggle("is-open", on);
		if (on) {
			var ok = document.getElementById("flyby-about-ok");
			if (ok) ok.focus();
		}
	}

	var aboutBtn = document.getElementById("flyby-about-btn");
	if (aboutBtn) aboutBtn.addEventListener("click", function () { showAbout(true); });
	var aboutOk = document.getElementById("flyby-about-ok");
	var aboutX = document.getElementById("flyby-about-x");
	if (aboutOk) aboutOk.addEventListener("click", function () { showAbout(false); });
	if (aboutX) aboutX.addEventListener("click", function () { showAbout(false); });

	document.addEventListener("click", function (event) {
		if (!event.target.closest || !event.target.closest(".flyby-menu")) closeMenus();
	});
	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape") {
			if (about && !about.hidden) showAbout(false);
			else closeMenus();
		}
	});

	var maxBtn = document.querySelector(".flyby-max");
	var restoreBtn = document.querySelector(".flyby-restore");
	if (maxBtn) {
		maxBtn.addEventListener("click", function () {
			win.classList.add("is-max");
			requestAnimationFrame(draw);
		});
	}
	if (restoreBtn) {
		restoreBtn.addEventListener("click", function () {
			win.classList.remove("is-max");
			requestAnimationFrame(draw);
		});
	}

	window.addEventListener("resize", draw);
	draw();
})();
