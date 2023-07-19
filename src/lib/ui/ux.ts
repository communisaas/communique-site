export function updateFocusableElements(focusableContainer: HTMLElement) {
	const focusableElements = Array.from(
		focusableContainer.querySelectorAll(
			'a, button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
		)
	);
	const firstFocusableElement = focusableElements[0] as HTMLElement;
	const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

	return [focusableElements, firstFocusableElement, lastFocusableElement];
}

export function trapFocus(
	element: HTMLElement,
	firstFocusableElement: HTMLElement,
	lastFocusableElement: HTMLElement,
	focusableElements: HTMLElement[]
) {
	// Focus on the first element
	firstFocusableElement.focus();

	// Listen for and trap the keyboard
	element.addEventListener('keydown', handleTabKey);

	function handleTabKey(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();

			const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
			let nextIndex;

			if (e.shiftKey) {
				// SHIFT + TAB
				// Subtract 1 from the index, add the length (to avoid a negative index), then apply the modulus operator
				nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
			} else {
				// TAB
				// Add 1 to the index then apply the modulus operator
				nextIndex = (currentIndex + 1) % focusableElements.length;
			}

			focusableElements[nextIndex].focus();
		}
	}
}
