/**
 * Type declarations for enhancedInteractiveMode.js
 */

interface OperationResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function enhancedKeyManagement(): Promise<OperationResult>;
export function searchAndListKeys(): Promise<void>;
export function addOrImportKey(): Promise<void>;
export function generateNewKey(): Promise<void>;
export function viewKeyDetails(preloadedKeys?: any[]): Promise<void>;
export function exportKeys(): Promise<void>;
export function removeKeys(): Promise<void>;
export function runDiagnostics(): Promise<void>;
export function fixDiagnosticIssues(diagnosticResults: any): Promise<void>;
export function enhancedInteractiveSend(): Promise<OperationResult>;
export function preloadEnhancedMode(): Promise<void>;
