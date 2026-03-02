/**
 * Bubble Gesture Engine — Pointer Events Level 3, no library.
 *
 * Handles:
 * - Two-finger pinch → radius scale
 * - Single-finger drag → center move
 * - Scroll wheel → radius (up=shrink, down=grow, shift=fine)
 * - Keyboard → +/- radius, arrows move center, Enter confirm, Escape blur
 *
 * All events flow through the bubble state store. The gesture layer
 * never talks to MapLibre directly — the map observes state changes.
 */

export interface GestureCallbacks {
	onPinchScale: (scale: number) => void;
	onDragDelta: (dx: number, dy: number) => void;
	onDragEnd: (vx: number, vy: number) => void;
	onWheelRadius: (delta: number) => void;
	onKeyRadius: (delta: number) => void;
	onKeyMove: (dx: number, dy: number) => void;
	onConfirm: () => void;
}

interface Pointer {
	id: number;
	x: number;
	y: number;
	t: number;
}

type GestureMode = 'none' | 'drag' | 'pinch';

export class BubbleGestures {
	private el: HTMLElement;
	private callbacks: GestureCallbacks;
	private pointers: Pointer[] = [];
	private prevPinchDist = -1;
	private mode: GestureMode = 'none';

	// Velocity tracking for drag inertia
	private lastDragX = 0;
	private lastDragY = 0;
	private lastDragT = 0;
	private dragVx = 0;
	private dragVy = 0;

	// Bound handlers (for removeEventListener)
	private boundDown: (e: PointerEvent) => void;
	private boundMove: (e: PointerEvent) => void;
	private boundUp: (e: PointerEvent) => void;
	private boundLost: (e: PointerEvent) => void;
	private boundWheel: (e: WheelEvent) => void;
	private boundKeydown: (e: KeyboardEvent) => void;
	private boundTouchStart: (e: TouchEvent) => void;
	private boundTouchMove: (e: TouchEvent) => void;

	constructor(el: HTMLElement, callbacks: GestureCallbacks) {
		this.el = el;
		this.callbacks = callbacks;

		this.boundDown = this.onPointerDown.bind(this);
		this.boundMove = this.onPointerMove.bind(this);
		this.boundUp = this.onPointerUp.bind(this);
		this.boundLost = this.onLostCapture.bind(this);
		this.boundWheel = this.onWheel.bind(this);
		this.boundKeydown = this.onKeydown.bind(this);
		this.boundTouchStart = (e: TouchEvent) => e.preventDefault();
		this.boundTouchMove = (e: TouchEvent) => e.preventDefault();

		this.attach();
	}

	private attach(): void {
		const el = this.el;
		el.style.touchAction = 'none';

		el.addEventListener('pointerdown', this.boundDown);
		el.addEventListener('pointermove', this.boundMove);
		el.addEventListener('pointerup', this.boundUp);
		el.addEventListener('pointercancel', this.boundUp);
		el.addEventListener('lostpointercapture', this.boundLost);
		el.addEventListener('wheel', this.boundWheel, { passive: false });
		el.addEventListener('keydown', this.boundKeydown);

		// iOS Safari: touch-action: none is not sufficient
		el.addEventListener('touchstart', this.boundTouchStart, { passive: false });
		el.addEventListener('touchmove', this.boundTouchMove, { passive: false });
	}

	destroy(): void {
		const el = this.el;
		el.removeEventListener('pointerdown', this.boundDown);
		el.removeEventListener('pointermove', this.boundMove);
		el.removeEventListener('pointerup', this.boundUp);
		el.removeEventListener('pointercancel', this.boundUp);
		el.removeEventListener('lostpointercapture', this.boundLost);
		el.removeEventListener('wheel', this.boundWheel);
		el.removeEventListener('keydown', this.boundKeydown);
		el.removeEventListener('touchstart', this.boundTouchStart);
		el.removeEventListener('touchmove', this.boundTouchMove);
	}

	// ── Pointer Events ───────────────────────────────────────────────

