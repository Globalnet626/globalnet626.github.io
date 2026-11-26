// gleebsal.scr soundtrack: one A minor hook told five ways.
(function (root) {
	var PART_SECONDS = 14;
	var STEPS_PER_BAR = 16;
	var BARS_PER_SECTION = 8;
	var STEPS_PER_SECTION = STEPS_PER_BAR * BARS_PER_SECTION;
	var STEP_SECONDS = PART_SECONDS / STEPS_PER_SECTION;
	// Chord arpeggios flip notes five times a step, close to a 50 Hz tracker tick.
	var ARP_TICK = STEP_SECONDS / 5;
	var ECHO_STEPS = 3;
	// About -29 dBFS RMS over a loop, peaking near -14 dBFS.
	var LEVEL = 0.206;
	var FADE_IN = 1.5;
	var FADE_OUT = 0.2;
	var LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
	var BASS_STEP = { R: 0, O: 12, F: 7, L: -12 };
	var NONE = "................";

	function accidental(sign) {
		return sign === "#" ? 1 : sign === "b" ? -1 : 0;
	}

	function midi(name) {
		var m = /^([A-G])([#b]?)(\d)$/.exec(name);
		return 12 * (Number(m[3]) + 1) + LETTER[m[1]] + accidental(m[2]);
	}

	// Root position, C4 to B4. Stabs and pads drop an octave, the bass sits at E2 to D#3.
	function chord(name) {
		var m = /^([A-G])([#b]?)(m?)(7?)$/.exec(name);
		var pc = (LETTER[m[1]] + accidental(m[2]) + 12) % 12;
		var shape = m[3] ? [0, 3, 7] : [0, 4, 7];
		if (m[4]) shape.push(10);
		return {
			bass: 40 + (pc + 8) % 12,
			tones: shape.map(function (i) { return 60 + pc + i; })
		};
	}

	// "E5:2 A5:4^ r:2": note or rest, length in steps, ^ scoops up from a tone below.
	function melody(text) {
		var notes = [];
		var step = 0;
		text.split(" ").forEach(function (token) {
			var m = /^(r|[A-G][#b]?\d):(\d+)(\^?)$/.exec(token);
			var length = Number(m[2]);
			if (m[1] !== "r") notes[step] = { note: midi(m[1]), length: length, scoop: m[3] ? -2 : 0 };
			step += length;
		});
		notes.length = STEPS_PER_BAR;
		notes.total = step;
		return notes;
	}

	// One character a step: a hit, "-" holds the one before, "." is silence.
	function rhythm(text) {
		var hits = [];
		for (var i = 0; i < text.length; i++) {
			if (text[i] === "-" || text[i] === ".") continue;
			var length = 1;
			while (text[i + length] === "-") length++;
			hits[i] = { value: text[i], length: length };
		}
		hits.length = STEPS_PER_BAR;
		return hits;
	}

	function kit(k, s, h, c) {
		var lanes = { k: k || NONE, s: s || NONE, h: h || NONE, c: c || NONE };
		var steps = [];
		for (var i = 0; i < STEPS_PER_BAR; i++) {
			var hits = [];
			Object.keys(lanes).forEach(function (lane) {
				var mark = lanes[lane][i];
				if (mark === ".") return;
				if (lane === "h" && mark === "o") hits.push(["o", 1]);
				else hits.push([lane, mark === "x" ? 1 : Number(mark) / 9]);
			});
			steps.push(hits);
		}
		return steps;
	}

	function pick(value, bar) {
		return Array.isArray(value) ? value[bar] : value;
	}

	function section(spec) {
		var bars = [];
		for (var b = 0; b < BARS_PER_SECTION; b++) {
			bars.push({
				chord: chord(spec.chords[b]),
				lead: melody(pick(spec.lead, b)),
				leadVoice: pick(spec.leadVoice, b),
				echo: !!pick(spec.echo, b),
				harmony: pick(spec.harmony, b) || null,
				stab: rhythm(pick(spec.stab, b) || NONE),
				stabVoice: spec.stabVoice,
				arp: (pick(spec.arp, b) || NONE).split(""),
				arpVoice: spec.arpVoice,
				bass: rhythm(pick(spec.bass, b)),
				bassVoice: spec.bassVoice,
				drums: pick(spec.drums, b) || kit()
			});
		}
		return { bars: bars, riser: spec.riser || null };
	}

	function repeat(value, count) {
		var list = [];
		for (var i = 0; i < count; i++) list.push(value);
		return list;
	}

	// The hook: up a fourth, a turn, then a falling answer. Bars 3-4 sequence bars 1-2.
	var HOOK = [
		"E5:2 A5:2 G5:2 A5:4^ C6:2 B5:2 G5:2",
		"A5:6 G5:2 F5:2 E5:2 C5:4",
		"G5:2 C6:2 B5:2 C6:4^ D6:2 C6:2 B5:2",
		"B5:6 A5:2 G5:2 D5:2 G5:4",
		"A5:2 D6:2 C6:2 A5:4^ F5:2 E5:2 D5:2",
		"E5:3 G#5:3 B5:10"
	];
	var THEME = [HOOK[0], HOOK[1], HOOK[2], HOOK[3], HOOK[0], HOOK[1], HOOK[4], HOOK[5]];
	var THEME_CHORDS = ["Am", "F", "C", "G", "Am", "F", "Dm", "E"];

	var DREAM = { duty: 0.5, pwm: 0.18, pwmRate: 0.35, vibrato: 14, level: 0.75, attack: 0.08, decay: 0.6, sustain: 0.75, release: 0.35, gate: 1 };
	var SING = { duty: 0.25, pwm: 0.1, pwmRate: 0.7, vibrato: 16, level: 1, attack: 0.005, decay: 0.3, sustain: 0.72, release: 0.06, gate: 0.94 };
	var GLIDE = { duty: 0.25, pwm: 0.16, pwmRate: 0.22, vibrato: 18, level: 0.95, attack: 0.015, decay: 0.5, sustain: 0.8, release: 0.12, gate: 1 };
	var CHUG = { duty: 0.5, pwm: 0.12, pwmRate: 3.2, vibrato: 0, level: 1.1, attack: 0.003, decay: 0.16, sustain: 0.55, release: 0.04, gate: 0.82 };
	var WAIL = { duty: 0.25, pwm: 0.12, pwmRate: 0.9, vibrato: 26, level: 1, attack: 0.01, decay: 0.4, sustain: 0.8, release: 0.1, gate: 1 };
	var SOAR = { duty: 0.25, pwm: 0.1, pwmRate: 0.7, vibrato: 18, level: 1.05, attack: 0.005, decay: 0.3, sustain: 0.75, release: 0.07, gate: 0.94 };

	var PAD = { channel: "pad", duty: 0.5, level: 1, attack: 0.35, decay: 0, sustain: 1, release: 0.5, gate: 1 };
	var EMBER = { channel: "pad", duty: 0.5, level: 0.9, attack: 0.25, decay: 0, sustain: 1, release: 0.4, gate: 1 };
	var STAB = { channel: "stab", duty: 0.25, level: 1, attack: 0.003, decay: 0.1, sustain: 0.45, release: 0.04, gate: 0.9 };
	var TICK = { duty: 0.125, level: 1, attack: 0.002, decay: 0.06, sustain: 0.5, release: 0.03, gate: 0.75 };

	var HUM = { cutoff: 260, q: 1, level: 0.75, decay: 0.5, sustain: 0.8, gate: 0.98 };
	var BOUNCE = { cutoff: 480, q: 4, level: 1, decay: 0.1, sustain: 0.6, gate: 0.85 };
	var GALLOP = { cutoff: 420, q: 5, level: 0.95, decay: 0.08, sustain: 0.5, gate: 0.8 };
	var GROWL = { cutoff: 340, q: 3, level: 1.15, decay: 0.2, sustain: 0.7, gate: 0.95 };

	var CRASH = "x...............";
	var BREAK = ["x.....x...x.....", "....x.......x...", "3.x.3.x.3.x.3.o."];
	var FOUR = ["x...x...x...x...", "....x.......x...", "3151315131513151"];
	var HALF = ["x..x..x....x....", "........x.....2.", "5.5.5.5.5.5.5.5."];
	var RUSH = ["x...x...x...x...", "....x.......x...", "3.6.3.6.3.6.3.6."];
	var LIFT = ["x...x...x...x.x.", "....x..2....x...", "31513151315131o1"];

	function beat(lanes, crash, snare) {
		return kit(lanes[0], snare || lanes[1], lanes[2], crash ? CRASH : null);
	}

	var SONG = [
		// Starfield: a pad breathes, the hook is only hinted, and a riser meets the stars' speed-up.
		section({
			chords: ["Am", "Am", "F", "F", "C", "C", "G", "E"],
			lead: ["r:16", "r:16", "r:4 A5:12", "G5:4 F5:4 E5:8", "r:4 G5:12", "C6:4 B5:4 G5:8",
				"r:8 E5:2 A5:2 G5:2 A5:2", "B5:16"],
			leadVoice: DREAM,
			echo: true,
			stab: "x---------------",
			stabVoice: PAD,
			bass: ["R---------------", "R---------------", "R---------------", "R---------------",
				"R-------O-------", "R-------O-------", "R---R---R---R---", "R-R-R-R-R-R-R-R-"],
			bassVoice: HUM,
			drums: [kit(), kit(), kit(), kit(),
				kit(null, null, "..4...4...4...4."),
				kit(null, null, "..5...5...5...5."),
				kit("x...x...x...x...", null, "..6...6...6...6."),
				kit("x...x...x...x...", "1122334455667789")],
			riser: { bar: 5, bars: 3, level: 1 }
		}),
		// Plasma: the hook in full over a broken beat and offbeat chord stabs.
		section({
			chords: THEME_CHORDS,
			lead: THEME,
			leadVoice: SING,
			echo: true,
			stab: repeat("..x-..x-..x-..x-", 7).concat("x--x--x---------"),
			stabVoice: STAB,
			bass: repeat("R.O.R.O.R.O.R.O.", 7).concat("R..R..R---------"),
			bassVoice: BOUNCE,
			drums: [beat(BREAK, true), beat(BREAK), beat(BREAK),
				kit("x.....x...x...x.", "....x.......x.3.", BREAK[2]),
				beat(BREAK, true), beat(BREAK), beat(BREAK),
				kit("x..x..x.........", "......x...5.6789", "x..x..x.........")]
		}),
		// Tunnel: a falling A-G-F-E line, a 3-against-4 arpeggio, then the hook over new chords.
		section({
			chords: ["Am", "G", "F", "E", "Am", "G", "F", "E"],
			lead: ["C6:12 D6:2 C6:2", "B5:12 C6:2 B5:2", "A5:12 B5:2 A5:2", "G#5:16",
				HOOK[0], HOOK[3], HOOK[1], "B4:4 E5:4 G#5:4 B5:4"],
			leadVoice: GLIDE,
			echo: true,
			arp: "0120120120120120",
			arpVoice: TICK,
			bass: "R.RRR.RRR.RRO.OO",
			bassVoice: GALLOP,
			drums: [beat(FOUR, true), beat(FOUR), beat(FOUR), beat(FOUR, false, "....x.......x.xx"),
				beat(FOUR, true), beat(FOUR), beat(FOUR),
				kit(FOUR[0], "....x...x.x.6789", "31513151315.....")]
		}),
		// Fire: a half-time power riff on A and B flat, then a wailing lead that climbs out.
		section({
			chords: ["Am", "Bb", "Am", "Bb", "F", "E", "Dm", "E"],
			lead: ["A4:3 A4:3 A4:2 C5:3 A4:3 G4:2", "Bb4:3 Bb4:3 Bb4:2 D5:3 Bb4:3 F4:2",
				"A4:3 A4:3 A4:2 E5:3 D5:3 C5:2", "Bb4:3 Bb4:3 Bb4:2 F5:3 D5:3 C5:2",
				"A5:4 C6:4 A5:2 G5:2 F5:4", "G#5:6 B5:2 E6:8^", "D6:4 C6:4 A5:4 F5:4", "B5:4 G#5:4 E5:4 D5:2 B4:2"],
			leadVoice: [CHUG, CHUG, CHUG, CHUG, WAIL, WAIL, WAIL, WAIL],
			echo: [false, false, false, false, true, true, true, true],
			harmony: ["fifth", "fifth", "fifth", "fifth", null, null, null, null],
			stab: "x---------------",
			stabVoice: EMBER,
			bass: repeat("L--L--L-L--L--L-", 4).concat(repeat("R.R.R.R.R.R.R.R.", 3), "R.R.R.R.R.R.O.O."),
			bassVoice: GROWL,
			drums: [beat(HALF, true), beat(HALF), beat(HALF), beat(HALF, false, "........x...x.xx"),
				beat(RUSH, true), beat(RUSH), beat(RUSH),
				kit(RUSH[0], "....x...5.6.7899", "3.6.3.6.3.6.....")],
			riser: { bar: 7, bars: 1, level: 0.8 }
		}),
		// Glenz: the hook comes home with a harmony line, eighth-note stabs and a final hit.
		section({
			chords: THEME_CHORDS,
			lead: THEME,
			leadVoice: SOAR,
			harmony: "third",
			stab: repeat("x-x-x-x-x-x-x-x-", 7).concat("x--x--x---------"),
			stabVoice: STAB,
			bass: repeat("R.ORR.ORR.ORR.OR", 7).concat("R..R..R---------"),
			bassVoice: BOUNCE,
			drums: [beat(LIFT, true), beat(LIFT), beat(LIFT, true), beat(LIFT, false, "....x.......5789"),
				beat(LIFT, true), beat(LIFT), beat(LIFT, true),
				kit("x..x..x.........", "x..x..x.........", null, "x.....x.........")]
		})
	];
	var LOOP_SECONDS = PART_SECONDS * SONG.length;

	function positionAt(seconds, reduced) {
		var section = Math.floor(seconds / PART_SECONDS);
		var local = seconds - section * PART_SECONDS;
		var step = Math.floor(local / STEP_SECONDS);
		var repeats = reduced ? 2 : 1;
		var scene = Math.floor(section / repeats);
		var pass = section % repeats;
		return {
			scene: scene,
			part: scene % SONG.length,
			pass: pass,
			bar: Math.floor(step / STEPS_PER_BAR),
			step: step % STEPS_PER_BAR,
			partTime: (pass * PART_SECONDS + local) / repeats
		};
	}

	function frequency(note) {
		return 440 * Math.pow(2, (note - 69) / 12);
	}

	function pulse(context, duty) {
		var real = new Float32Array(64);
		var imag = new Float32Array(64);
		for (var i = 1; i < real.length; i++) real[i] = 2 * Math.sin(Math.PI * i * duty) / (Math.PI * i);
		return context.createPeriodicWave(real, imag);
	}

	// The nearest chord tone at least a minor third under the melody.
	function below(note, chord) {
		var pcs = chord.tones.map(function (t) { return t % 12; });
		for (var n = note - 3; n > note - 15; n--) {
			if (pcs.indexOf(n % 12) >= 0) return n;
		}
		return note - 12;
	}

	function makeSynth(context, solo) {
		var bus = context.createGain();
		var lowCut = context.createBiquadFilter();
		var squash = context.createDynamicsCompressor();
		var master = context.createGain();
		lowCut.type = "highpass";
		lowCut.frequency.value = 28;
		squash.threshold.value = -18;
		squash.knee.value = 10;
		squash.ratio.value = 3;
		squash.attack.value = 0.004;
		squash.release.value = 0.18;
		master.gain.value = 0;
		// Half level into the compressor, so it rounds off peaks instead of pumping.
		bus.gain.value = 0.5;
		bus.connect(lowCut);
		lowCut.connect(squash);
		squash.connect(master);
		master.connect(context.destination);
		var waves = { 0.125: pulse(context, 0.125), 0.25: pulse(context, 0.25), 0.5: pulse(context, 0.5) };
		var noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
		var samples = noise.getChannelData(0);
		var seed = 90210;
		for (var i = 0; i < samples.length; i++) {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			samples[i] = seed / 2147483648 - 1;
		}
		var voices = [];
		var hitCount = 0;

		function channel(name, level, pan, lowpass) {
			var input = context.createGain();
			var node = input;
			input.gain.value = solo && solo !== name ? 0 : level;
			if (lowpass) {
				var filter = context.createBiquadFilter();
				filter.type = "lowpass";
				filter.frequency.value = lowpass;
				node.connect(filter);
				node = filter;
			}
			if (pan && context.createStereoPanner) {
				var panner = context.createStereoPanner();
				panner.pan.value = pan;
				node.connect(panner);
				node = panner;
			}
			node.connect(bus);
			return input;
		}

		var mix = {
			lead: channel("lead", 0.22, 0),
			echo: channel("echo", 0.075, 0.45, 2800),
			harmony: channel("harmony", 0.17, -0.25),
			stab: channel("stab", 0.21, -0.35),
			pad: channel("pad", 0.055, 0, 1400),
			arp: channel("arp", 0.26, -0.4),
			bass: channel("bass", 0.3, 0),
			kick: channel("kick", 0.7, 0),
			snare: channel("snare", 2.2, 0.05),
			hats: channel("hats", 0.8, 0.2),
			crash: channel("crash", 0.35, -0.1),
			riser: channel("riser", 0.3, 0)
		};

		function play(sources, nodes, at, stop, offset) {
			var voice = { sources: sources, nodes: nodes, end: stop };
			voices.push(voice);
			sources[0].onended = function () {
				release(voice);
				var i = voices.indexOf(voice);
				if (i >= 0) voices.splice(i, 1);
			};
			sources.forEach(function (source) {
				if (source.buffer) source.start(at, offset || 0);
				else source.start(at);
				source.stop(stop);
			});
		}

		function release(voice) {
			voice.sources[0].onended = null;
			voice.sources.concat(voice.nodes).forEach(function (node) { node.disconnect(); });
		}

		// Attack, decay toward sustain, hold to the end of the note, then release.
		function envelope(dest, at, length, level, shape) {
			var gain = context.createGain();
			var g = gain.gain;
			var end = at + length;
			var peak = at + Math.min(shape.attack, length);
			g.setValueAtTime(0, at);
			g.linearRampToValueAtTime(level, peak);
			if (shape.decay) {
				var tau = shape.decay / 3;
				var floor = level * shape.sustain;
				g.setTargetAtTime(floor, peak, tau);
				g.setValueAtTime(floor + (level - floor) * Math.exp(-(end - peak) / tau), end);
			} else {
				g.setValueAtTime(level, end);
			}
			g.linearRampToValueAtTime(0, end + shape.release);
			gain.connect(dest);
			return { node: gain, stop: end + shape.release + 0.02 };
		}

		// A sawtooth minus a delayed copy of itself is a pulse. Sweeping the delay is PWM.
		function lead(dest, note, at, length, voice, scoop, level) {
			var f = frequency(note);
			var osc = context.createOscillator();
			var delay = context.createDelay(0.05);
			var invert = context.createGain();
			var env = envelope(dest, at, length, (level || 1) * voice.level, voice);
			var sources = [osc];
			var nodes = [delay, invert, env.node];
			osc.type = "sawtooth";
			osc.frequency.value = f;
			delay.delayTime.value = voice.duty / f;
			invert.gain.value = -1;
			osc.connect(env.node);
			osc.connect(delay);
			delay.connect(invert);
			invert.connect(env.node);
			if (voice.pwm) {
				var sweep = context.createOscillator();
				var width = context.createGain();
				sweep.frequency.value = voice.pwmRate;
				width.gain.value = voice.pwm / f;
				sweep.connect(width);
				width.connect(delay.delayTime);
				sources.push(sweep);
				nodes.push(width);
			}
			if (voice.vibrato && length > 0.25) {
				var wobble = context.createOscillator();
				var depth = context.createGain();
				wobble.frequency.value = 5.6;
				depth.gain.setValueAtTime(0, at);
				depth.gain.setValueAtTime(0, at + 0.14);
				depth.gain.linearRampToValueAtTime(voice.vibrato, at + 0.42);
				wobble.connect(depth);
				depth.connect(osc.detune);
				sources.push(wobble);
				nodes.push(depth);
			}
			if (scoop) {
				osc.detune.setValueAtTime(scoop * 100, at);
				osc.detune.linearRampToValueAtTime(0, at + 0.06);
			}
			play(sources, nodes, at, env.stop);
		}

		function chordArp(tones, at, length, voice) {
			var osc = context.createOscillator();
			var env = envelope(mix[voice.channel], at, length, voice.level, voice);
			osc.setPeriodicWave(waves[voice.duty]);
			for (var t = 0, i = 0; t < length + voice.release; t += ARP_TICK, i++) {
				osc.frequency.setValueAtTime(frequency(tones[i % tones.length]), at + t);
			}
			osc.connect(env.node);
			play([osc], [env.node], at, env.stop);
		}

		function tone(dest, note, at, length, voice) {
			var osc = context.createOscillator();
			var env = envelope(dest, at, length, voice.level, voice);
			osc.setPeriodicWave(waves[voice.duty]);
			osc.frequency.value = frequency(note);
			osc.connect(env.node);
			play([osc], [env.node], at, env.stop);
		}

		function bass(note, at, length, voice) {
			var osc = context.createOscillator();
			var filter = context.createBiquadFilter();
			var env = envelope(mix.bass, at, length, voice.level, {
				attack: 0.003, decay: voice.decay, sustain: voice.sustain, release: 0.03
			});
			osc.setPeriodicWave(waves[0.5]);
			osc.frequency.value = frequency(note);
			filter.type = "lowpass";
			filter.Q.value = voice.q;
			filter.frequency.setValueAtTime(voice.cutoff * 3.5, at);
			filter.frequency.setTargetAtTime(voice.cutoff, at, 0.05);
			osc.connect(filter);
			filter.connect(env.node);
			play([osc], [filter, env.node], at, env.stop);
		}

		function noiseHit(dest, at, level, type, freq, q, decay) {
			var source = context.createBufferSource();
			var filter = context.createBiquadFilter();
			var gain = context.createGain();
			source.buffer = noise;
			source.loop = true;
			filter.type = type;
			filter.frequency.value = freq;
			filter.Q.value = q;
			gain.gain.setValueAtTime(0, at);
			gain.gain.linearRampToValueAtTime(level, at + 0.001);
			gain.gain.exponentialRampToValueAtTime(level * 0.001, at + decay);
			gain.gain.linearRampToValueAtTime(0, at + decay + 0.005);
			source.connect(filter);
			filter.connect(gain);
			gain.connect(dest);
			play([source], [filter, gain], at, at + decay + 0.01, (hitCount++ * 0.173) % 1.6);
		}

		function thump(dest, at, level, from, to, drop, decay, type) {
			var osc = context.createOscillator();
			var gain = context.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(from, at);
			osc.frequency.exponentialRampToValueAtTime(to, at + drop);
			gain.gain.setValueAtTime(0, at);
			gain.gain.linearRampToValueAtTime(level, at + 0.002);
			gain.gain.exponentialRampToValueAtTime(level * 0.001, at + decay);
			gain.gain.linearRampToValueAtTime(0, at + decay + 0.005);
			osc.connect(gain);
			gain.connect(dest);
			play([osc], [gain], at, at + decay + 0.01);
		}

		function drum(kind, velocity, at) {
			if (kind === "k") {
				thump(mix.kick, at, velocity, 170, 48, 0.07, 0.26, "sine");
				noiseHit(mix.kick, at, velocity * 0.35, "highpass", 3000, 0.7, 0.006);
			} else if (kind === "s") {
				noiseHit(mix.snare, at, velocity * 0.9, "bandpass", 1900, 0.7, 0.15);
				thump(mix.snare, at, velocity * 0.55, 220, 150, 0.06, 0.09, "triangle");
			} else if (kind === "h") {
				noiseHit(mix.hats, at, velocity, "highpass", 7500, 0.7, 0.035);
			} else if (kind === "o") {
				noiseHit(mix.hats, at, 0.8, "highpass", 6500, 0.7, 0.22);
			} else if (kind === "c") {
				noiseHit(mix.crash, at, velocity, "highpass", 4500, 0.5, 1.3);
			}
		}

		function riser(at, length, level) {
			var source = context.createBufferSource();
			var filter = context.createBiquadFilter();
			var gain = context.createGain();
			source.buffer = noise;
			source.loop = true;
			filter.type = "bandpass";
			filter.Q.value = 1.5;
			filter.frequency.setValueAtTime(250, at);
			filter.frequency.exponentialRampToValueAtTime(7000, at + length);
			gain.gain.setValueAtTime(0, at);
			gain.gain.linearRampToValueAtTime(level, at + length - 0.01);
			gain.gain.linearRampToValueAtTime(0, at + length);
			source.connect(filter);
			filter.connect(gain);
			gain.connect(mix.riser);
			play([source], [filter, gain], at, at + length + 0.01);
		}

		function step(position, at) {
			var part = SONG[position.part];
			var bar = part.bars[position.bar];
			var i = position.step;
			var tones = bar.chord.tones;
			var note = bar.lead[i];
			if (note) {
				var voice = bar.leadVoice;
				var length = note.length * STEP_SECONDS * voice.gate;
				lead(mix.lead, note.note, at, length, voice, note.scoop);
				if (bar.echo) lead(mix.echo, note.note, at + ECHO_STEPS * STEP_SECONDS, length, voice, note.scoop);
				if (bar.harmony) {
					var second = bar.harmony === "fifth" ? note.note + 7 : below(note.note, bar.chord);
					lead(mix.harmony, second, at, length, bar.harmony === "fifth" ? voice : {
						duty: 0.125, pwm: 0, vibrato: voice.vibrato * 0.8, level: voice.level, attack: voice.attack,
						decay: voice.decay, sustain: voice.sustain, release: voice.release, gate: voice.gate
					}, note.scoop);
				}
			}
			var stab = bar.stab[i];
			if (stab) {
				chordArp(tones.map(function (t) { return t - 12; }), at,
					stab.length * STEP_SECONDS * bar.stabVoice.gate, bar.stabVoice);
			}
			var arp = bar.arp[i];
			if (arp !== ".") {
				var index = Number(arp);
				tone(mix.arp, tones[index % tones.length] + 12 * Math.floor(index / tones.length), at,
					STEP_SECONDS * bar.arpVoice.gate, bar.arpVoice);
			}
			var low = bar.bass[i];
			if (low) bass(bar.chord.bass + BASS_STEP[low.value], at, low.length * STEP_SECONDS * bar.bassVoice.gate, bar.bassVoice);
			bar.drums[i].forEach(function (hit) { drum(hit[0], hit[1], at); });
			if (part.riser && position.bar === part.riser.bar && i === 0) {
				riser(at, part.riser.bars * STEPS_PER_BAR * STEP_SECONDS, part.riser.level);
			}
		}

		return {
			step: step,
			level: function (at, from, to, duration) {
				master.gain.cancelScheduledValues(at);
				master.gain.setValueAtTime(from, at);
				if (duration) master.gain.linearRampToValueAtTime(to, at + duration);
			},
			cutOff: function (at) {
				voices.forEach(function (voice) {
					if (voice.end > at) voice.sources.forEach(function (source) { source.stop(at); });
				});
			},
			dispose: function () {
				voices.forEach(function (voice) {
					release(voice);
					voice.sources.forEach(function (source) { source.stop(); });
				});
				voices.length = 0;
				master.disconnect();
			}
		};
	}

	function createPlayer() {
		var Audio = root.AudioContext || root.webkitAudioContext;
		var context, synth, scheduler, fadeTimer, fadeStart;
		var active = false;
		var visible = false;
		var reduced = false;
		var offset = 0;
		var wallStart = 0;
		var audioOrigin = null;
		var nextStep = 0;

		function time() {
			if (!visible) return offset;
			if (audioOrigin !== null) return Math.max(offset, context.currentTime - audioOrigin);
			return offset + (root.performance.now() - wallStart) / 1000;
		}

		function schedule() {
			var now = context.currentTime;
			var at = audioOrigin + nextStep * STEP_SECONDS;
			if (at < now) {
				nextStep = Math.ceil((now - audioOrigin) / STEP_SECONDS);
				at = audioOrigin + nextStep * STEP_SECONDS;
			}
			while (at < now + 0.15) {
				synth.step(positionAt(nextStep * STEP_SECONDS, reduced), at);
				at = audioOrigin + ++nextStep * STEP_SECONDS;
			}
		}

		function clearScheduler() {
			if (!scheduler) return;
			root.clearInterval(scheduler);
			scheduler = null;
		}

		function dispose() {
			if (synth) synth.dispose();
			synth = null;
			audioOrigin = null;
		}

		function stateChanged() {
			if (!visible) return;
			if (context.state !== "running") {
			if (context.state === "suspended" && !scheduler) return;
				offset = time();
				wallStart = root.performance.now();
				clearScheduler();
				dispose();
				return;
			}
			if (scheduler) return;
			if (audioOrigin === null) {
				var seconds = time();
				var from = seconds - offset < 0.06 ? offset : seconds;
				var now = context.currentTime;
				audioOrigin = now + 0.025 - from;
				nextStep = Math.ceil(from / STEP_SECONDS);
				synth = makeSynth(context);
				fadeStart = now;
				synth.level(now, 0, LEVEL, FADE_IN);
			}
			schedule();
			scheduler = root.setInterval(schedule, 25);
		}

		function ignore() {}

		function resume() {
			if (!active || visible) return;
			visible = true;
			wallStart = root.performance.now();
			var activation = root.navigator && root.navigator.userActivation;
			if (!Audio || (activation && !activation.hasBeenActive)) return;
			try {
				if (!context) {
					context = new Audio();
					context.onstatechange = stateChanged;
				}
				context.resume().then(stateChanged, ignore);
			} catch (error) {
				// Web Audio is unavailable. Keep the wall clock running.
			}
		}

		function finish() {
			root.clearTimeout(fadeTimer);
			fadeTimer = null;
			dispose();
			if (context) context.suspend().catch(ignore);
		}

		function pause() {
			if (fadeTimer) finish();
			if (!visible) return;
			offset = time();
			visible = false;
			clearScheduler();
			if (context) context.suspend().catch(ignore);
		}

		return {
			start: function (part, slower, hidden) {
				if (fadeTimer) {
					root.clearTimeout(fadeTimer);
					fadeTimer = null;
					dispose();
				}
				active = true;
				reduced = slower;
				offset = part * PART_SECONDS * (reduced ? 2 : 1);
				if (!hidden) resume();
			},
			stop: function () {
				active = visible = false;
				clearScheduler();
				if (!synth || context.state !== "running") {
					finish();
					return;
				}
				var now = context.currentTime;
				var gain = LEVEL * Math.min(1, (now - fadeStart) / FADE_IN);
				synth.level(now, gain, 0, FADE_OUT);
				synth.cutOff(now + FADE_OUT);
				fadeTimer = root.setTimeout(finish, (FADE_OUT + 0.025) * 1000);
			},
			pause: pause,
			resume: resume,
			time: time
		};
	}

	// solo names one mixer channel to render alone, for checking the balance.
	function renderLoop(context, solo) {
		var synth = makeSynth(context, solo);
		synth.level(0, LEVEL);
		for (var n = 0; n < STEPS_PER_SECTION * SONG.length; n++) {
			synth.step(positionAt(n * STEP_SECONDS, false), n * STEP_SECONDS);
		}
		return context.startRendering();
	}

	if (typeof module !== "undefined" && module.exports) {
		module.exports = {
			SONG: SONG, PART_SECONDS: PART_SECONDS, LOOP_SECONDS: LOOP_SECONDS, STEP_SECONDS: STEP_SECONDS,
			positionAt: positionAt, renderLoop: renderLoop, below: below, chord: chord, melody: melody
		};
	} else {
		root.gleebsalScreensaverMusic = { createPlayer: createPlayer, positionAt: positionAt, PART_SECONDS: PART_SECONDS };
	}
})(typeof globalThis !== "undefined" ? globalThis : this);
