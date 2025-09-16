// Main entry point for legislative abstraction layer
export * from './models';
export * from './adapters/base';
export * from './adapters/registry';
export * from './delivery/pipeline';
export * from './resolution/variables';

// Convenience exports
export { USCongressAdapter } from './adapters/us-congress';
export { adapterRegistry } from './adapters/registry';
export { deliveryPipeline } from './delivery/pipeline';
export { variableResolver } from './resolution/variables';