	private onPointerDown(ev: PointerEvent): void {
		this.pointers.push({ id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
		this.el.setPointerCapture(ev.pointerId);

		if (this.pointers.length === 1) {
			this.mode = 'drag';
			this.lastDragX = ev.clientX;
			this.lastDragY = ev.clientY;
			this.lastDragT = ev.timeStamp;
			this.dragVx = 0;
			this.dragVy = 0;
		} else if (this.pointers.length === 2) {
			// Entering pinch mode: reset velocity to prevent stale inertia
			this.mode = 'pinch';
			this.dragVx = 0;
			this.dragVy = 0;
			this.prevPinchDist = -1;
		}
	}

	private onPointerMove(ev: PointerEvent): void {
		const idx = this.pointers.findIndex((p) => p.id === ev.pointerId);
		if (idx < 0) return;

		// Use coalesced events for high-frequency tracking
		const events = ev.getCoalescedEvents?.() ?? [ev];
		const last = events[events.length - 1];

		this.pointers[idx] = { id: ev.pointerId, x: last.clientX, y: last.clientY, t: last.timeStamp };

		if (this.mode === 'pinch' && this.pointers.length === 2) {
			// Pinch: compute inter-finger distance ratio
			const dx = this.pointers[0].x - this.pointers[1].x;
			const dy = this.pointers[0].y - this.pointers[1].y;
			const dist = Math.hypot(dx, dy);

			if (this.prevPinchDist > 0) {
				const scale = dist / this.prevPinchDist;
				this.callbacks.onPinchScale(scale);
			}
			this.prevPinchDist = dist;
		} else if (this.mode === 'drag' && this.pointers.length === 1) {
			// Integrate all coalesced events for velocity smoothing
			let totalDx = 0;
			let totalDy = 0;
			let prevX = this.lastDragX;
			let prevY = this.lastDragY;
			for (const ce of events) {
				totalDx += ce.clientX - prevX;
				totalDy += ce.clientY - prevY;
				prevX = ce.clientX;
				prevY = ce.clientY;
			}

			const dt = Math.max(1, last.timeStamp - this.lastDragT);
			this.dragVx = 0.8 * (totalDx / dt * 16) + 0.2 * this.dragVx;
			this.dragVy = 0.8 * (totalDy / dt * 16) + 0.2 * this.dragVy;

			this.lastDragX = last.clientX;
			this.lastDragY = last.clientY;
			this.lastDragT = last.timeStamp;

			this.callbacks.onDragDelta(totalDx, totalDy);
		}
	}

	private onPointerUp(ev: PointerEvent): void {
		const idx = this.pointers.findIndex((p) => p.id === ev.pointerId);
		if (idx >= 0) this.pointers.splice(idx, 1);

		if (this.pointers.length === 1 && this.mode === 'pinch') {
			// Transitioning from pinch to single-finger: stay in drag but reset velocity
			this.mode = 'drag';
			this.dragVx = 0;
			this.dragVy = 0;
			this.lastDragX = this.pointers[0].x;
			this.lastDragY = this.pointers[0].y;
			this.lastDragT = ev.timeStamp;
			this.prevPinchDist = -1;
		} else if (this.pointers.length === 0) {
			// All fingers up: fire inertia only if we were dragging (not pinching)
			if (this.mode === 'drag') {
				this.callbacks.onDragEnd(this.dragVx, this.dragVy);
			}
			this.mode = 'none';
			this.prevPinchDist = -1;
		}
	}

	private onLostCapture(ev: PointerEvent): void {
		// Browser implicitly released capture — clear phantom pointer
		const idx = this.pointers.findIndex((p) => p.id === ev.pointerId);
		if (idx >= 0) this.pointers.splice(idx, 1);
		if (this.pointers.length < 2) this.prevPinchDist = -1;
		if (this.pointers.length === 0) this.mode = 'none';
	}

	// ── Wheel ────────────────────────────────────────────────────────

	private onWheel(ev: WheelEvent): void {
		ev.preventDefault();
		const speed = ev.shiftKey ? 0.25 : 1;
		const delta = -ev.deltaY * speed * 0.002;
		this.callbacks.onWheelRadius(delta);
	}

	// ── Keyboard ─────────────────────────────────────────────────────

	private onKeydown(ev: KeyboardEvent): void {
		switch (ev.key) {
			case 'Escape':
				// Release keyboard focus — allow Tab to work normally
				(ev.target as HTMLElement)?.blur();
				break;
			case '+':
			case '=':
				ev.preventDefault();
				this.callbacks.onKeyRadius(-0.1);
				break;
			case '-':
			case '_':
				ev.preventDefault();
				this.callbacks.onKeyRadius(0.1);
				break;
			case 'ArrowUp':
				ev.preventDefault();
				this.callbacks.onKeyMove(0, -1);
				break;
			case 'ArrowDown':
				ev.preventDefault();
				this.callbacks.onKeyMove(0, 1);
				break;
			case 'ArrowLeft':
				ev.preventDefault();
				this.callbacks.onKeyMove(-1, 0);
				break;
			case 'ArrowRight':
				ev.preventDefault();
				this.callbacks.onKeyMove(1, 0);
				break;
			case 'Enter':
				ev.preventDefault();
				this.callbacks.onConfirm();
				break;
			// Tab: don't preventDefault — let focus move naturally
		}
	}
}
