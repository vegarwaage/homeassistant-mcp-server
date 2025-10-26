// ABOUTME: Input validation utilities for MCP tool arguments
// ABOUTME: Provides type-safe validation helpers to prevent invalid inputs

/**
 * Validates that a value is a positive number
 * @param value - The value to validate
 * @param name - The parameter name (for error messages)
 * @param defaultValue - Optional default value if not provided
 * @returns The validated number
 * @throws {Error} If value is not a positive number
 */
export function validatePositiveNumber(
  value: any,
  name: string,
  defaultValue?: number
): number {
  // Use default if value not provided
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`${name} is required`);
  }

  // Convert to number if string
  const num = typeof value === 'string' ? parseFloat(value) : value;

  // Validate
  if (typeof num !== 'number' || isNaN(num) || num <= 0) {
    throw new Error(`${name} must be a positive number, got: ${value}`);
  }

  return num;
}

/**
 * Validates that a value is a non-negative integer
 * @param value - The value to validate
 * @param name - The parameter name (for error messages)
 * @param defaultValue - Optional default value if not provided
 * @returns The validated integer
 * @throws {Error} If value is not a non-negative integer
 */
export function validateNonNegativeInteger(
  value: any,
  name: string,
  defaultValue?: number
): number {
  // Use default if value not provided
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`${name} is required`);
  }

  // Convert to number if string
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  // Validate
  if (typeof num !== 'number' || isNaN(num) || num < 0 || !Number.isInteger(num)) {
    throw new Error(`${name} must be a non-negative integer, got: ${value}`);
  }

  return num;
}

/**
 * Validates that a string is not empty
 * @param value - The value to validate
 * @param name - The parameter name (for error messages)
 * @returns The validated string
 * @throws {Error} If value is not a non-empty string
 */
export function validateNonEmptyString(value: any, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

/**
 * Validates that a value is a boolean or converts string to boolean
 * @param value - The value to validate
 * @param name - The parameter name (for error messages)
 * @param defaultValue - Optional default value if not provided
 * @returns The validated boolean
 * @throws {Error} If value cannot be converted to boolean
 */
export function validateBoolean(
  value: any,
  name: string,
  defaultValue?: boolean
): boolean {
  // Use default if value not provided
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`${name} is required`);
  }

  // Handle boolean
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle string conversions
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') {
      return true;
    }
    if (lower === 'false' || lower === 'no' || lower === '0') {
      return false;
    }
  }

  throw new Error(`${name} must be a boolean value, got: ${value}`);
}

/**
 * Validates that a file size is within limits
 * @param size - The size in bytes
 * @param maxSize - Maximum allowed size
 * @param name - The parameter name (for error messages)
 * @throws {Error} If size exceeds limit
 */
export function validateFileSize(size: number, maxSize: number, name: string): void {
  if (size > maxSize) {
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    const maxMB = (maxSize / 1024 / 1024).toFixed(2);
    throw new Error(
      `${name} size (${sizeMB}MB) exceeds maximum allowed size (${maxMB}MB)`
    );
  }
}
