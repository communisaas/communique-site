/**
 * Gesture Actions for Fluid Mobile Interactions
 * Provides swipe, pinch, and other touch gestures
 */

interface SwipeOptions {
	threshold?: number;
	timeout?: number;
	onLeft?: () => void;
	onRight?: () => void;
	onUp?: () => void;
	onDown?: () => void;
}

interface PanOptions {
	onPanStart?: (e: { x: number; y: number }) => void;
	onPanMove?: (e: { x: number; y: number; deltaX: number; deltaY: number }) => void;
	onPanEnd?: () => void;
}

interface LongPressOptions {
	duration?: number;
	onLongPress?: () => void;
}

// Swipe gesture action
export function swipe(node: HTMLElement, options: SwipeOptions = {}) {
	const { threshold = 50, timeout = 500, onLeft, onRight, onUp, onDown } = options;

	let startX = 0;
	let startY = 0;
	let startTime = 0;

	function handleTouchStart(_event: TouchEvent) {
		const touch = _event.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		startTime = Date.now();
	}

	function handleTouchEnd(_event: TouchEvent) {
		const touch = _event.changedTouches[0];
		const endX = touch.clientX;
		const endY = touch.clientY;
		const endTime = Date.now();

		const deltaX = endX - startX;
		const deltaY = endY - startY;
		const deltaTime = endTime - startTime;

		// Check if swipe was fast enough
		if (deltaTime > timeout) return;

		// Check if swipe was far enough
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		if (distance < threshold) return;

		// Determine direction
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			// Horizontal swipe
			if (deltaX > 0) {
				onRight?.();
			} else {
				onLeft?.();
			}
		} else {
			// Vertical swipe
			if (deltaY > 0) {
				onDown?.();
			} else {
				onUp?.();
			}
		}
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchend', handleTouchEnd, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchend', handleTouchEnd);
		}
	};
}

// Pan gesture action
export function pan(node: HTMLElement, options: PanOptions = {}) {
	const { onPanStart, onPanMove, onPanEnd } = options;

	let startX = 0;
	let startY = 0;
	let isPanning = false;

	function handleTouchStart(_event: TouchEvent) {
		const touch = _event.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		isPanning = true;

		onPanStart?.({ x: startX, y: startY });
	}

	function handleTouchMove(_event: TouchEvent) {
		if (!isPanning) return;

		const touch = _event.touches[0];
		const currentX = touch.clientX;
		const currentY = touch.clientY;

		const deltaX = currentX - startX;
		const deltaY = currentY - startY;

		onPanMove?.({
			x: currentX,
			y: currentY,
			deltaX,
			deltaY
		});
	}

	function handleTouchEnd() {
		if (isPanning) {
			isPanning = false;
			onPanEnd?.();
		}
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchmove', handleTouchMove, { passive: false });
	node.addEventListener('touchend', handleTouchEnd, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
		}
	};
}

// Long press gesture action
export function longPress(node: HTMLElement, options: LongPressOptions = {}) {
	const { duration = 500, onLongPress } = options;

	let timer: NodeJS.Timeout;

	function start() {
		timer = setTimeout(() => {
			onLongPress?.();
		}, duration);
	}

	function cancel() {
		clearTimeout(timer);
	}

	node.addEventListener('touchstart', start, { passive: true });
	node.addEventListener('touchend', cancel, { passive: true });
	node.addEventListener('touchmove', cancel, { passive: true });

	return {
		destroy() {
			clearTimeout(timer);
			node.removeEventListener('touchstart', start);
			node.removeEventListener('touchend', cancel);
			node.removeEventListener('touchmove', cancel);
		}
	};
}

// Pull to refresh action
export function pullToRefresh(node: HTMLElement, onRefresh: () => Promise<void>) {
	let startY = 0;
	let currentY = 0;
	let isPulling = false;
	let refreshTriggered = false;

	const threshold = 100; // Pixels to pull before triggering refresh

	function handleTouchStart(_event: TouchEvent) {
		if (node.scrollTop === 0) {
			const touch = _event.touches[0];
			startY = touch.clientY;
			isPulling = true;
			refreshTriggered = false;
		}
	}

	function handleTouchMove(_event: TouchEvent) {
		if (!isPulling) return;

		const touch = _event.touches[0];
		currentY = touch.clientY;
		const deltaY = currentY - startY;

		if (deltaY > 0 && node.scrollTop === 0) {
			_event.preventDefault();

			// Visual feedback
			const pullDistance = Math.min(deltaY, threshold * 1.5);
			const opacity = Math.min(pullDistance / threshold, 1);

			node.style.transform = `translateY(${pullDistance * 0.5}px)`;

			// Add refresh indicator if doesn't exist
			let indicator = node.querySelector('.pull-refresh-indicator') as HTMLElement;
			if (!indicator) {
				indicator = document.createElement('div');
				indicator.className = 'pull-refresh-indicator';
				indicator.innerHTML = '↓ Pull to refresh';
				indicator.style.cssText = `
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px;
          background: rgba(0,0,0,0.8);
          color: white;
          border-radius: 20px;
          font-size: 14px;
          pointer-events: none;
          transition: opacity 0.2s;
        `;
				node.appendChild(indicator);
			}

			indicator.style.opacity = opacity.toString();

			if (deltaY >= threshold && !refreshTriggered) {
				indicator.innerHTML = '↑ Release to refresh';
				refreshTriggered = true;
			}
		}
	}

	async function handleTouchEnd() {
		if (!isPulling) return;

		isPulling = false;

		const indicator = node.querySelector('.pull-refresh-indicator') as HTMLElement;

		if (refreshTriggered) {
			if (indicator) {
				indicator.innerHTML = '⟲ Refreshing...';
			}

			try {
				await onRefresh();
			} finally {
				// Reset
				node.style.transform = '';
				if (indicator) {
					indicator.remove();
				}
			}
		} else {
			// Reset without refresh
			node.style.transform = '';
			if (indicator) {
				indicator.remove();
			}
		}
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchmove', handleTouchMove, { passive: false });
	node.addEventListener('touchend', handleTouchEnd, { passive: true });

	return {
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);

			// Clean up
			const indicator = node.querySelector('.pull-refresh-indicator');
			indicator?.remove();
			node.style.transform = '';
		}
	};
}
