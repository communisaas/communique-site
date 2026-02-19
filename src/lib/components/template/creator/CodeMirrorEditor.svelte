<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, Decoration, keymap } from '@codemirror/view';
	import { basicSetup } from 'codemirror';
	import { EditorState, StateField, RangeSet } from '@codemirror/state';
	import { deleteCharBackward, deleteCharForward } from '@codemirror/commands';
	import { getVariableMarkClasses, getVariableTipMessage } from '$lib/utils/variable-styling';

	let {
		value = $bindable(),
		onVariableClick = (_variable: string) => {},
		insertVariable = $bindable(),
		appendToDocument = $bindable(),
		class: className = ''
	}: {
		value: string;
		onVariableClick?: (variable: string) => void;
		insertVariable?: (variable: string) => void;
		appendToDocument?: (text: string, preserveCursor?: boolean) => void;
		class?: string;
	} = $props();

	let editorElement: HTMLElement;
	let editorView: EditorView;

	// Removed VariableInfoWidget and decorationUpdateTimeout as they're not needed in the simplified implementation

	// Helper function to build decorations from text
	function buildDecorations(text: string) {
		const decorationArray = [];

		// Find all [Variable] patterns
		const variableRegex = /\[([^\]]+)\]/g;
		let match;

		while ((match = variableRegex.exec(text)) !== null) {
			const from = match.index;
			const to = match.index + match[0].length;
			const variable = match[1];
			const isEmpty = true; // For edit mode, treat as empty

			// Style the [Variable] text with mark decoration (preserves text)
			const markClasses = getVariableMarkClasses(variable, isEmpty);
			decorationArray.push(
				Decoration.mark({
					class: markClasses,
					attributes: {
						'data-variable': variable,
						'aria-label': `Variable: ${variable}. ${getVariableTipMessage(variable)}`,
						role: 'button',
						tabindex: '0'
					}
				}).range(from, to)
			);
		}

		return Decoration.set(decorationArray);
	}

	// State field for variable decorations using mark-based styling
	const variableDecorations = StateField.define({
		create(state) {
			// Build decorations for the initial document
			return buildDecorations(state.doc.toString());
		},
		update(decorations, tr) {
			// Always rebuild decorations if document changed
			// This ensures draft restoration and external updates properly style variables
			if (tr.docChanged) {
				return buildDecorations(tr.state.doc.toString());
			}

			// Otherwise just map existing decorations to new positions
			return decorations.map(tr.changes);
		},
		// CRITICAL: This tells CodeMirror to actually apply the decorations to the view
		provide(field) {
			return EditorView.decorations.from(field);
		}
	});

	// Helper function to get atomic ranges from document
	function getAtomicRanges(doc: string) {
		const ranges: Array<{ from: number; to: number }> = [];
		const variableRegex = /\[[^\]]+\]/g;
		let match;

		while ((match = variableRegex.exec(doc)) !== null) {
			ranges.push({
				from: match.index,
				to: match.index + match[0].length
			});
		}

		return ranges;
	}

	// Jump to beginning of atomic range when backspace hits a variable boundary
	function jumpOverAtomBackward(view: EditorView): boolean {
		const pos = view.state.selection.main.head;
		const doc = view.state.doc.toString();
		const ranges = getAtomicRanges(doc);

			// Check if cursor is at the end of a variable
		for (const range of ranges) {
			if (range.to === pos) {
				// CRITICAL: Dispatch a transaction that ONLY moves cursor, no deletion
				view.dispatch({
					selection: { anchor: range.from, head: range.from },
					scrollIntoView: true,
					// Explicitly prevent any changes to document
					changes: []
				});
				return true; // Handled, completely prevent default backspace
			}
		}

		return false; // Let default backspace run
	}

	// Jump to end of atomic range when delete hits a variable boundary
	function jumpOverAtomForward(view: EditorView): boolean {
		const pos = view.state.selection.main.head;
		const doc = view.state.doc.toString();
		const ranges = getAtomicRanges(doc);

		// Check if cursor is at the start of a variable
		for (const range of ranges) {
			if (range.from === pos) {
				// CRITICAL: Dispatch a transaction that ONLY moves cursor, no deletion
				view.dispatch({
					selection: { anchor: range.to, head: range.to },
					scrollIntoView: true,
					// Explicitly prevent any changes to document
					changes: []
				});
				return true; // Handled, completely prevent default delete
			}
		}

		return false; // Let default delete run
	}

	// Atomic ranges extension for cursor movement immutability (but allow our custom deletion)
	const atomicRangesExtension = EditorView.atomicRanges.of((view) => {
		const doc = view.state.doc.toString();
		const ranges = getAtomicRanges(doc);
		return RangeSet.of(
			ranges.map((range) =>
				Decoration.mark({
					atomic: true,
					inclusiveStart: false,
					inclusiveEnd: false
				}).range(range.from, range.to)
			)
		);
	});

	// Custom keymap to handle backspace/delete at atomic boundaries
	const atomicKeymap = keymap.of([
		{
			key: 'Backspace',
			run: (view) => {
				// If we handle the atomic jump, completely prevent default
				if (jumpOverAtomBackward(view)) {
					return true; // Signal that we handled it, prevent all defaults
				}
				// Otherwise let default backspace behavior run
				return deleteCharBackward(view as any);
			}
		},
		{
			key: 'Delete',
			run: (view) => {
				// If we handle the atomic jump, completely prevent default
				if (jumpOverAtomForward(view)) {
					return true; // Signal that we handled it, prevent all defaults
				}
				// Otherwise let default delete behavior run
				return deleteCharForward(view as any);
			}
		}
	]);

	// DOM event handlers to catch beforeinput events (crucial for mobile/IME)
	const atomicDomHandlers = EditorView.domEventHandlers({
		beforeinput(event, view) {
			const inputType = event.inputType;

			// Handle all backward deletion variants
			if (
				inputType === 'deleteContentBackward' ||
				inputType === 'deleteByCut' ||
				inputType === 'deleteByDrag'
			) {
				if (jumpOverAtomBackward(view)) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					return true;
				}
			}

			// Handle all forward deletion variants
			if (inputType === 'deleteContentForward') {
				if (jumpOverAtomForward(view)) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation();
					return true;
				}
			}

			return false;
		}
	});

	// Theme for the editor with ACTION-ORIENTED variable styling
	// Using baseTheme as recommended by CodeMirror docs for proper CSS injection
	const theme = EditorView.baseTheme({
		'.cm-editor': {
			border: '1px solid rgb(209 213 219)',
			borderRadius: '6px',
			backgroundColor: 'white',
			fontFamily:
				'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
			fontSize: '14px',
			lineHeight: '1.5'
		},
		'.cm-content': {
			padding: '12px',
			minHeight: '250px',
			maxHeight: '60vh',
			overflow: 'auto'
		},
		'.cm-focused': {
			outline: 'none',
			borderColor: 'rgb(59 130 246)'
		},
		'.cm-placeholder': {
			color: 'rgb(156 163 175)'
		},
		// ACTION-ORIENTED variable styling with COMPLETE definitions
		'.cm-variable-needs-input': {
			backgroundColor: 'rgb(254 251 235) !important', // bg-amber-50
			color: 'rgb(180 83 9) !important', // text-amber-700
			borderBottom: '2px dashed rgb(251 191 36) !important', // border-amber-400
			padding: '0 4px',
			fontWeight: '500',
			cursor: 'text',
			transition: 'all 150ms ease'
		},
		'.cm-variable-needs-input:hover': {
			backgroundColor: 'rgb(254 243 199) !important' // hover:bg-amber-100
		},
		// CRITICAL: This was MISSING - system variables need visual styling
		'.cm-variable-system': {
			backgroundColor: 'rgb(236 253 245) !important', // bg-emerald-50
			color: 'rgb(6 78 59) !important', // text-emerald-900
			borderBottom: '1px solid rgb(110 231 183) !important', // border-emerald-300
			padding: '0 4px',
			fontWeight: '500',
			cursor: 'pointer',
			transition: 'all 150ms ease'
		},
		'.cm-variable-system:hover': {
			backgroundColor: 'rgb(209 250 229) !important' // hover:bg-emerald-100
		},
		'.cm-variable-ready': {
			color: 'rgb(71 85 105) !important', // text-slate-600
			borderBottom: '1px solid rgb(203 213 225) !important', // border-slate-300
			padding: '0 2px',
			cursor: 'default'
		},
		'.cm-variable-error': {
			backgroundColor: 'rgb(254 242 242) !important', // bg-red-50
			color: 'rgb(185 28 28) !important', // text-red-700
			border: '2px solid rgb(248 113 113) !important', // border-red-400
			borderRadius: '2px',
			padding: '0 4px',
			fontWeight: '500',
			cursor: 'help'
		},
		'.cm-variable-info-btn': {
			backgroundColor: 'transparent',
			border: 'none',
			borderRadius: '50%',
			width: '16px',
			height: '16px',
			marginLeft: '2px',
			fontSize: '10px',
			opacity: '0.5',
			transition: 'opacity 150ms ease',
			color: 'rgb(107 114 128)' // text-gray-500
		},
		'.cm-variable-info-btn:hover': {
			opacity: '1',
			backgroundColor: 'rgb(243 244 246)' // hover:bg-gray-100
		}
	});

	// Function to insert variable at current cursor position
	function insertVariableAtCursor(variable: string) {
		if (!editorView) return;

		const selection = editorView.state.selection.main;
		const from = selection.from;
		const to = selection.to;

		// Insert the variable at cursor position
		editorView.dispatch({
			changes: {
				from,
				to,
				insert: variable
			},
			selection: {
				anchor: from + variable.length,
				head: from + variable.length
			}
		});

		// Focus the editor
		editorView.focus();
	}

	// Function to append text to document end while preserving cursor
	function appendToDocumentEnd(text: string, preserveCursor: boolean = true) {
		if (!editorView) return;

		const currentSelection = editorView.state.selection.main;
		const currentPos = currentSelection.head;
		const docLength = editorView.state.doc.length;

		// Append text to the end of the document
		const dispatch = {
			changes: {
				from: docLength,
				to: docLength,
				insert: text
			}
		} as { changes: object; selection?: object };

		// Preserve cursor position if requested
		if (preserveCursor) {
			dispatch.selection = {
				anchor: currentPos,
				head: currentPos
			};
		}

		editorView.dispatch(dispatch as any);

		// Update the bound value
		value = editorView.state.doc.toString();
	}

	onMount(() => {
		const startState = EditorState.create({
			doc: value,
			extensions: [
				// CRITICAL: Place atomic keymap FIRST to get highest priority over basicSetup
				atomicKeymap, // Custom backspace/delete handlers (HIGHEST PRIORITY)
				atomicDomHandlers, // beforeinput event handlers for mobile/IME (HIGH PRIORITY)
				atomicRangesExtension, // Make variables immutable for cursor movement
				basicSetup,
				variableDecorations,
				theme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						value = update.state.doc.toString();
					}
				}),
				EditorView.domEventHandlers({
					click(event, _view) {
						// Handle clicks on variable elements to show tooltip
						const target = event.target as HTMLElement;
						const variable = target.getAttribute('data-variable');
						if (variable) {
							event.preventDefault();
							// Call parent callback to show tooltip
							onVariableClick(variable);
							return true;
						}
						return false;
					}
				})
			]
		});

		editorView = new EditorView({
			state: startState,
			parent: editorElement
		});

		// Expose functions to parent
		insertVariable = insertVariableAtCursor;
		appendToDocument = appendToDocumentEnd;

		return () => {
			editorView?.destroy();
		};
	});

	// Update editor when value changes externally while preserving cursor
	$effect(() => {
		if (editorView && value !== editorView.state.doc.toString()) {
			// Preserve current cursor position
			const currentSelection = editorView.state.selection.main;
			const currentPos = currentSelection.head;
			const currentDoc = editorView.state.doc.toString();

			// Only preserve cursor if the content was appended (auto-addition scenario)
			// If content length is same or shorter, user likely made edits, so don't preserve
			const isContentAppended =
				value.length > currentDoc.length &&
				value.startsWith(currentDoc.substring(0, Math.min(currentPos, currentDoc.length)));

			const dispatch = {
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: value
				}
			} as { changes: object; selection?: object };

			// If content was appended and cursor was in a reasonable position, preserve it
			if (isContentAppended && currentPos <= currentDoc.length) {
				dispatch.selection = {
					anchor: currentPos,
					head: currentPos
				};
			}

			editorView.dispatch(dispatch as any);
		}
	});
