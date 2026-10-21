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

	var splash = document.getElementById("flyby-splash");
	var splashFill = document.getElementById("flyby-splash-fill");

	function sizeSplashBar() {
		var img = document.querySelector(".flyby-splash-art img");
		var bar = document.querySelector(".flyby-splash-bar");
		if (!img || !bar) return;
		var w = img.getBoundingClientRect().width;
		if (w > 40) bar.style.width = Math.round(w) + "px";
	}

	function readPlayerProgress() {
		try {
			var doc = frame.contentDocument;
			var span = doc && doc.querySelector("#progress > span");
			if (!span || !span.style.width) return null;
			var pct = parseFloat(span.style.width);
			if (isNaN(pct)) return null;
			if (pct < 0) return 0;
			if (pct > 100) return 100;
			return pct;
		} catch (err) {
			return null;
		}
	}

	function updateSplash() {
		if (!splash || splash.hidden) return;
		sizeSplashBar();
		var pct = readPlayerProgress();
		if (pct == null || !splashFill) return;
		splashFill.classList.remove("is-indet");
		splashFill.style.transform = "none";
		splashFill.style.width = pct + "%";
	}

	var splashFail = document.getElementById("flyby-splash-fail");
	var splashStatus = document.getElementById("flyby-splash-status");
	var splashRetry = document.getElementById("flyby-splash-retry");
	var watchTimer = null;
	var watchStartedAt = 0;
	var splashFailed = false;
	var SPLASH_WAIT_MS = 30000;

	function setSplashStatus(text) {
		if (splashStatus) splashStatus.textContent = text;
	}

	function resetSplashBar() {
		if (!splashFill) return;
		splashFill.classList.add("is-indet");
		splashFill.style.transform = "";
		splashFill.style.width = "";
	}

	function showSplashLoading() {
		splashFailed = false;
		if (splash) {
			splash.hidden = false;
			splash.classList.remove("is-failed");
		}
		if (splashFail) splashFail.hidden = true;
		resetSplashBar();
		setSplashStatus("Loading");
	}

	function showSplashFailure() {
		if (splashFailed) return;
		splashFailed = true;
		if (splash) splash.classList.add("is-failed");
		if (splashFail) splashFail.hidden = false;
		setSplashStatus("FLYBY2 failed to load");
		if (splashRetry) splashRetry.focus();
	}

	function hideSplash() {
		if (splash) splash.hidden = true;
		setSplashStatus("");
	}

	function adoptPlayer(api) {
		if (watchTimer) {
			clearInterval(watchTimer);
			watchTimer = null;
		}
		hidePlayerChrome();
		hideSplash();
		setSpeedVisible(typeof api.setSpeed === "function");
		pushAircraft();
		if (wantSpeed !== 1) pushSpeed();
	}

	function tickPlayer() {
		hidePlayerChrome();
		if (!splashFailed) updateSplash();
		var api = playerApi();
		if (api) {
			adoptPlayer(api);
			return;
		}
		if (!splashFailed && watchStartedAt && Date.now() - watchStartedAt >= SPLASH_WAIT_MS) {
			showSplashFailure();
		}
	}

	function ensureWatch() {
		if (watchTimer) return;
		watchTimer = setInterval(tickPlayer, 200);
	}

	function reloadPlayer() {
		showSplashLoading();
		watchStartedAt = Date.now();
		ensureWatch();
		frame.src = "/flyby/player/?retry=" + Date.now();
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

	frame.addEventListener("load", function () {
		hidePlayerChrome();
		if (!splashFailed) updateSplash();
	});
	if (splashRetry) splashRetry.addEventListener("click", reloadPlayer);
	showSplashLoading();
	watchStartedAt = Date.now();
	ensureWatch();
	frame.src = "/flyby/player/";
	if (playerDocumentComplete()) tickPlayer();

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
	if (maxBtn) maxBtn.addEventListener("click", function () {
		win.classList.add("is-max");
		requestAnimationFrame(sizeSplashBar);
	});
	if (restoreBtn) restoreBtn.addEventListener("click", function () {
		win.classList.remove("is-max");
		requestAnimationFrame(sizeSplashBar);
	});

	var splashImg = document.querySelector(".flyby-splash-art img");
	if (splashImg) splashImg.addEventListener("load", sizeSplashBar);
	window.addEventListener("resize", sizeSplashBar);
	sizeSplashBar();
})();
