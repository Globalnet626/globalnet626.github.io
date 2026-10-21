// Win95 chrome around the vendored FLYBY2 player iframe.
(function () {
	var win = document.querySelector(".flyby-window");
	var frame = document.getElementById("flyby-frame");
	var about = document.getElementById("flyby-about");
	var planeStatus = document.getElementById("flyby-status-plane");
	var speedStatus = document.getElementById("flyby-status-speed");
	var speedMenu = document.getElementById("flyby-speed");
	var editMenu = document.getElementById("flyby-edit");
	if (!win || !frame) return;

	var wantPlane = null;
	var planeChosen = false;
	var wantSpeed = 1;
	var speedReady = false;

	function playerWindow() {
		try {
			return frame.contentWindow;
		} catch (err) {
			return null;
		}
	}

	function playerApi() {
		var player = playerWindow();
		return player && player.flyby ? player.flyby : null;
	}

	function hidePlayerChrome() {
		var player = playerWindow();
		var doc = player && player.document;
		var chrome = doc && doc.getElementById("chrome");
		if (chrome) chrome.style.display = "none";
	}

	function setSpeedVisible(on) {
		speedReady = on;
		if (speedMenu) speedMenu.hidden = !on;
		if (editMenu) editMenu.hidden = !on;
	}

	function pushAircraft() {
		if (!planeChosen) return;
		var api = playerApi();
		if (api && typeof api.setAircraft === "function") {
			api.setAircraft(wantPlane == null ? "random" : wantPlane);
			return;
		}
		var player = playerWindow();
		var sel = player && player.document && player.document.getElementById("aircraftSelect");
		if (!sel || !sel.options || sel.options.length < 2) return;
		sel.value = wantPlane == null ? "" : String(wantPlane);
		sel.dispatchEvent(new Event("change"));
	}

	function pushSpeed() {
		var api = playerApi();
		if (api && typeof api.setSpeed === "function") api.setSpeed(wantSpeed);
	}

	var watchStarted = false;
	function watchPlayer() {
		if (watchStarted) return;
		watchStarted = true;
		hidePlayerChrome();
		var tries = 0;
		var timer = setInterval(function () {
			tries += 1;
			hidePlayerChrome();
			var api = playerApi();
			if (api) {
				clearInterval(timer);
				setSpeedVisible(typeof api.setSpeed === "function");
				pushAircraft();
				if (wantSpeed !== 1) pushSpeed();
				return;
			}
			if (tries > 150) {
				clearInterval(timer);
				setSpeedVisible(false);
			}
		}, 200);
	}

	function playerDocumentComplete() {
		try {
			var doc = frame.contentDocument;
			var href = frame.contentWindow && frame.contentWindow.location.href;
			return !!(doc && doc.readyState === "complete" && href && href.indexOf("/flyby/player/") !== -1);
		} catch (err) {
			return false;
		}
	}

	frame.addEventListener("load", watchPlayer);
	frame.src = "/flyby/player/";
	if (playerDocumentComplete()) watchPlayer();

	function setExpanded(menu, open) {
		menu.classList.toggle("is-open", open);
		var btn = menu.querySelector("button");
		if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
	}

	function closeMenus() {
		Array.prototype.forEach.call(document.querySelectorAll(".flyby-sub.is-open"), function (sub) {
			setExpanded(sub, false);
		});
		Array.prototype.forEach.call(document.querySelectorAll(".flyby-menu.is-open"), function (menu) {
			setExpanded(menu, false);
		});
	}

	function openMenu(menu) {
		closeMenus();
		setExpanded(menu, true);
	}

	function openSub(sub) {
		Array.prototype.forEach.call(document.querySelectorAll(".flyby-sub.is-open"), function (other) {
			if (other !== sub) setExpanded(other, false);
		});
		setExpanded(sub, true);
	}

	var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

	Array.prototype.forEach.call(document.querySelectorAll(".flyby-menu"), function (menu) {
		var top = menu.querySelector("button");
		if (!top || top.id === "flyby-about-btn") return;
		top.addEventListener("click", function (event) {
			event.stopPropagation();
			if (menu.classList.contains("is-open")) closeMenus();
			else openMenu(menu);
		});
	});

	Array.prototype.forEach.call(document.querySelectorAll(".flyby-sub"), function (sub) {
		var btn = sub.querySelector(".flyby-sub-btn");
		if (!btn) return;
		btn.addEventListener("click", function (event) {
			event.preventDefault();
			event.stopPropagation();
			if (finePointer.matches) {
				openSub(sub);
				return;
			}
			if (sub.classList.contains("is-open")) setExpanded(sub, false);
			else openSub(sub);
		});
		sub.addEventListener("mouseenter", function () {
			if (finePointer.matches) openSub(sub);
		});
	});

	var planeIndex = 0;
	Array.prototype.forEach.call(document.querySelectorAll("[data-plane]"), function (item) {
		var chosen = item.getAttribute("data-plane") === "random" ? null : planeIndex++;
		item.addEventListener("click", function () {
			Array.prototype.forEach.call(document.querySelectorAll("[data-plane]"), function (other) {
				other.setAttribute("aria-checked", other === item ? "true" : "false");
			});
			if (planeStatus) planeStatus.textContent = item.textContent;
			wantPlane = chosen;
			planeChosen = true;
			pushAircraft();
			closeMenus();
		});
	});

	Array.prototype.forEach.call(document.querySelectorAll("[data-speed]"), function (item) {
		item.addEventListener("click", function () {
			if (!speedReady) return;
			Array.prototype.forEach.call(document.querySelectorAll("[data-speed]"), function (other) {
				other.setAttribute("aria-checked", other === item ? "true" : "false");
			});
			if (speedStatus) speedStatus.textContent = item.textContent;
			wantSpeed = Number(item.getAttribute("data-speed")) || 1;
			pushSpeed();
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
	if (maxBtn) maxBtn.addEventListener("click", function () { win.classList.add("is-max"); });
	if (restoreBtn) restoreBtn.addEventListener("click", function () { win.classList.remove("is-max"); });
})();
