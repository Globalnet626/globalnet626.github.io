// Gallery explorer maximize / restore. Photo windows keep using 001.js.
(function () {
	var wrap = document.querySelector(".wrapper");
	var maxBtn = document.querySelector(".gallery-max");
	var restoreBtn = document.querySelector(".gallery-restore");
	if (!wrap || !maxBtn || !restoreBtn) return;

	function setMax(on) {
		wrap.classList.toggle("is-max", on);
		maxBtn.setAttribute("aria-pressed", on ? "true" : "false");
	}

	maxBtn.addEventListener("click", function () { setMax(true); });
	restoreBtn.addEventListener("click", function () { setMax(false); });

	if (location.hash === "#maximized") setMax(true);
})();
