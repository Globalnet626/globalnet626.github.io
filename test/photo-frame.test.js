const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const frame = require("../assets/js/photo-frame.js");

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
		{ src: "/a.webp", alt: "Alpha", taken: "1999-01-01" },
		{ src: "/b.webp", alt: "Beta", taken: "1999-02-02" },
		{ src: "/c.webp", alt: "Gamma", taken: "1999-03-03" }
	];
}

function harness(extra) {
	const timers = fakeTimers();
	const slides = [];
	const clocks = [];
	let items = photos();
	const player = frame.createPlayer(Object.assign({
		now: function () { return new Date("2026-11-11T17:51:00Z"); },
		locales: "en-US",
		playlist: function () { return items; },
		onSlide: function (item, index, count) { slides.push({ item, index, count }); },
		onClock: function (text) { clocks.push(text); },
		setInterval: timers.setInterval,
		clearInterval: timers.clearInterval,
		setTimeout: timers.setTimeout,
		clearTimeout: timers.clearTimeout
	}, extra || {}));
	return {
		timers,
		slides,
		clocks,
		player,
		setItems: function (next) { items = next; }
	};
}

test("stepIndex wraps the gallery", function () {
	assert.equal(frame.stepIndex(0, 1, 3), 1);
	assert.equal(frame.stepIndex(2, 1, 3), 0);
	assert.equal(frame.stepIndex(0, -1, 3), 2);
	assert.equal(frame.stepIndex(0, 1, 1), 0);
});

test("formatClock uses the device date, not a photo taken date", function () {
	const date = new Date("2026-11-11T17:51:00Z");
	const clock = frame.formatClock(date, "en-US");
	assert.equal(clock.time, date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
	assert.equal(clock.date, date.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric"
	}));
	assert.equal(/\d{2}:\d{2}:\d{2}/.test(clock.time), false);
});

test("the player only starts and stops", function () {
	assert.deepEqual(Object.keys(frame.createPlayer()).sort(), ["current", "start", "state", "stop"]);
});

test("starting twice does not stack the clock or the slideshow", function () {
	const h = harness();
	h.player.start();
	h.player.start();
	assert.equal(h.timers.intervals.length, 1);
	assert.equal(h.timers.timeouts.filter((item) => item.ms === frame.SLIDE_MS).length, 1);
	assert.equal(h.slides.length, 1);
	assert.equal(h.slides[0].item.src, "/a.webp");
	assert.equal(h.clocks[0].date.includes("1999"), false);
	assert.equal(h.clocks[0].time, frame.formatClock(new Date("2026-11-11T17:51:00Z"), "en-US").time);
	h.player.stop();
	h.player.stop();
	assert.equal(h.timers.intervals.length, 0);
	assert.equal(h.timers.timeouts.length, 0);
	h.player.start();
	assert.equal(h.timers.intervals.length, 1);
});

test("the slideshow advances once per interval and ignores a timer after stop", function () {
	const h = harness();
	h.player.start();
	const first = h.timers.timeouts.filter((item) => item.ms === frame.SLIDE_MS);
	assert.equal(first.length, 1);
	h.timers.clearTimeout(first[0].id);
	first[0].fn();
	assert.equal(h.slides.at(-1).item.src, "/b.webp");
	const pending = h.timers.timeouts.filter((item) => item.ms === frame.SLIDE_MS);
	assert.equal(pending.length, 1);
	h.player.stop();
	const count = h.slides.length;
	pending[0].fn();
	assert.equal(h.slides.length, count);
	assert.equal(h.player.state().running, false);
});

test("one photo does not schedule a slideshow loop", function () {
	const h = harness();
	h.setItems([{ src: "/only.webp", alt: "Only" }]);
	h.player.start();
	assert.equal(h.slides[0].count, 1);
	assert.equal(h.timers.timeouts.length, 0);
	assert.equal(h.timers.intervals.length, 1);
});

test("the clock window is inset from the bottom left", function () {
	const css = fs.readFileSync(path.join(__dirname, "../assets/css/photo-frame.css"), "utf8");
	const clock = css.slice(css.indexOf(".frame-clock {"), css.indexOf(".frame-clock-title"));
	assert.match(clock, /bottom:\s*24px/);
	assert.match(clock, /left:\s*24px/);
	assert.match(clock, /bottom:\s*max\(24px,\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
	assert.match(clock, /left:\s*max\(24px,\s*env\(safe-area-inset-left,\s*0px\)\)/);
	assert.doesNotMatch(clock, /top:\s*50%/);
	assert.doesNotMatch(clock, /translate\(-50%/);
	const narrow = css.slice(css.indexOf("@media (max-width: 600px)"));
	assert.match(narrow, /bottom:\s*16px/);
	assert.match(narrow, /left:\s*16px/);
	assert.match(narrow, /env\(safe-area-inset-bottom/);
	assert.match(narrow, /env\(safe-area-inset-left/);
});

test("an empty gallery still shows one clock", function () {
	const h = harness();
	h.setItems([]);
	h.player.start();
	h.player.start();
	assert.equal(h.slides[0].item, null);
	assert.equal(h.timers.intervals.length, 1);
	assert.equal(h.timers.timeouts.length, 0);
	assert.equal(h.clocks[0].date.includes("1999"), false);
});
