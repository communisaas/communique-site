<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView } from '@codemirror/view';
	import { basicSetup } from 'codemirror';
	import { EditorState, StateField } from '@codemirror/state';
	import { Decoration, WidgetType } from '@codemirror/view';
	import {
		getVariableClasses,
		isSystemVariable,
		isUserEditableVariable,
		getVariableTipMessage
	} from '$lib/utils/variable-styling';

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

	// Variable decoration widget
	class VariableWidget extends WidgetType {
		variable: string;
		onClick: (variable: string) => void;

		constructor(variable: string, onClick: (variable: string) => void) {
			super();
			this.variable = variable;
			this.onClick = onClick;
		}

		toDOM() {
			const wrapper = document.createElement('span');
			const isEmpty = true; // For now, treat all as empty since we're in edit mode

			// Apply consistent styling from variable-styling.ts
			wrapper.className = getVariableClasses(this.variable, isEmpty);

			// Add icon based on variable type
			const icon = document.createElement('span');
			if (isSystemVariable(this.variable)) {
				icon.textContent = '👤';
			} else if (isUserEditableVariable(this.variable)) {
				icon.textContent = '✨';
			}

			const text = document.createElement('span');
			text.textContent = this.variable;

			wrapper.appendChild(icon);
			wrapper.appendChild(text);

			// Add click handler
			wrapper.addEventListener('click', (e) => {
				e.preventDefault();
				this.onClick(this.variable);
			});

			// Add tooltip
			wrapper.title = getVariableTipMessage(this.variable);

			return wrapper;
		}

		eq(other: VariableWidget) {
			return this.variable === other.variable;
		}
	}

	// State field for variable decorations
	const variableDecorations = StateField.define({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			decorations = decorations.map(tr.changes);

			// Rebuild decorations when document changes
			const text = tr.state.doc.toString();
			const newDecorations: unknown[] = [];

			// Find all [Variable] patterns
			const variableRegex = /\[([^\]]+)\]/g;
			let match;

			while ((match = variableRegex.exec(text)) !== null) {
				const from = match.index;
				const to = match.index + match[0].length;
				const variable = match[1];

				// Replace the [Variable] text with a widget
				newDecorations.push(
					Decoration.replace({
						widget: new VariableWidget(variable, onVariableClick)
					}).range(from, to)
				);
			}

			return Decoration.set(newDecorations);
		}
	});

	// Theme for the editor
	const theme = EditorView.theme({
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

		editorView.dispatch(dispatch);

		// Update the bound value
		value = editorView.state.doc.toString();
	}

	onMount(() => {
		const startState = EditorState.create({
			doc: value,
			extensions: [
				basicSetup,
				variableDecorations,
				theme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						value = update.state.doc.toString();
					}
				}),
				EditorView.domEventHandlers({
					keydown(_event, _view) {
						// Allow normal text editing, CodeMirror handles everything properly
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

			editorView.dispatch(dispatch);
		}
	});
</script>

<div bind:this={editorElement} class={className}></div>
