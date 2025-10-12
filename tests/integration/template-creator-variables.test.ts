/**
 * Template Creator Variable System Tests
 * 
 * Focused tests for variable styling and classification functionality
 * without the complexity of CodeMirror component rendering.
 */

import { describe, it, expect } from 'vitest';
import { 
	getVariableMarkClasses, 
	getVariableTipMessage, 
	isSystemVariable, 
	isUserEditableVariable,
	parseTemplateVariables
} from '$lib/utils/variable-styling';

describe('Template Creator Variable System', () => {
	describe('Variable Classification', () => {
		it('should classify system variables correctly', () => {
			// Test system variables
			expect(getVariableMarkClasses('Name', true)).toBe('cm-variable-system');
			expect(getVariableMarkClasses('Address', true)).toBe('cm-variable-system');
			expect(getVariableMarkClasses('Representative Name', true)).toBe('cm-variable-system');
			expect(getVariableMarkClasses('City', true)).toBe('cm-variable-system');
			expect(getVariableMarkClasses('State', true)).toBe('cm-variable-system');
			
			// Test user-editable variables
			expect(getVariableMarkClasses('Personal Connection', true)).toBe('cm-variable-needs-input');
			expect(getVariableMarkClasses('Phone', true)).toBe('cm-variable-needs-input');
			expect(getVariableMarkClasses('Your Story', true)).toBe('cm-variable-needs-input');
			
			// Test unknown variables
			expect(getVariableMarkClasses('Unknown Variable', true)).toBe('cm-variable-error');
		});
		
		it('should identify system variables correctly', () => {
			expect(isSystemVariable('Name')).toBe(true);
			expect(isSystemVariable('Address')).toBe(true);
			expect(isSystemVariable('Representative')).toBe(true);
			expect(isSystemVariable('Personal Connection')).toBe(false);
			expect(isSystemVariable('Phone')).toBe(false);
			expect(isSystemVariable('Unknown')).toBe(false);
		});
		
		it('should identify user-editable variables correctly', () => {
			expect(isUserEditableVariable('Personal Connection')).toBe(true);
			expect(isUserEditableVariable('Phone')).toBe(true);
			expect(isUserEditableVariable('Your Story')).toBe(true);
			expect(isUserEditableVariable('Name')).toBe(false);
			expect(isUserEditableVariable('Address')).toBe(false);
			expect(isUserEditableVariable('Unknown')).toBe(false);
		});
	});
	
	describe('Variable Tip Messages', () => {
		it('should provide appropriate tip messages for system variables', () => {
			expect(getVariableTipMessage('Name')).toContain("Auto-filled from user's profile");
			expect(getVariableTipMessage('Address')).toContain("Auto-filled from user's verified address");
			expect(getVariableTipMessage('Representative Name')).toContain("Auto-filled based on user's location");
			expect(getVariableTipMessage('City')).toContain("Auto-filled from user's address");
		});
		
		it('should provide appropriate tip messages for user-editable variables', () => {
			expect(getVariableTipMessage('Personal Connection')).toContain('Your template users will add their personal story');
		});
		
		it('should provide fallback message for unknown variables', () => {
			expect(getVariableTipMessage('Unknown Variable')).toBe('This placeholder will be filled automatically');
		});
	});
	
	describe('Template Variable Parsing', () => {
		it('should parse variables from template content', () => {
			const content = 'Dear [Representative Name], I am [Name] from [City], [State]. [Personal Connection] Thank you.';
			const variables = parseTemplateVariables(content);
			
			expect(variables).toHaveLength(5);
			expect(variables[0].variable).toBe('Representative Name');
			expect(variables[0].type).toBe('system');
			expect(variables[1].variable).toBe('Name');
			expect(variables[1].type).toBe('system');
			expect(variables[2].variable).toBe('City');
			expect(variables[2].type).toBe('system');
			expect(variables[3].variable).toBe('State');
			expect(variables[3].type).toBe('system');
			expect(variables[4].variable).toBe('Personal Connection');
			expect(variables[4].type).toBe('user-editable');
		});
		
		it('should handle empty content', () => {
			expect(parseTemplateVariables('')).toEqual([]);
			expect(parseTemplateVariables(null as any)).toEqual([]);
			expect(parseTemplateVariables(undefined as any)).toEqual([]);
		});
		
		it('should detect unknown variables', () => {
			const content = 'This has an [Unknown Variable] in it.';
			const variables = parseTemplateVariables(content);
			
			expect(variables).toHaveLength(1);
			expect(variables[0].variable).toBe('Unknown Variable');
			expect(variables[0].type).toBe('unknown');
		});
		
		it('should track variable positions correctly', () => {
			const content = 'Hello [Name], from [City]';
			const variables = parseTemplateVariables(content);
			
			expect(variables[0].start).toBe(6);
			expect(variables[0].end).toBe(12);
			expect(variables[0].placeholder).toBe('[Name]');
			
			expect(variables[1].start).toBe(19);
			expect(variables[1].end).toBe(25);
			expect(variables[1].placeholder).toBe('[City]');
		});
	});
	
	describe('Address Button Integration', () => {
		it('should identify Address as an essential system variable', () => {
			expect(isSystemVariable('Address')).toBe(true);
			expect(getVariableMarkClasses('Address', true)).toBe('cm-variable-system');
			expect(getVariableTipMessage('Address')).toContain("Auto-filled from user's verified address");
		});
		
		it('should handle Address variable in different formats', () => {
			expect(isSystemVariable('Address')).toBe(true);
			expect(isSystemVariable('Your Address')).toBe(true);
			
			expect(getVariableMarkClasses('Address', true)).toBe('cm-variable-system');
			expect(getVariableMarkClasses('Your Address', true)).toBe('cm-variable-system');
		});
	});
	
	describe('Congressional vs General Templates', () => {
		it('should classify representative variables as system variables', () => {
			expect(isSystemVariable('Representative')).toBe(true);
			expect(isSystemVariable('Representative Name')).toBe(true);
			expect(isSystemVariable('Rep Name')).toBe(true);
			expect(isSystemVariable('Senator')).toBe(true);
			expect(isSystemVariable('Senator Name')).toBe(true);
			expect(isSystemVariable('Senior Senator')).toBe(true);
			expect(isSystemVariable('Junior Senator')).toBe(true);
		});
		
		it('should provide appropriate tips for representative variables', () => {
			expect(getVariableTipMessage('Representative')).toContain("Auto-filled based on user's location");
			expect(getVariableTipMessage('Senator')).toContain("Auto-filled based on user's location");
		});
	});
});