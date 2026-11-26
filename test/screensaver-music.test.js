const test = require("node:test");
const assert = require("node:assert/strict");
const {
	SONG, PART_SECONDS, LOOP_SECONDS, STEP_SECONDS, positionAt, below, chord, melody
} = require("../assets/js/screensaver-music.js");

test("five sections use the arranged bar layout", function () {
	assert.equal(SONG.length, 5);
	const barKeys = [
		"chord", "lead", "leadVoice", "echo", "harmony", "stab", "stabVoice",
		"arp", "arpVoice", "bass", "bassVoice", "drums"
	];
	const drumKinds = new Set(["k", "s", "h", "o", "c"]);
	const bassValues = new Set(["R", "O", "F", "L"]);
	SONG.forEach(function (section, i) {
		assert.equal(section.bars.length, 8);
		assert.ok(section.riser === null || (
			Number.isInteger(section.riser.bar) &&
			Number.isInteger(section.riser.bars) &&
			section.riser.bar + section.riser.bars <= 8
		), "section " + (i + 1) + " riser");
		section.bars.forEach(function (bar, j) {
			const label = "section " + (i + 1) + ", bar " + (j + 1);
			assert.deepEqual(Object.keys(bar), barKeys, label);
			assert.ok(bar.harmony === null || bar.harmony === "fifth" || bar.harmony === "third", label);

			assert.equal(bar.lead.length, 16, label);
			assert.equal(bar.lead.total, 16, label);
			let hasLead = false;
			for (let step = 0; step < 16; step++) {
				const note = bar.lead[step];
				if (!note) continue;
				hasLead = true;
				assert.ok(Number.isInteger(note.note) && note.note >= 60 && note.note <= 90, label);
				assert.ok(note.length > 0 && step + note.length <= 16, label);
				assert.ok(note.scoop === 0 || note.scoop === -2, label);
			}
			if (hasLead) assert.ok(bar.leadVoice, label);

			assert.equal(bar.stab.length, 16, label);
			let hasStab = false;
			for (let step = 0; step < 16; step++) {
				const stab = bar.stab[step];
				if (!stab) continue;
				hasStab = true;
				assert.ok(stab.length > 0 && step + stab.length <= 16, label);
				assert.equal(typeof stab.value, "string", label);
			}
			if (hasStab) assert.ok(bar.stabVoice, label);

			assert.equal(bar.bass.length, 16, label);
			let hasBass = false;
			for (let step = 0; step < 16; step++) {
				const bass = bar.bass[step];
				if (!bass) continue;
				hasBass = true;
				assert.ok(bassValues.has(bass.value), label);
				assert.ok(bass.length > 0 && step + bass.length <= 16, label);
			}
			if (hasBass) assert.ok(bar.bassVoice, label);

			assert.equal(bar.arp.length, 16, label);
			let hasArp = false;
			bar.arp.forEach(function (mark) {
				assert.ok(mark === "." || /^[0-5]$/.test(mark), label);
				if (mark !== ".") hasArp = true;
			});
			if (hasArp) assert.ok(bar.arpVoice, label);

			assert.equal(bar.drums.length, 16, label);
			bar.drums.forEach(function (hits) {
				assert.ok(Array.isArray(hits), label);
				hits.forEach(function (hit) {
					assert.equal(hit.length, 2, label);
					assert.ok(drumKinds.has(hit[0]), label);
					assert.ok(hit[1] > 0 && hit[1] <= 1, label);
				});
			});
		});
	});
	assert.deepEqual(chord("Am"), { bass: 45, tones: [69, 72, 76] });
	assert.deepEqual(chord("Bb"), { bass: 46, tones: [70, 74, 77] });
	assert.deepEqual(chord("E"), { bass: 40, tones: [64, 68, 71] });
	assert.equal(below(76, chord("Am")), 72);
	assert.equal(below(83, chord("E")), 80);
	assert.equal(below(81, chord("F")), 77);
	const hook = melody("E5:2 A5:4^ r:10");
	assert.equal(hook.total, 16);
	assert.deepEqual(hook[0], { note: 76, length: 2, scoop: 0 });
	assert.deepEqual(hook[2], { note: 81, length: 4, scoop: -2 });
});

test("normal playback has 32 beats per part and wraps after 70 seconds", function () {
	assert.equal(PART_SECONDS, 14);
	assert.equal(LOOP_SECONDS, 70);
	assert.equal(STEP_SECONDS * 4 * 32, PART_SECONDS);
	assert.deepEqual(positionAt(0), { scene: 0, part: 0, pass: 0, bar: 0, step: 0, partTime: 0 });
	assert.deepEqual(positionAt(STEP_SECONDS * 19), {
		scene: 0, part: 0, pass: 0, bar: 1, step: 3, partTime: STEP_SECONDS * 19
	});
	for (let part = 1; part <= SONG.length; part++) {
		const edge = PART_SECONDS * part;
		assert.equal(positionAt(edge - 0.001).part, part - 1);
		assert.equal(positionAt(edge - 0.001).bar, 7);
		assert.equal(positionAt(edge - 0.001).step, 15);
		assert.deepEqual(positionAt(edge), {
			scene: part, part: part % SONG.length, pass: 0, bar: 0, step: 0, partTime: 0
		});
	}
});

test("reduced motion repeats each music section at the same tempo", function () {
	assert.equal(positionAt(PART_SECONDS - 0.001, true).bar, 7);
	assert.deepEqual(positionAt(PART_SECONDS, true), {
		scene: 0, part: 0, pass: 1, bar: 0, step: 0, partTime: 7
	});
	assert.deepEqual(positionAt(PART_SECONDS + STEP_SECONDS * 19, true), {
		scene: 0, part: 0, pass: 1, bar: 1, step: 3, partTime: (PART_SECONDS + STEP_SECONDS * 19) / 2
	});
	for (let part = 1; part <= SONG.length; part++) {
		const edge = PART_SECONDS * part * 2;
		assert.equal(positionAt(edge - 0.001, true).part, part - 1);
		assert.equal(positionAt(edge - 0.001, true).pass, 1);
		assert.deepEqual(positionAt(edge, true), {
			scene: part, part: part % SONG.length, pass: 0, bar: 0, step: 0, partTime: 0
		});
	}
});
