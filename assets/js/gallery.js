// Photo gallery lightbox. Loaded only on the gallery page.
(function () {
	var grid = document.querySelector(".photo-grid");
	var dialog = document.getElementById("photo-lightbox");
	if (!grid || !dialog) {
		return;
	}

	var cards = Array.prototype.slice.call(grid.querySelectorAll(".photo-card"));
	var img = dialog.querySelector(".lightbox-photo");
	var caption = dialog.querySelector(".lightbox-caption");
	var title = document.getElementById("lightbox-title");
	var count = dialog.querySelector(".lightbox-count");
	var closeBtn = dialog.querySelector(".lightbox-close");
	var prevBtn = dialog.querySelector(".lightbox-prev");
	var nextBtn = dialog.querySelector(".lightbox-next");
	var index = -1;
	var lastFocus = null;

	document.body.appendChild(dialog);

	function isOpen() {
		return !dialog.hasAttribute("hidden");
	}

	function show(nextIndex, moveFocus) {
		if (!cards.length) {
			return;
		}
		index = (nextIndex + cards.length) % cards.length;
		var card = cards[index];
		var alt = card.getAttribute("data-alt") || "";
		var text = card.getAttribute("data-caption") || alt || "Photo";
		img.src = card.getAttribute("data-full");
		img.alt = alt;
		caption.textContent = text;
		title.textContent = text;
		count.textContent = (index + 1) + " of " + cards.length;
		dialog.removeAttribute("hidden");
		if (moveFocus) {
			closeBtn.focus();
		}
	}

	function close() {
		if (!isOpen()) {
			return;
		}
		dialog.setAttribute("hidden", "");
		img.removeAttribute("src");
		img.alt = "";
		if (lastFocus && typeof lastFocus.focus === "function") {
			lastFocus.focus();
		}
	}

	function focusables() {
		return [closeBtn, prevBtn, nextBtn];
	}

	cards.forEach(function (card, cardIndex) {
		card.addEventListener("click", function () {
			lastFocus = card;
			show(cardIndex, true);
		});
	});

	closeBtn.addEventListener("click", close);
	prevBtn.addEventListener("click", function () {
		show(index - 1, false);
	});
	nextBtn.addEventListener("click", function () {
		show(index + 1, false);
	});

	dialog.addEventListener("click", function (event) {
		if (event.target === dialog) {
			close();
		}
	});

	document.addEventListener("keydown", function (event) {
		if (!isOpen()) {
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			show(index - 1, false);
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			show(index + 1, false);
			return;
		}
		if (event.key !== "Tab") {
			return;
		}
		var items = focusables();
		var current = items.indexOf(document.activeElement);
		event.preventDefault();
		if (current === -1) {
			closeBtn.focus();
			return;
		}
		var next = event.shiftKey
			? (current - 1 + items.length) % items.length
			: (current + 1) % items.length;
		items[next].focus();
	});
})();
