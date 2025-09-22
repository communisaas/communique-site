// Main entry point for legislative abstraction layer
export * from './adapters/registry';
export * from './delivery/pipeline';
export * from './resolution/variables';

// Selective exports to avoid naming conflicts
export type {
	LegislativeJurisdiction,
	Office,
	ContactMethod,
	Representative,
	Chamber,
	LegislativeSystem,
	DeliveryCapability,
	Jurisdiction,
	JurisdictionType
} from './models';

export type {
	Address,
	DeliveryRequest,
	DeliveryResult,
	LegislativeTemplate,
	LegislativeUser
} from './adapters/base';

export { LegislativeAdapter } from './adapters/base';

// Convenience exports
export { USCongressAdapter } from './adapters/us-congress';
export { adapterRegistry } from './adapters/registry';
export { deliveryPipeline } from './delivery/pipeline';
export { variableResolver } from './resolution/variables';
