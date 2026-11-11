const test = require("node:test");
const assert = require("node:assert/strict");
const display = require("../assets/js/gallery-display.js");

function fakeTimers() {
	let next = 1;
	const intervals = [];
	const timeouts = [];
	return {
		intervals,
		timeouts,
		setInterval(fn, ms) {
			const id = next++;
			intervals.push({ id, fn, ms });
			return id;
		},
		clearInterval(id) {
			const at = intervals.findIndex((item) => item.id === id);
			if (at >= 0) intervals.splice(at, 1);
		},
		setTimeout(fn, ms) {
			const id = next++;
			timeouts.push({ id, fn, ms });
			return id;
		},
		clearTimeout(id) {
			const at = timeouts.findIndex((item) => item.id === id);
			if (at >= 0) timeouts.splice(at, 1);
		}
	};
}

function photos() {
	return [
		{ src: "/a.webp", slug: "a", alt: "Alpha", taken: "1999-01-01" },
		{ src: "/b.webp", slug: "b", alt: "Beta", taken: "1999-02-02" },
		{ src: "/c.webp", slug: "c", alt: "Gamma", taken: "1999-03-03" }
	];
}

function harness(extra) {
	const timers = fakeTimers();
	const slides = [];
	const clocks = [];
	const idle = [];
	const pauses = [];
	const opens = [];
	let fullscreenExits = 0;
	let items = photos();
	const controller = display.createController(Object.assign({
		now: function () { return new Date("2026-11-11T17:51:00Z"); },
		locales: "en-US",
		playlist: function () { return items; },
		onSlide: function (item, index, count) { slides.push({ item, index, count }); },
		onClock: function (text) { clocks.push(text); },
		onIdle: function (isIdle) { idle.push(isIdle); },
		onPause: function (paused) { pauses.push(paused); },
		onOpenChange: function (isOpen) { opens.push(isOpen); },
		exitFullscreen: function () { fullscreenExits += 1; },
		setInterval: timers.setInterval,
		clearInterval: timers.clearInterval,
		setTimeout: timers.setTimeout,
		clearTimeout: timers.clearTimeout
	}, extra || {}));
	return { timers, slides, clocks, idle, pauses, opens, controller, fullscreenExits: function () { return fullscreenExits; }, setItems: function (next) { items = next; } };
}

test("stepIndex wraps through the album", function () {
	assert.equal(display.stepIndex(0, 1, 3), 1);
	assert.equal(display.stepIndex(2, 1, 3), 0);
	assert.equal(display.stepIndex(0, -1, 3), 2);
	assert.equal(display.stepIndex(0, 1, 0), 0);
	assert.equal(display.stepIndex(0, 1, 1), 0);
});

test("formatClock uses the device date, not a photo taken date", function () {
	const date = new Date("2026-11-11T17:51:00Z");
	const clock = display.formatClock(date, "en-US");
	assert.equal(clock.time, date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
	assert.equal(clock.date, date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric"
	}));
	assert.equal(clock.time.includes(":"), true);
	assert.equal(/\d{2}:\d{2}:\d{2}/.test(clock.time), false);
});

test("selectPlaylist keeps the visible album and skips links without a full image", function () {
	const playlist = display.selectPlaylist([
		{
			id: "gallery-all",
			visible: false,
			links: [{ full: "/all.webp", href: "/gallery/#all", title: "All" }]
		},
		{
			id: "",
			visible: true,
			links: [
				{ full: "/dog-1.webp", href: "/gallery/?from=dog#dog-1", title: "Dog 1", alt: "A dog" },
				{ full: "", href: "/gallery/?from=dog#missing", title: "Missing" },
				{ full: "/dog-2.webp", href: "/gallery/?from=dog#dog%202", title: "Dog 2" }
			]
		}
	]);
	assert.deepEqual(playlist.map((item) => item.slug), ["dog-1", "dog 2"]);
	assert.equal(playlist[0].alt, "A dog");
	assert.equal(playlist[0].src, "/dog-1.webp");
	assert.equal(playlist[1].alt, "Dog 2");
});

test("selectPlaylist falls back to the full gallery when no album is visible", function () {
	const playlist = display.selectPlaylist([
		{ id: "gallery-all", visible: false, links: [{ full: "/all.webp", href: "#all", title: "All" }] },
		{ id: "mecha", visible: false, links: [{ full: "/mecha.webp", href: "#mecha", title: "Mecha" }] }
	]);
	assert.deepEqual(playlist.map((item) => item.slug), ["all"]);
});

test("findHashIndex and shouldSetHash follow the open photo only", function () {
	const items = photos();
	assert.equal(display.findHashIndex(items, "#b"), 1);
	assert.equal(display.findHashIndex(items, "#nope"), -1);
	assert.equal(display.findHashIndex(items, ""), -1);
	assert.equal(display.shouldSetHash(true, true, "#a", "b"), true);
	assert.equal(display.shouldSetHash(true, true, "#b", "b"), false);
	assert.equal(display.shouldSetHash(true, false, "", "b"), false);
	assert.equal(display.shouldSetHash(false, true, "#a", "b"), false);
});

