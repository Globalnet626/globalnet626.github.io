# Recreating Sorting-Visualizer Tones for a Defragging Simulator

Reference video: [Musicombo sorting/sonification video on YouTube](https://youtu.be/vr5dCRHAgb0).

## What are these tones called?

The technique is called **sonification**, also described as **audibilization**: mapping data or algorithm activity to sound. In sorting visualizers, a common approach is to play a short synthesized tone whose **pitch corresponds to the numeric value being compared or accessed**.

Timo Bingmann’s [The Sound of Sorting](https://bingmann.github.io/2013/sound-of-sorting/) is a documented example: comparison values determine sound frequency. Its implementation uses a **triangle wave with an ADSR envelope** and a frequency range of approximately **120–1,212 Hz**. Those details describe Bingmann’s implementation; they do not establish the exact synthesis used in the linked Musicombo video.

## How to describe the sound

Useful terms are **short oscillator bleeps**, **arcade-style synthesized tones**, and **data-driven pitch blips**. Sine, triangle, or softly filtered square waves are reasonable starting points for recreating that character.

The earlier explanation described the Musicombo sound as possibly sine-like or a softened square/triangle wave. Treat that as a listening impression, not a verified identification: the exact waveform used in that video has not been established here. A [CMU creative-computing course post](https://courses.ideate.cmu.edu/15-104/f2021/category/lookingoutwards-07/page/2/index.html) likewise describes Musicombo’s sounds as arcade- and Pac-Man-like; this is a subjective description, not synthesis documentation.

## Map disk activity to pitch

For a defragging simulator, use disk-block position, file position, or another meaningful operation value as the input:

```text
disk block / file position
        ↓
normalize to 0.0–1.0
        ↓
map to frequency
e.g. 180 Hz → 1,800 Hz
        ↓
play a 10–40 ms oscillator blip
```

The original example formula is:

```js
frequency = 180 * Math.pow(10, blockPosition / maxBlockPosition);
```

With `blockPosition` ranging from `0` to a positive `maxBlockPosition`, this maps the first position to 180 Hz and the last to 1,800 Hz.

### Why exponential / log-frequency mapping?

Pitch perception is approximately logarithmic: equal frequency ratios produce equal musical intervals. An **exponential mapping from position to frequency** therefore produces evenly spaced changes on a logarithmic pitch scale. It is a useful starting point for an ascending computer-like chirp.

For any chosen frequency range:

```js
const frequency = minHz * Math.pow(maxHz / minHz, normalizedPosition);
```

A guarded version for disk-block positions is:

```js
function blockToFrequency(blockPosition, maxBlockPosition) {
  const normalizedPosition = maxBlockPosition > 0
    ? Math.max(0, Math.min(1, blockPosition / maxBlockPosition))
    : 0;

  const minHz = 180;
  const maxHz = 1800;
  return minHz * Math.pow(maxHz / minHz, normalizedPosition);
}
```

If the disk contains `blockCount` blocks indexed from zero, pass `blockCount - 1` as `maxBlockPosition`.

## Suggested defrag sound mappings

These are proposed design choices for the simulator, rather than claims about how the reference video works.

| Defrag event | Suggested sound |
| --- | --- |
| Read block | Sine-wave blip, about 20 ms |
| Move block | Triangle-wave blip, about 30 ms |
| Write block | Square wave mixed quietly with a sine wave |
| Fragment found | Two quick descending tones |
| Contiguous region completed | Fast ascending sweep |
| Final verification pass | Rapid low-to-high scan across the entire disk |

Use a brief amplitude attack and release to soften each blip and reduce clicks. At high operation rates, limit overlapping voices or sample events so the sound stays clear.

Generate the tones **procedurally from actual simulator activity**. Let disk position determine pitch, operation type determine timbre, and processing speed determine rhythm. This makes the sound reflect the defragging process as its pattern changes.

## Sources

- [Reference YouTube video](https://youtu.be/vr5dCRHAgb0)
- [Timo Bingmann — The Sound of Sorting: Audibilization and Visualization of Sorting Algorithms](https://bingmann.github.io/2013/sound-of-sorting/)
- [CMU Introduction to Computing for Creative Practice — Looking Outwards 07 posts, including a Musicombo video discussion](https://courses.ideate.cmu.edu/15-104/f2021/category/lookingoutwards-07/page/2/index.html)
