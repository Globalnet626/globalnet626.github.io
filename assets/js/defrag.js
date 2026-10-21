// Cosmetic Windows 95 Disk Defragmenter. Nothing here touches a real disk.
(function () {
	var ASM_KEY = "gleebsal-defrag-asmr";
	var root = document.getElementById("defrag-app");
	var wrap = document.querySelector(".defrag-window");
	var mapWrap = document.getElementById("defrag-map-wrap");
	var canvas = document.getElementById("defrag-map");
	var statusEl = document.getElementById("defrag-status");
	var percentEl = document.getElementById("defrag-percent");
	var barFill = document.getElementById("defrag-bar-fill");
	var stopBtn = document.getElementById("defrag-stop");
	var pauseBtn = document.getElementById("defrag-pause");
	var detailsBtn = document.getElementById("defrag-details");
	var asmr = document.getElementById("defrag-asmr");
	if (!root || !canvas || !mapWrap) return;

	var dialogs = {
		select: document.getElementById("defrag-select"),
		legend: document.getElementById("defrag-legend"),
		settings: document.getElementById("defrag-settings"),
		stop: document.getElementById("defrag-stop-dlg"),
		done: document.getElementById("defrag-done")
	};

	var ctx = null;
	var badPat = null;
	var cells = [];
	var final = [];
	var cols = 0;
	var flash = null;
	var timer = 0;
	var phase = "select";
	var current = "select";
	var restoreSelect = false;
	var resumeAfterNo = false;
	var speed = 1;
	var audioCtx = null;
	var master = null;
	var liveOsc = [];
	var voiceUntil = [];
	var lastFragment = -1;
	var lastSweep = -1;
	var stepSerial = 0;
	var reduced = false;
	// A full run is this long at 1×, half of that at 2×, on any map size.
	var RUN_MS = 6000;
	var FRAME_MS = 32;
	var swaps = 0;
	var fixes = 0;
	var pace = 0;
	var workMs = 0;
	var clockStamp = 0;
	var pctGoal = 0;
	var pctShown = 0;
	var pctT0 = 0;
	var paintRaf = 0;

	try {
		reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch (e) {}

	try {
		asmr.checked = localStorage.getItem(ASM_KEY) === "1";
	} catch (e) {}

	function setStatus(text) {
		statusEl.textContent = text;
	}

	function show(name) {
		current = name || "none";
		Object.keys(dialogs).forEach(function (key) {
			var el = dialogs[key];
			if (!el) return;
			var on = key === name;
			el.classList.toggle("is-open", on);
			if (on) el.removeAttribute("aria-hidden");
			else el.setAttribute("aria-hidden", "true");
		});
		var focusId = {
			select: "defrag-ok",
			legend: "defrag-legend-close",
			settings: "defrag-settings-close",
			stop: "defrag-no",
			done: "defrag-done-ok"
		}[name];
		if (focusId) {
			var btn = document.getElementById(focusId);
			if (btn) btn.focus();
		}
	}

	function goHome() {
		window.location.href = "/";
	}

	function readSpeed() {
		var picked = document.querySelector('input[name="defrag-speed"]:checked');
		speed = picked && picked.value === "2" ? 2 : 1;
	}

	function clearTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = 0;
		}
	}

	function schedule(fn, ms) {
		clearTimer();
		timer = setTimeout(fn, ms);
	}

	function setRunningButtons(on) {
		stopBtn.disabled = !on;
		pauseBtn.disabled = !on;
		if (!on) pauseBtn.textContent = "Pause";
	}

	function ensureAudio() {
		var AC = window.AudioContext || window.webkitAudioContext;
		var pending;
		if (!AC) return;
		try {
			if (!audioCtx || audioCtx.state === "closed") {
				audioCtx = new AC();
				master = audioCtx.createGain();
				master.gain.value = 1;
				master.connect(audioCtx.destination);
				liveOsc = [];
				voiceUntil = [];
			}
			// 'interrupted' (WebKit) as well as 'suspended'.
			if (audioCtx.state !== "running") {
				pending = audioCtx.resume();
				if (pending && pending.catch) pending.catch(function () {});
			}
		} catch (e) {}
	}

	function stopVoices() {
		var t, i, slot, g;
		voiceUntil = [];
		if (!audioCtx) {
			liveOsc = [];
			return;
		}
		t = audioCtx.currentTime;
		if (master) {
			try {
				master.gain.value = 0;
				master.gain.cancelScheduledValues(t);
				master.gain.setValueAtTime(0, t);
			} catch (e) {}
		}
		for (i = 0; i < liveOsc.length; i++) {
			slot = liveOsc[i];
			try {
				g = slot.gain.gain;
				g.value = 0;
				g.cancelScheduledValues(t);
				g.setValueAtTime(0, t);
				slot.gain.disconnect();
			} catch (e) {}
			try {
				// stop(now) keeps an oscillator that has not started from ever starting.
				slot.osc.stop(t);
			} catch (e) {}
		}
		liveOsc = [];
	}

	function releaseMaster() {
		var t;
		if (!master || !audioCtx) return;
		t = audioCtx.currentTime;
		try {
			master.gain.cancelScheduledValues(t);
			master.gain.value = 1;
			master.gain.setValueAtTime(1, t);
		} catch (e) {}
	}

	// Pitch follows the block index. Callers pass blockCount - 1 as max.
	function blockFreq(index, max) {
		var minHz = 180;
		var maxHz = 1800;
		if (!(max > 0)) max = 1;
		var norm = index / max;
		if (!(norm >= 0)) norm = 0;
		else if (norm > 1) norm = 1;
		return minHz * Math.pow(maxHz / minHz, norm);
	}

	function soundOn() {
		return !!(asmr && asmr.checked && audioCtx && audioCtx.state !== "closed");
	}

	function claimVoice(start, end) {
		var now = audioCtx.currentTime;
		var i, live = [], overlap = 0, slot;
		for (i = 0; i < voiceUntil.length; i++) {
			slot = voiceUntil[i];
			if (slot.end < now - 0.02) continue;
			live.push(slot);
			if (slot.start < end && start < slot.end) overlap++;
		}
		voiceUntil = live;
		if (overlap >= 4) return false;
		voiceUntil.push({ start: start, end: end });
		return true;
	}

	function tone(type, hz, when, dur, peak) {
		var osc, gain, attack, end, now, i, kept;
		if (!soundOn()) return false;
		if (!(hz > 40) || !(dur > 0) || !(peak > 0)) return false;
		if (when < audioCtx.currentTime) when = audioCtx.currentTime;
		end = when + dur;
		// stop() is 10 ms after the envelope so the release is not cut off.
		// That tail still counts as a sounding oscillator.
		if (!claimVoice(when, end + 0.01)) return false;
		try {
			releaseMaster();
			osc = audioCtx.createOscillator();
			gain = audioCtx.createGain();
			attack = Math.min(0.005, dur * 0.28);
			if (attack < 0.002) attack = 0.002;
			if (attack > dur * 0.45) attack = dur * 0.45;
			osc.type = type;
			osc.frequency.setValueAtTime(hz, when);
			// Own the value immediately. A future setValueAtTime leaves the default of 1
			// in place until then, and cancelling that event brings the default back.
			gain.gain.value = 0;
			gain.gain.setValueAtTime(0, audioCtx.currentTime);
			gain.gain.setValueAtTime(0.0001, when);
			gain.gain.exponentialRampToValueAtTime(peak, when + attack);
			gain.gain.exponentialRampToValueAtTime(0.0001, end);
			osc.connect(gain);
			gain.connect(master || audioCtx.destination);
			osc.start(when);
			// Audio-clock stop. Pause may call stop() again with an earlier time.
			osc.stop(end + 0.01);
			now = audioCtx.currentTime;
			kept = [];
			for (i = 0; i < liveOsc.length; i++) {
				if (liveOsc[i].end > now) kept.push(liveOsc[i]);
			}
			kept.push({ osc: osc, gain: gain, end: end + 0.01 });
			liveOsc = kept;
			return true;
		} catch (e) {
			return false;
		}
	}

	function readBlip(index, when) {
		tone("sine", blockFreq(index, cells.length - 1), when, 0.02, 0.03);
	}

	function moveBlip(index, when) {
		tone("triangle", blockFreq(index, cells.length - 1), when, 0.03, 0.028);
	}

	function writeBlip(index, when, fast) {
		var hz = blockFreq(index, cells.length - 1);
		var dur = fast ? 0.016 : 0.026;
		// Sine and square each take a slot, so the mix cannot slip past the cap.
		tone("sine", hz, when, dur, 0.02);
		tone("square", hz, when, dur, 0.008);
	}

	// A fragment is this data value living in more than one contiguous run.
	function isFragment(index) {
		var v, a, b, i;
		v = cells[index];
		if (v < 1 || v > 3) return false;
		a = index;
		while (a > 0 && cells[a - 1] === v) a--;
		b = index;
		while (b + 1 < cells.length && cells[b + 1] === v) b++;
		for (i = 0; i < a; i++) if (cells[i] === v) return true;
		for (i = b + 1; i < cells.length; i++) if (cells[i] === v) return true;
		return false;
	}

	function fragmentFound(index, when) {
		var hz = blockFreq(index, cells.length - 1);
		tone("sine", hz, when, 0.04, 0.03);
		tone("sine", hz * 0.67, when + 0.05, 0.045, 0.026);
	}

	function regionSweep(from, to, when) {
		var steps = 7;
		if (reduced) return;
		var i, idx, span;
		span = to - from;
		if (span < 1) span = 1;
		for (i = 0; i < steps; i++) {
			idx = from + Math.round(span * i / (steps - 1));
			tone("sine", blockFreq(idx, cells.length - 1), when + i * 0.022, 0.028, 0.028);
		}
	}

	function verifyScan(when) {
		var n = cells.length;
		if (reduced) return;
		var max = n - 1;
		var steps = 8;
		var i, idx;
		if (max < 1) return;
		for (i = 0; i < steps; i++) {
			idx = Math.round(max * i / (steps - 1));
			tone("sine", blockFreq(idx, max), when + i * 0.012, 0.016, 0.026);
		}
	}

	function regionJustFinished(index) {
		var v, a, b;
		v = final[index];
		if (v < 1 || v > 3 || cells[index] !== v) return null;
		a = index;
		while (a > 0 && final[a - 1] === v && cells[a - 1] === v) a--;
		b = index;
		while (b + 1 < cells.length && final[b + 1] === v && cells[b + 1] === v) b++;
		if (b !== index || b - a + 1 < 8) return null;
		if (b + 1 < cells.length && final[b + 1] === v) return null;
		return { from: a, to: b };
	}

	// The step timer sets the rhythm. At 2×, drop move blips and sample
	// reads so the four-voice cap stays intelligible.
	function sonifyStep(move, flashSec) {
		var when, fast;
		if (!soundOn()) return;
		when = audioCtx.currentTime;
		fast = speed > 1;
		stepSerial++;
		if (!fast || stepSerial % 2 === 0) readBlip(move.read, when);
		if (isFragment(move.read) && when - lastFragment > (fast ? 0.5 : 0.22)) {
			lastFragment = when;
			fragmentFound(move.read, when + 0.018);
		} else if (!fast) {
			moveBlip(move.read, when + 0.012);
		}
		writeBlip(move.write, when + flashSec, fast);
	}

	function sonifyCommit(move) {
		var when, region, gap;
		if (!soundOn()) return;
		when = audioCtx.currentTime;
		region = regionJustFinished(move.write);
		if (!region) return;
		// One sweep per frame. A batch can finish several runs; the rest wait
		// so the four-voice cap stays on the blips already sounding.
		gap = speed > 1 ? 0.12 : 0.2;
		if (when - lastSweep < gap) return;
		lastSweep = when;
		regionSweep(region.from, region.to, when + 0.08);
	}

	function shuffle(list) {
		var i, j, tmp;
		for (i = list.length - 1; i > 0; i--) {
			j = Math.floor(Math.random() * (i + 1));
			tmp = list[i];
			list[i] = list[j];
			list[j] = tmp;
		}
		return list;
	}

	function measureMap() {
		var w = mapWrap.clientWidth;
		var h = mapWrap.clientHeight;
		if (w < 48) w = Math.max(160, root.clientWidth - 8);
		// Four rows is the shortest map that still draws. A taller fallback
		// would be clipped by the half-height window.
		if (h < 36) h = 36;
		return { w: w, h: h };
	}

	function buildGrid() {
		var size = measureMap();
		cols = Math.max(8, Math.floor(size.w / 9));
		var visible = Math.max(4, Math.floor(size.h / 9));
		var rows = visible;
		if (cols * rows > 8000) rows = Math.max(4, Math.floor(8000 / cols));
		var n = cols * rows;
		// Fixed and bad blocks never move. They used to be about 16% of the
		// map and were sprinkled through every run. Keep about 4% of that
		// count, in one cluster between the data and the free space, so the
		// other blocks can consolidate instead of being skipped.
		var oldKeep = Math.max(2, Math.round(n * 0.012)) + Math.round(n * 0.15);
		var keep = Math.max(2, Math.round(oldKeep * 0.04));
		var badN = 1;
		var fixedN = keep - badN;
		var dataN = Math.round(n * 0.55);
		if (dataN + keep >= n) dataN = Math.max(3, n - keep - 1);
		var third = Math.floor(dataN / 3);
		var n1 = third;
		var n2 = third;
		var n3 = dataN - third - third;
		var clusterAt = dataN;
		var i;
		cells = new Array(n);
		final = new Array(n);
		for (i = 0; i < n; i++) {
			cells[i] = 0;
			final[i] = 0;
		}
		for (i = 0; i < fixedN; i++) {
			cells[clusterAt + i] = 5;
			final[clusterAt + i] = 5;
		}
		for (i = 0; i < badN; i++) {
			cells[clusterAt + fixedN + i] = 6;
			final[clusterAt + fixedN + i] = 6;
		}
		var movable = [];
		for (i = 0; i < clusterAt; i++) movable.push(i);
		for (i = clusterAt + keep; i < n; i++) movable.push(i);
		var values = [];
		for (i = 0; i < n1; i++) values.push(1);
		for (i = 0; i < n2; i++) values.push(2);
		for (i = 0; i < n3; i++) values.push(3);
		while (values.length < movable.length) values.push(0);
		for (i = 0; i < movable.length; i++) final[movable[i]] = values[i];
		var best = values.slice();
		var bestScore = -1;
		var attempt, trial, score;
		for (attempt = 0; attempt < 8; attempt++) {
			trial = values.slice();
			shuffle(trial);
			score = 0;
			for (i = 0; i < movable.length; i++) {
				if (trial[i] !== final[movable[i]]) score++;
			}
			if (score > bestScore) {
				bestScore = score;
				best = trial;
			}
		}
		for (i = 0; i < movable.length; i++) cells[movable[i]] = best[i];

		canvas.width = cols * 9;
		canvas.height = rows * 9;
		ctx = canvas.getContext("2d");
		badPat = null;
		if (ctx) ctx.imageSmoothingEnabled = false;
		fitMap();
	}

	// The bitmap stays the grid from when the run started. Maximize and
	// restore only change how big those cells are drawn, so every row stays
	// on screen and the map area does not go blank.
	function fitMap() {
		var w, h;
		if (!cols) return;
		w = mapWrap.clientWidth;
		h = mapWrap.clientHeight;
		if (w < 8 || h < 8) return;
		if (Math.abs(canvas.clientWidth - w) < 2 && Math.abs(canvas.clientHeight - h) < 2) return;
		canvas.style.width = w + "px";
		canvas.style.height = h + "px";
	}

	function countMismatches() {
		var i, n = 0;
		for (i = 0; i < cells.length; i++) if (cells[i] !== final[i]) n++;
		return n;
	}

	function peek() {
		var i, j, want;
		for (i = 0; i < final.length; i++) {
			if (cells[i] === final[i]) continue;
			want = final[i];
			for (j = 0; j < cells.length; j++) {
				if (j !== i && cells[j] === want && cells[j] !== final[j]) {
					return { read: j, write: i };
				}
			}
			return null;
		}
		return null;
	}

	function commit(move) {
		var displaced = cells[move.write];
		var tmp = cells[move.write];
		cells[move.write] = cells[move.read];
		cells[move.read] = tmp;
		swaps++;
		// The write slot is settled by construction. The read slot sometimes is too.
		fixes += displaced === final[move.read] ? 2 : 1;
	}

	function ensureBad() {
		if (badPat || !ctx) return;
		var tile = document.createElement("canvas");
		tile.width = 8;
		tile.height = 8;
		var g = tile.getContext("2d");
		g.fillStyle = "#c0c0c0";
		g.fillRect(0, 0, 8, 8);
		g.strokeStyle = "#808080";
		g.beginPath();
		var k;
		for (k = -8; k <= 8; k += 3) {
			g.moveTo(k, 8);
			g.lineTo(k + 8, 0);
		}
		g.stroke();
		badPat = ctx.createPattern(tile, "repeat");
	}

	function fill(x, y, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x, y, 8, 8);
	}

	function drawFixed(x, y) {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(x, y, 8, 8);
		ctx.strokeStyle = "#ff0000";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x + 1, y + 7);
		ctx.lineTo(x + 7, y + 1);
		ctx.stroke();
	}

	function draw() {
		if (!ctx) return;
		ensureBad();
		ctx.fillStyle = "#000000";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		var i, x, y, v;
		for (i = 0; i < cells.length; i++) {
			x = (i % cols) * 9;
			y = Math.floor(i / cols) * 9;
			if (flash && i === flash.read) {
				fill(x, y, "#00c000");
				continue;
			}
			if (flash && i === flash.write) {
				fill(x, y, "#ff0000");
				continue;
			}
			v = cells[i];
			if (v === 5) drawFixed(x, y);
			else if (v === 6) {
				ctx.fillStyle = badPat || "#808080";
				ctx.fillRect(x, y, 8, 8);
			} else if (v === 0) fill(x, y, "#ffffff");
			else if (v === final[i]) fill(x, y, "#000080");
			else if (v === 1) fill(x, y, "#00e0e0");
			else if (v === 2) fill(x, y, "#008080");
			else fill(x, y, "#202020");
		}
	}

	function updateProgress() {
		var total = 0;
		var settled = 0;
		var i, pct;
		for (i = 0; i < final.length; i++) {
			if (final[i] >= 1 && final[i] <= 3) {
				total++;
				if (cells[i] === final[i]) settled++;
			}
		}
		pct = total ? Math.floor(settled * 100 / total) : 0;
		if (phase !== "done" && pct > 99 && settled < total) pct = 99;
		if (phase === "done") pct = 100;
		pctGoal = pct;
		if (!pctT0) {
			pctShown = pctGoal;
			pctT0 = performance.now();
			renderPct(true);
			return;
		}
		pctT0 = performance.now();
		kickPaint();
	}

	function renderPct(snap) {
		var shown, width, gap, step;
		if (snap || phase === "done" || phase === "stopped" || phase === "paused") pctShown = pctGoal;
		else if (pctShown < pctGoal) {
			gap = pctGoal - pctShown;
			// One point per paint unless the bar is several points behind.
			step = gap > 4 ? gap * 0.5 : 1;
			if (step > gap) step = gap;
			pctShown += step;
		} else pctShown = pctGoal;
		shown = Math.round(pctShown);
		if (phase !== "done" && shown > 99 && pctGoal < 100) shown = 99;
		if (phase === "done") {
			shown = 100;
			pctShown = 100;
		}
		percentEl.textContent = shown + "% Complete";
		width = phase === "done" ? 100 : pctShown;
		barFill.style.width = width + "%";
	}

	function kickPaint() {
		if (paintRaf) return;
		var tick = function () {
			var snap = phase === "done" || phase === "stopped" || phase === "paused";
			renderPct(snap);
			if (!snap && pctGoal - pctShown > 0.2) paintRaf = requestAnimationFrame(tick);
			else paintRaf = 0;
		};
		paintRaf = requestAnimationFrame(tick);
	}

	function finish() {
		if (phase === "done" || phase === "stopped") return;
		phase = "done";
		clearTimer();
		pauseClock();
		flash = null;
		setStatus("Defragmentation complete.");
		setRunningButtons(false);
		updateProgress();
		renderPct(true);
		draw();
		if (soundOn()) verifyScan(audioCtx.currentTime + 0.04);
		show("done");
	}

	function stepMs() {
		return FRAME_MS;
	}

	function elapsedWork() {
		if (!clockStamp) return workMs;
		return workMs + (performance.now() - clockStamp) * speed;
	}

	function pauseClock() {
		if (!clockStamp) return;
		workMs += (performance.now() - clockStamp) * speed;
		clockStamp = 0;
	}

	function resumeClock() {
		clockStamp = performance.now();
	}

	function swapsLeft() {
		// A swap usually settles the write and sometimes the read too.
		// Start from that ratio so a short map does not burn its swaps
		// in the first frames and finish early.
		var rate = swaps > 0 ? fixes / swaps : 1.7;
		var left = countMismatches();
		if (!(rate >= 1)) rate = 1;
		if (left <= 0) return 0;
		return Math.ceil(left / rate);
	}

	// Spread the remaining swaps across the time still left in the run.
	// 2× burns the same 6s budget twice as fast, so it finishes in about 3s.
	function blocksThisFrame() {
		var left = swapsLeft();
		var remain, frames, budget;
		if (left <= 0) return 0;
		remain = RUN_MS - elapsedWork();
		if (remain <= FRAME_MS) return left;
		frames = (remain / speed) / FRAME_MS;
		if (!(frames > 0)) return left;
		budget = left / frames;
		// A short map has less than one swap per frame. Skip some frames
		// so it still fills the same 6s instead of ending early.
		if (budget < 1) {
			pace += budget;
			if (pace >= 1) {
				pace -= 1;
				return 1;
			}
			return 0;
		}
		return Math.min(left, Math.ceil(budget));
	}

	function doStep() {
		if (phase !== "run") return;
		var budget = blocksThisFrame();
		var i, move;
		if (budget < 1) {
			schedule(doStep, FRAME_MS);
			return;
		}
		if (reduced) {
			var last = null;
			for (i = 0; i < budget; i++) {
				move = peek();
				if (!move) break;
				commit(move);
				sonifyCommit(move);
				last = move;
			}
			flash = null;
			updateProgress();
			draw();
			if (last && audioCtx) writeBlip(last.write, audioCtx.currentTime, true);
			if (!peek()) finish();
			else schedule(doStep, FRAME_MS);
			return;
		}
		for (i = 0; i < budget - 1; i++) {
			move = peek();
			if (!move) break;
			commit(move);
			sonifyCommit(move);
		}
		move = peek();
		if (!move) {
			updateProgress();
			draw();
			finish();
			return;
		}
		flash = move;
		updateProgress();
		draw();
		var wait = stepMs();
		var flashMs = Math.min(40, wait * 0.6);
		if (flashMs < 8) flashMs = Math.min(8, wait);
		// One read/write tone for the whole frame. Region sweeps from the
		// batched commits above already went through sonifyCommit.
		sonifyStep(move, flashMs / 1000);
		schedule(function () {
			if (phase !== "run") return;
			commit(move);
			flash = null;
			sonifyCommit(move);
			updateProgress();
			draw();
			if (!peek()) finish();
			else schedule(doStep, Math.max(0, wait - flashMs));
		}, flashMs);
	}

	function startRun() {
		if (phase !== "select") return;
		readSpeed();
		ensureAudio();
		buildGrid();
		swaps = 0;
		fixes = 0;
		pace = 0;
		workMs = 0;
		clockStamp = performance.now();
		pctShown = 0;
		pctGoal = 0;
		phase = "run";
		restoreSelect = false;
		setStatus("Defragmenting file system...");
		setRunningButtons(true);
		show("none");
		updateProgress();
		draw();
		requestAnimationFrame(fitMap);
		schedule(doStep, FRAME_MS);
	}

	function pauseSim() {
		clearTimer();
		flash = null;
		pauseClock();
		stopVoices();
		if (cells.length) updateProgress();
		renderPct(true);
		draw();
	}

	function openStop() {
		if (current === "stop" || current === "select" || current === "done") return;
		if (phase !== "run" && phase !== "paused") return;
		resumeAfterNo = phase === "run";
		pauseSim();
		stopBtn.disabled = true;
		pauseBtn.disabled = true;
		show("stop");
	}

	function cancelStop() {
		show("none");
		if (phase === "run" || phase === "paused") {
			stopBtn.disabled = false;
			pauseBtn.disabled = false;
		}
		if (resumeAfterNo && phase === "run") {
			resumeClock();
			schedule(doStep, stepMs());
		}
		resumeAfterNo = false;
	}

	function confirmStop() {
		phase = "stopped";
		resumeAfterNo = false;
		pauseSim();
		setStatus("Defragmentation was stopped.");
		setRunningButtons(false);
		show("none");
		updateProgress();
	}

	function openLegend() {
		if (current === "stop") return;
		if (current === "select") restoreSelect = true;
		show("legend");
	}

	function closeLegend() {
		if (restoreSelect && phase === "select") show("select");
		else {
			show("none");
			restoreSelect = false;
		}
	}

	function openSettings() {
		if (current === "stop") return;
		if (current === "select") restoreSelect = true;
		show("settings");
	}

	function closeSettings() {
		if (restoreSelect && phase === "select") show("select");
		else {
			show("none");
			restoreSelect = false;
		}
	}

	function closeDone() {
		if (current === "done") show("none");
	}

	document.getElementById("defrag-ok").addEventListener("click", startRun);
	document.getElementById("defrag-cancel").addEventListener("click", goHome);
	document.getElementById("defrag-exit").addEventListener("click", goHome);
	document.getElementById("defrag-legend-btn").addEventListener("click", openLegend);
	document.getElementById("defrag-legend-close").addEventListener("click", closeLegend);
	document.getElementById("defrag-settings-btn").addEventListener("click", openSettings);
	document.getElementById("defrag-settings-close").addEventListener("click", closeSettings);
	stopBtn.addEventListener("click", openStop);
	document.getElementById("defrag-yes").addEventListener("click", confirmStop);
	document.getElementById("defrag-no").addEventListener("click", cancelStop);
	document.getElementById("defrag-done-ok").addEventListener("click", closeDone);

	pauseBtn.addEventListener("click", function () {
		if (current === "stop" || current === "select" || current === "done") return;
		if (phase === "run") {
			phase = "paused";
			pauseSim();
			setStatus("Paused");
			pauseBtn.textContent = "Resume";
		} else if (phase === "paused") {
			phase = "run";
			setStatus("Defragmenting file system...");
			pauseBtn.textContent = "Pause";
			if (asmr && asmr.checked) ensureAudio();
			resumeClock();
			schedule(doStep, stepMs());
		}
	});

	detailsBtn.addEventListener("click", function () {
		var compact = wrap && wrap.classList.toggle("is-defrag-compact");
		detailsBtn.textContent = compact ? "Show Details" : "Hide Details";
		if (!compact) requestAnimationFrame(fitMap);
	});

	var maxBtn = document.querySelector(".defrag-max");
	var restoreBtn = document.querySelector(".defrag-restore");
	if (wrap && maxBtn && restoreBtn) {
		maxBtn.addEventListener("click", function () {
			wrap.classList.add("is-max");
			maxBtn.setAttribute("aria-pressed", "true");
			requestAnimationFrame(fitMap);
		});
		restoreBtn.addEventListener("click", function () {
			wrap.classList.remove("is-max");
			maxBtn.setAttribute("aria-pressed", "false");
			requestAnimationFrame(fitMap);
		});
	}
	if (window.ResizeObserver) {
		new ResizeObserver(function () {
			fitMap();
		}).observe(mapWrap);
	} else {
		window.addEventListener("resize", fitMap);
	}

	asmr.addEventListener("change", function () {
		try {
			localStorage.setItem(ASM_KEY, asmr.checked ? "1" : "0");
		} catch (e) {}
		if (asmr.checked) ensureAudio();
		else stopVoices();
	});

	document.addEventListener("click", function () {
		if (asmr && asmr.checked) ensureAudio();
	}, true);

	Array.prototype.forEach.call(document.querySelectorAll('input[name="defrag-speed"]'), function (input) {
		input.addEventListener("change", function () {
			if (clockStamp) {
				workMs += (performance.now() - clockStamp) * speed;
				clockStamp = performance.now();
			}
			readSpeed();
			if (phase === "run" && !flash) schedule(doStep, stepMs());
		});
	});

	document.addEventListener("click", function (event) {
		var btn = event.target.closest ? event.target.closest("[data-act]") : null;
		if (!btn) return;
		var act = btn.getAttribute("data-act");
		if (act === "select-close") goHome();
		else if (act === "legend-close") closeLegend();
		else if (act === "settings-close") closeSettings();
		else if (act === "stop-no") cancelStop();
		else if (act === "done-ok") closeDone();
	});

	document.addEventListener("keydown", function (event) {
		if (event.key !== "Escape") return;
		if (current === "select") goHome();
		else if (current === "stop") cancelStop();
		else if (current === "done") closeDone();
		else if (current === "legend") closeLegend();
		else if (current === "settings") closeSettings();
	});

	Object.keys(dialogs).forEach(function (key) {
		if (dialogs[key] && dialogs[key].parentNode !== document.body) {
			document.body.appendChild(dialogs[key]);
		}
	});
	show("select");
})();
