const test = require("node:test");
const assert = require("node:assert/strict");
const { IDLE_MS, GRACE_MS, createIdle } = require("../assets/js/screensaver.js");

function harness() {
	let time = 0;
	let check;
	let interval;
	const state = { hidden: false, fullscreen: false, iframe: false, disabled: false };
	const starts = [];
	const stops = [];
	const idle = createIdle({
		now: function () { return time; },
		setInterval: function (fn, ms) {
			check = fn;
			interval = ms;
			return 1;
		},
		clearInterval: function () { check = null; },
		eligibility: function () { return state; },
		onStart: function (options) { starts.push(options); },
		onStop: function (reason) { stops.push(reason); }
	});
	idle.watch();
	return {
		idle, state, starts, stops, interval,
		at: function (ms) { time = ms; },
		poll: function (ms) {
			time = ms;
			if (check) check();
		}
	};
}

test("the periodic check starts at exactly five minutes of inactivity", function () {
	const h = harness();
	assert.equal(IDLE_MS, 300000);
	assert.equal(h.interval, 1000);
	h.poll(IDLE_MS - 1);
	assert.equal(h.idle.isRunning(), false);
	h.poll(IDLE_MS);
	assert.equal(h.idle.isRunning(), true);
	h.poll(IDLE_MS + 1000);
	assert.equal(h.starts.length, 1);
});

test("activity restarts the idle timer", function () {
	for (const type of ["mousemove", "mousedown", "pointerdown", "keydown", "wheel", "touchstart", "scroll", "visible"]) {
		const h = harness();
		h.at(1100);
		h.idle.activity(type, 20, 20);
		h.poll(IDLE_MS + 1099);
		assert.equal(h.idle.isRunning(), false, type);
		h.poll(IDLE_MS + 1100);
		assert.equal(h.idle.isRunning(), true, type);
	}
});

for (const condition of ["hidden", "fullscreen", "iframe", "disabled"]) {
	test("the idle check waits while " + condition, function () {
		const h = harness();
		h.state[condition] = true;
		h.poll(IDLE_MS + 1500);
		assert.equal(h.idle.isRunning(), false);
		h.state[condition] = false;
		h.poll(IDLE_MS + 2500);
		assert.equal(h.idle.isRunning(), true);
	});
}

test("manual launch works when automatic launch is disabled", function () {
	const h = harness();
	h.state.disabled = true;
	assert.equal(h.idle.start({ part: 3 }), true);
	assert.equal(h.idle.start(), false);
	assert.deepEqual(h.starts, [{ part: 3 }]);
});

test("grace-period movement is ignored and only ten total pixels dismiss", function () {
	const h = harness();
	h.idle.activity("mousemove", 0, 0);
	h.idle.start();
	h.at(GRACE_MS - 1);
	assert.equal(h.idle.activity("mousemove", 100, 200), false);
	h.at(GRACE_MS);
	assert.equal(h.idle.activity("mousemove", 103, 204), false);
	assert.equal(h.idle.activity("mousemove", 100, 204), false);
	assert.equal(h.idle.activity("mousemove", 100, 203), false);
	assert.equal(h.idle.activity("mousemove", 100, 202), true);
	assert.equal(h.idle.isRunning(), false);
	assert.deepEqual(h.stops, ["mousemove"]);
});

test("keys, pointers, touch and wheel wait out the grace period, then dismiss", function () {
	for (const type of ["keydown", "pointerdown", "mousedown", "touchstart", "wheel"]) {
		const h = harness();
		h.idle.start();
		h.at(GRACE_MS - 1);
		assert.equal(h.idle.activity(type), false, type);
		assert.equal(h.idle.isRunning(), true, type);
		h.at(GRACE_MS);
		assert.equal(h.idle.activity(type), true, type);
		assert.equal(h.idle.isRunning(), false, type);
		assert.deepEqual(h.stops, [type]);
	}
});

test("the idle timer starts over after dismissal", function () {
	const h = harness();
	h.poll(IDLE_MS);
	h.at(IDLE_MS + 1000);
	h.idle.activity("keydown");
	h.poll(2 * IDLE_MS + 999);
	assert.equal(h.idle.isRunning(), false);
	h.poll(2 * IDLE_MS + 1000);
	assert.equal(h.idle.isRunning(), true);
	assert.equal(h.starts.length, 2);
});