test("activeAlbumId prefers the open tag, then the from filter", function () {
	assert.equal(display.activeAlbumId("mecha", "gallery"), "mecha");
	assert.equal(display.activeAlbumId("", "dog"), "dog");
	assert.equal(display.activeAlbumId("", "gallery"), "gallery");
	assert.equal(display.activeAlbumId("", ""), "gallery");
	assert.equal(display.activeAlbumId(null, "bad tag!"), "badtag");
});

test("opening twice does not stack clock or slideshow timers", function () {
	const h = harness();
	h.controller.open(1);
	h.controller.open(0);
	assert.equal(h.timers.intervals.length, 1);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS).length, 1);
	assert.equal(h.slides.length, 1);
	assert.equal(h.slides[0].item.slug, "b");
	assert.equal(h.clocks.length, 1);
	assert.equal(h.clocks[0].date.includes("1999"), false);
	assert.equal(h.clocks[0].time, display.formatClock(new Date("2026-11-11T17:51:00Z"), "en-US").time);
	h.controller.close();
	assert.equal(h.timers.intervals.length, 0);
	assert.equal(h.timers.timeouts.length, 0);
	h.controller.close();
	h.controller.open(0);
	assert.equal(h.timers.intervals.length, 1);
});

test("slideshow advances once per interval and ignores a stale timer after close", function () {
	const h = harness();
	h.controller.open(0);
	const first = h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS);
	assert.equal(first.length, 1);
	h.timers.clearTimeout(first[0].id);
	first[0].fn();
	assert.equal(h.slides.at(-1).item.slug, "b");
	const pending = h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS);
	assert.equal(pending.length, 1);
	h.controller.close();
	const count = h.slides.length;
	pending[0].fn();
	assert.equal(h.slides.length, count);
	assert.equal(h.controller.state.open, false);
});

test("manual next restarts one slideshow timer and pause clears it", function () {
	const h = harness();
	h.controller.open(0);
	h.controller.go(1);
	assert.equal(h.slides.at(-1).item.slug, "b");
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS).length, 1);
	h.controller.go(-1);
	assert.equal(h.slides.at(-1).item.slug, "a");
	assert.equal(h.controller.togglePause(), true);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS).length, 0);
	assert.equal(h.controller.togglePause(), false);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS).length, 1);
	assert.equal(h.timers.intervals.length, 1);
});

test("a single photo does not schedule a slideshow loop", function () {
	const h = harness();
	h.setItems([{ src: "/only.webp", slug: "only", alt: "Only" }]);
	h.controller.open(0);
	assert.equal(h.slides[0].count, 1);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS).length, 0);
	h.controller.go(1);
	assert.equal(h.slides.length, 1);
	assert.equal(h.timers.intervals.length, 1);
});

test("idle hides the controls once, and a poke brings them back", function () {
	const h = harness();
	h.controller.open(0);
	const idleTimer = h.timers.timeouts.find((item) => item.ms === display.IDLE_MS);
	h.timers.clearTimeout(idleTimer.id);
	idleTimer.fn();
	assert.equal(h.controller.state.idle, true);
	assert.equal(h.idle.at(-1), true);
	h.controller.poke();
	assert.equal(h.controller.state.idle, false);
	assert.equal(h.idle.at(-1), false);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.IDLE_MS).length, 1);
});

test("leaving browser fullscreen closes display once", function () {
	const h = harness();
	h.controller.open(0);
	h.controller.noteFullscreen(true);
	h.controller.onFullscreenExit();
	h.controller.onFullscreenExit();
	assert.equal(h.controller.state.open, false);
	assert.equal(h.fullscreenExits(), 0);
	assert.equal(h.opens.at(-1), false);
});

test("an empty album still has one clock and no slideshow", function () {
	const h = harness();
	h.setItems([]);
	h.controller.open(0);
	h.controller.open(0);
	assert.equal(h.slides[0].item, null);
	assert.equal(h.timers.intervals.length, 1);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === display.SLIDE_MS).length, 0);
	assert.equal(h.clocks.length, 1);
	assert.equal(h.clocks[0].date.includes("1999"), false);
});

test("exit while fullscreen asks the browser to leave fullscreen once", function () {
	const timers = fakeTimers();
	let calls = 0;
	const controller = display.createController({
		playlist: function () { return photos(); },
		exitFullscreen: function () {
			calls += 1;
			controller.onFullscreenExit();
		},
		setInterval: timers.setInterval,
		clearInterval: timers.clearInterval,
		setTimeout: timers.setTimeout,
		clearTimeout: timers.clearTimeout
	});
	controller.open(0);
	controller.noteFullscreen(true);
	controller.close();
	controller.close();
	assert.equal(calls, 1);
	assert.equal(controller.state.open, false);
	assert.equal(timers.intervals.length, 0);
	assert.equal(timers.timeouts.length, 0);
});
