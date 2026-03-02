/**
 * Spring physics for the Postal Bubble.
 *
 * Uses WAAPI (Web Animations API) with `linear()` easing for
 * compositor-thread-only spring animations. Falls back to
 * cubic-bezier for Safari < 17.2 (no linear() support).
 *
 * Spring ODE: x'' = -k(x - target) - c * x'
 * Discrete: 40 keypoints sampled over 200ms
 */

// Spring constants (underdamped for ~5% overshoot)
const STIFFNESS = 300;
const DAMPING = 20;
const MASS = 1;

/**
 * Generate a spring curve as 40 normalized keypoints [0..1].
 * Solves the spring ODE from displacement=1 to rest=0.
 */
function generateSpringKeypoints(steps = 40, durationMs = 200): number[] {
	const dt = durationMs / 1000 / steps;
	let x = 1; // displacement
	let v = 0; // velocity
	const points: number[] = [1];

	for (let i = 1; i <= steps; i++) {
		const springForce = -STIFFNESS * x;
		const dampingForce = -DAMPING * v;
		const acceleration = (springForce + dampingForce) / MASS;
		v += acceleration * dt;
		x += v * dt;
		// Normalize: 1 = start, 0 = rest. Output as progress (0→1)
		points.push(1 - x);
	}

	// Normalize to 0..1 range
	const max = Math.max(...points);
	return points.map((p) => Math.min(1, Math.max(0, p / max)));
}

const SPRING_KEYPOINTS = generateSpringKeypoints();

/** CSS `linear()` easing string from spring keypoints */
const LINEAR_EASING = `linear(${SPRING_KEYPOINTS.map((p) => p.toFixed(4)).join(', ')})`;

/** Cubic-bezier fallback (approximates spring with ~5% overshoot) */
const CUBIC_FALLBACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** Detect `linear()` easing support */
let _supportsLinear: boolean | null = null;
function supportsLinearEasing(): boolean {
	if (_supportsLinear !== null) return _supportsLinear;
	if (typeof CSS === 'undefined' || !CSS.supports) {
		_supportsLinear = false;
		return false;
	}
	_supportsLinear = CSS.supports('animation-timing-function', 'linear(0, 1)');
	return _supportsLinear;
}

/** Detect prefers-reduced-motion */
let _prefersReduced: boolean | null = null;
function prefersReducedMotion(): boolean {
	if (_prefersReduced !== null) return _prefersReduced;
	if (typeof matchMedia === 'undefined') {
		_prefersReduced = false;
		return false;
	}
	const mq = matchMedia('(prefers-reduced-motion: reduce)');
	_prefersReduced = mq.matches;
	// Live-update: user can toggle while page is open
	mq.addEventListener('change', (e) => { _prefersReduced = e.matches; });
	return _prefersReduced;
}

/** Get the best available spring easing */
export function getSpringEasing(): string {
	if (prefersReducedMotion()) return 'ease-out';
	return supportsLinearEasing() ? LINEAR_EASING : CUBIC_FALLBACK;
}

/** Get animation duration, respecting reduced-motion preference */
function motionDuration(ms: number): number {
	return prefersReducedMotion() ? 0 : ms;
}

/**
 * Animate a bubble radius change with spring physics.
 * Returns the Animation object for cancellation.
 */
export function animateRadiusSpring(
	el: SVGCircleElement,
	fromScale: number,
	toScale: number,
	durationMs = 200
): Animation {
	return el.animate(
		[{ transform: `scale(${fromScale})` }, { transform: `scale(${toScale})` }],
		{
			duration: motionDuration(durationMs),
			easing: getSpringEasing(),
			fill: 'forwards'
		}
	);
}

/**
 * Animate bubble birth (scale from 0 to 1).
 */
export function animateBubbleBirth(el: SVGCircleElement, durationMs = 400): Animation {
	return el.animate([{ transform: 'scale(0)', opacity: '0' }, { transform: 'scale(1)', opacity: '1' }], {
		duration: motionDuration(durationMs),
		easing: getSpringEasing(),
		fill: 'forwards'
	});
}

/**
 * Animate bubble tighten (radius decrease, e.g., ZIP → ZIP+4).
 */
export function animateBubbleTighten(
	el: SVGCircleElement,
	fromScale: number,
	toScale: number,
	durationMs = 300
): Animation {
	return el.animate(
		[{ transform: `scale(${fromScale})` }, { transform: `scale(${toScale})` }],
		{
			duration: motionDuration(durationMs),
			easing: 'ease-out',
			fill: 'forwards'
		}
	);
}

// ============================================================================
// Drag inertia (requestAnimationFrame-based)
// ============================================================================

const VELOCITY_DECAY = 0.92;
const VELOCITY_THRESHOLD = 0.5; // px/frame

export interface InertiaState {
	vx: number;
	vy: number;
	active: boolean;
	rafId: number;
}

/**
 * Start drag inertia from a release velocity.
 * Calls `onFrame(dx, dy)` with the per-frame displacement until velocity decays.
 */
export function startInertia(
	vx: number,
	vy: number,
	onFrame: (dx: number, dy: number) => void,
	onEnd: () => void
): InertiaState {
	// Skip inertia entirely for reduced-motion preference
	if (prefersReducedMotion()) {
		onEnd();
		return { vx: 0, vy: 0, active: false, rafId: 0 };
	}

	const state: InertiaState = { vx, vy, active: true, rafId: 0 };

	function tick() {
		if (!state.active) return;
		state.vx *= VELOCITY_DECAY;
		state.vy *= VELOCITY_DECAY;

		if (Math.abs(state.vx) < VELOCITY_THRESHOLD && Math.abs(state.vy) < VELOCITY_THRESHOLD) {
			state.active = false;
			onEnd();
			return;
		}

		onFrame(state.vx, state.vy);
		state.rafId = requestAnimationFrame(tick);
	}

	state.rafId = requestAnimationFrame(tick);
	return state;
}

export function stopInertia(state: InertiaState): void {
	state.active = false;
	cancelAnimationFrame(state.rafId);
}
