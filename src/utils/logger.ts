/**
 * Logger module - Thin wrapper for backward compatibility.
 *
 * This file has been refactored into a modular structure under src/utils/logger/.
 * This wrapper maintains backward compatibility while allowing gradual migration.
 *
 * New code should import directly from 'src/utils/logger/index.js' or specific submodules.
 *
 * @deprecated New imports should use 'src/utils/logger/index.js'
 */

// Re-export everything from the new modular logger
export * from './logger/index.js';