</script>

<div class="relative">
	<div bind:this={editorElement} class={className}></div>

	<!-- No modal needed - using direct inline editing -->
</div>

<style>
	/* Global styles for CodeMirror variable highlighting */
	:global(.cm-variable-needs-input) {
		background-color: rgb(254 251 235) !important; /* bg-amber-50 */
		color: rgb(180 83 9) !important; /* text-amber-700 */
		border-bottom: 2px dashed rgb(251 191 36) !important; /* border-amber-400 */
		padding: 0 4px !important;
		font-weight: 500 !important;
		cursor: pointer !important;
		transition: all 150ms ease !important;
		border-radius: 2px !important;
	}

	:global(.cm-variable-needs-input:hover) {
		background-color: rgb(254 243 199) !important; /* hover:bg-amber-100 */
	}

	:global(.cm-variable-system) {
		background-color: rgb(236 253 245) !important; /* bg-emerald-50 */
		color: rgb(6 78 59) !important; /* text-emerald-900 */
		border-bottom: 1px solid rgb(110 231 183) !important; /* border-emerald-300 */
		padding: 0 4px !important;
		font-weight: 500 !important;
		cursor: pointer !important;
		transition: all 150ms ease !important;
		border-radius: 2px !important;
	}

	:global(.cm-variable-system:hover) {
		background-color: rgb(209 250 229) !important; /* hover:bg-emerald-100 */
	}

	:global(.cm-variable-ready) {
		color: rgb(71 85 105) !important; /* text-slate-600 */
		border-bottom: 1px solid rgb(203 213 225) !important; /* border-slate-300 */
		padding: 0 2px !important;
		cursor: pointer !important;
	}

	:global(.cm-variable-error) {
		background-color: rgb(254 242 242) !important; /* bg-red-50 */
		color: rgb(185 28 28) !important; /* text-red-700 */
		border: 2px solid rgb(248 113 113) !important; /* border-red-400 */
		border-radius: 2px !important;
		padding: 0 4px !important;
		font-weight: 500 !important;
		cursor: help !important;
	}
</style>
