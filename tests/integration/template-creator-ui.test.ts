/**
 * Template Creator UI Integration Tests
 * 
 * Tests for the template creator components focusing on the recently enhanced
 * variable highlighting, Address button functionality, and CodeMirror integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import type { TemplateCreationContext } from '$lib/types/template';

// Mock window.matchMedia before any imports that might use it
Object.defineProperty(window, 'matchMedia', {
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	})),
	writable: true
});

// Import components to test
import MessageEditor from '$lib/components/template/creator/MessageEditor.svelte';
import CodeMirrorEditor from '$lib/components/template/creator/CodeMirrorEditor.svelte';
import * as variableStyling from '$lib/utils/variable-styling';

// Mock CodeMirror completely for testing
vi.mock('@codemirror/view', () => {
	const mockEditorView = vi.fn().mockImplementation(() => ({
		destroy: vi.fn(),
		dispatch: vi.fn(),
		focus: vi.fn(),
		state: {
			doc: { toString: () => '', length: 0 },
			selection: { main: { from: 0, to: 0, head: 0 } }
		}
	}));

	// Add static methods to the mock constructor
	Object.assign(mockEditorView, {
		baseTheme: vi.fn(() => ({})),
		theme: vi.fn(() => ({})),
		decorations: { from: vi.fn() },
		atomicRanges: { of: vi.fn() },
		updateListener: { of: vi.fn(() => ({})) },
		domEventHandlers: vi.fn(() => ({}))
	});

	return {
		EditorView: mockEditorView,
		Decoration: {
			none: {},
			set: vi.fn((decorations) => decorations),
			mark: vi.fn((spec) => ({
				range: vi.fn((from, to) => ({ from, to, spec }))
			}))
		},
		keymap: {
			of: vi.fn(() => ({}))
		}
	};
});

vi.mock('@codemirror/state', () => ({
	EditorState: {
		create: vi.fn(() => ({}))
	},
	StateField: {
		define: vi.fn((config) => config)
	}
}));

vi.mock('codemirror', () => ({
	basicSetup: []
}));

// Mock svelte/motion to prevent matchMedia calls and provide proper store interface
vi.mock('svelte/motion', () => ({
	spring: vi.fn((initialValue) => {
		let value = initialValue;
		const subscribers = new Set();
		return {
			subscribe: vi.fn((callback) => {
				callback(value);
				subscribers.add(callback);
				return {
					unsubscribe: vi.fn(() => {
						subscribers.delete(callback);
					})
				};
			}),
			set: vi.fn((newValue) => {
				value = newValue;
				subscribers.forEach(callback => callback(value));
			}),
			update: vi.fn((fn) => {
				value = fn(value);
				subscribers.forEach(callback => callback(value));
			})
		};
	}),
	tweened: vi.fn((initialValue) => {
		let value = initialValue;
		const subscribers = new Set();
		return {
			subscribe: vi.fn((callback) => {
				callback(value);
				subscribers.add(callback);
				return {
					unsubscribe: vi.fn(() => {
						subscribers.delete(callback);
					})
				};
			}),
			set: vi.fn((newValue) => {
				value = newValue;
				subscribers.forEach(callback => callback(value));
			}),
			update: vi.fn((fn) => {
				value = fn(value);
				subscribers.forEach(callback => callback(value));
			})
		};
	})
}));

// Mock variable styling utilities
vi.mock('$lib/utils/variable-styling', () => ({
	getVariableMarkClasses: vi.fn((variable: string, isEmpty: boolean) => {
		if (variable === 'Name' || variable === 'Address') return 'cm-variable-system';
		if (variable === 'Personal Connection') return 'cm-variable-needs-input';
		return 'cm-variable-ready';
	}),
	getVariableTipMessage: vi.fn((variable: string) => `Tip for ${variable}`),
	isSystemVariable: vi.fn((variable: string) => variable === 'Name' || variable === 'Address'),
	isUserEditableVariable: vi.fn((variable: string) => variable === 'Personal Connection')
}));

// Mock template resolver
vi.mock('$lib/utils/templateResolver', () => ({
	resolveTemplate: vi.fn(() => ({ resolvedContent: 'Resolved template' }))
}));

describe('Template Creator UI Tests', () => {
	let mockContext: TemplateCreationContext;
	let mockData: { preview: string; variables: string[] };

	beforeEach(() => {
		mockContext = {
			channelId: 'certified',
			type: 'advocacy',
			objective: 'Test objective'
		};

		mockData = {
			preview: '',
			variables: []
		};

		// Reset all mocks
		vi.clearAllMocks();
	});

	describe('MessageEditor Component', () => {
		it('should render with correct initial state', () => {
			const { getByText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			// Should show core elements header for congressional templates
			expect(getByText(/Core elements/)).toBeTruthy();
			expect(getByText(/Address validates constituents/)).toBeTruthy();
		});

		it('should display available variables for congressional templates', () => {
			const { getByText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			// Should show core variables
			expect(getByText(/Name/)).toBeTruthy();
			expect(getByText(/Personal Connection/)).toBeTruthy();
			expect(getByText(/Address/)).toBeTruthy();
			expect(getByText(/Representative/)).toBeTruthy();
		});

		it('should handle Address button toggle correctly', async () => {
			mockData.preview = 'Dear Representative,\n\nTest message.\n\nSincerely,\n[Name]';
			
			const { getByLabelText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			const addressToggle = getByLabelText(/Address/);
			
			// Initially unchecked and no Address in preview
			expect(addressToggle).not.toBeChecked();
			expect(mockData.preview).not.toContain('[Address]');

			// Click to enable Address
			await fireEvent.click(addressToggle);

			await waitFor(() => {
				// Should add Address after Name in signature
				expect(mockData.preview).toContain('Sincerely,\n[Name]\n[Address]');
				expect(mockData.variables).toContain('[Address]');
			});
		});

		it('should remove Address when toggle is disabled', async () => {
			mockData.preview = 'Dear Representative,\n\nTest message.\n\nSincerely,\n[Name]\n[Address]';
			mockData.variables = ['[Name]', '[Address]'];
			
			const component = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			const addressToggle = component.getByLabelText(/Address/);
			
			// Initially should be checked since Address exists
			await waitFor(() => {
				expect(addressToggle).toBeChecked();
			});

			// Click to disable Address
			await fireEvent.click(addressToggle);

			await waitFor(() => {
				// Should remove Address from preview
				expect(mockData.preview).not.toContain('[Address]');
				expect(mockData.variables).not.toContain('[Address]');
			});
		});

		it('should create signature block when no signature exists', async () => {
			mockData.preview = 'Dear Representative,\n\nTest message without signature.';
			
			const { getByLabelText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			const addressToggle = getByLabelText(/Address/);
			await fireEvent.click(addressToggle);

			await waitFor(() => {
				// Should append complete signature block
				expect(mockData.preview).toContain('Sincerely,\n[Name]\n[Address]');
			});
		});

		it('should show preview button when content is substantial', async () => {
			mockData.preview = 'This is a long message with [Name] and [Personal Connection] variables that should trigger the preview button to appear.';
			
			const { getByText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			await waitFor(() => {
				expect(getByText(/Preview/)).toBeTruthy();
			});
		});

		it('should calculate word count correctly excluding variables', () => {
			mockData.preview = 'Dear [Representative], I am [Name] writing this message with ten words total.';
			
			const { getByText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			// Should count actual words, not variable placeholders
			expect(getByText(/10 words/)).toBeTruthy();
		});
	});

	describe('CodeMirrorEditor Component', () => {
		it('should render CodeMirror editor', () => {
			const { container } = render(CodeMirrorEditor, {
				props: {
					value: 'Test content',
					onVariableClick: vi.fn()
				}
			});

			// Should create editor element
			expect(container.querySelector('.cm-editor')).toBeTruthy();
		});

		it('should apply variable highlighting classes', async () => {
			const onVariableClick = vi.fn();
			
			render(CodeMirrorEditor, {
				props: {
					value: 'Dear [Name], this is a test with [Personal Connection].',
					onVariableClick
				}
			});

			await waitFor(() => {
				// Verify that getVariableMarkClasses was called with correct parameters
				expect(vi.mocked(variableStyling.getVariableMarkClasses))
					.toHaveBeenCalledWith('Name', true);
				expect(vi.mocked(variableStyling.getVariableMarkClasses))
					.toHaveBeenCalledWith('Personal Connection', true);
			});
		});

		it('should handle variable click events', async () => {
			const onVariableClick = vi.fn();
			
			const { container } = render(CodeMirrorEditor, {
				props: {
					value: 'Test with [Name] variable.',
					onVariableClick
				}
			});

			await waitFor(() => {
				// Find element with data-variable attribute
				const variableElement = container.querySelector('[data-variable="Name"]');
				expect(variableElement).toBeTruthy();
			});
		});

		it('should provide insert variable functionality', () => {
			let insertVariableFunction: ((variable: string) => void) | undefined;
			
			render(CodeMirrorEditor, {
				props: {
					value: 'Initial content',
					insertVariable: (fn) => { insertVariableFunction = fn; },
					onVariableClick: vi.fn()
				}
			});

			// Should bind the insert function
			expect(insertVariableFunction).toBeDefined();
		});

		it('should provide append to document functionality', () => {
			let appendToDocumentFunction: ((text: string, preserveCursor?: boolean) => void) | undefined;
			
			render(CodeMirrorEditor, {
				props: {
					value: 'Initial content',
					appendToDocument: (fn) => { appendToDocumentFunction = fn; },
					onVariableClick: vi.fn()
				}
			});

			// Should bind the append function
			expect(appendToDocumentFunction).toBeDefined();
		});
	});

	describe('Variable System Integration', () => {
		it('should sync variables array with content changes', async () => {
			mockData.preview = 'Initial content';
			
			const component = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			// Simulate content change with variables
			mockData.preview = 'Updated content with [Name] and [Personal Connection]';
			
			await waitFor(() => {
				// Variables array should be updated
				expect(mockData.variables).toContain('[Name]');
				expect(mockData.variables).toContain('[Personal Connection]');
			});
		});
	});

	describe('Congressional vs General Templates', () => {
		it('should show different messaging for general templates', () => {
			const generalContext = { ...mockContext, channelId: 'general' };
			
			const { getByText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: generalContext
				}
			});

			// Should show general messaging instead of constituent validation
			expect(getByText(/Core elements for your template/)).toBeTruthy();
		});

		it('should include Representative variable only for congressional templates', () => {
			const generalContext = { ...mockContext, channelId: 'general' };
			
			const { queryByText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: generalContext
				}
			});

			// Representative should not be available for general templates
			expect(queryByText(/Representative/)).toBeFalsy();
		});

		it('should show star icon for Address in congressional templates', () => {
			const { container } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			// Should show star (★) for essential government variable
			expect(container.textContent).toContain('★');
		});
	});

	describe('Error Handling and Edge Cases', () => {
		it('should handle empty content gracefully', () => {
			mockData.preview = '';
			
			expect(() => {
				render(MessageEditor, {
					props: {
						data: mockData,
						context: mockContext
					}
				});
			}).not.toThrow();
		});

		it('should handle malformed signatures', async () => {
			mockData.preview = 'Message with malformed signature\nBest regards,';
			
			const { getByLabelText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			const addressToggle = getByLabelText(/Address/);
			
			// Should handle gracefully without errors
			expect(() => fireEvent.click(addressToggle)).not.toThrow();
		});

		it('should handle multiple Address variables', async () => {
			mockData.preview = 'Message with [Address] in middle and [Address] at end';
			
			const { getByLabelText } = render(MessageEditor, {
				props: {
					data: mockData,
					context: mockContext
				}
			});

			const addressToggle = getByLabelText(/Address/);
			await fireEvent.click(addressToggle); // Should toggle off

			await waitFor(() => {
				// Should remove all instances of [Address]
				expect(mockData.preview).not.toContain('[Address]');
			});
		});
	});
});