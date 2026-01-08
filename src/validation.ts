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

// ============================================================================
// Input Sanitization Utilities
// These functions help prevent injection attacks in templates and queries
// ============================================================================

/**
 * Sanitize a string ID to prevent template injection.
 * Only allows alphanumeric characters, underscores, hyphens, and dots.
 * @param id - The ID string to sanitize
 * @param name - Parameter name for error messages
 * @returns The validated ID string
 * @throws {Error} If ID contains invalid characters
 */
export function sanitizeId(id: string, name: string = 'ID'): string {
  if (typeof id !== 'string') {
    throw new Error(`${name} must be a string`);
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(id)) {
    throw new Error(`Invalid ${name} format: "${id}". Only alphanumeric, underscore, hyphen, and dot allowed.`);
  }
  return id;
}

/**
 * Sanitize a Home Assistant entity_id
 * Must be in format: domain.object_id
 * @param entityId - The entity ID to sanitize
 * @returns The validated entity ID
 * @throws {Error} If entity ID format is invalid
 */
export function sanitizeEntityId(entityId: string): string {
  if (typeof entityId !== 'string') {
    throw new Error('entity_id must be a string');
  }
  // Entity IDs must be: domain.object_id where both parts are lowercase alphanumeric with underscores
  if (!/^[a-z_]+\.[a-z0-9_]+$/.test(entityId)) {
    throw new Error(`Invalid entity_id format: "${entityId}". Must be domain.object_id format.`);
  }
  return entityId;
}

/**
 * Sanitize a search/query string to prevent template injection.
 * Escapes single quotes and backslashes for safe use in Jinja2 templates.
 * @param search - The search string to sanitize
 * @returns The sanitized search string
 */
export function sanitizeSearchString(search: string): string {
  if (typeof search !== 'string') {
    throw new Error('Search must be a string');
  }
  // Escape backslashes first, then single quotes
  return search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Sanitize a string for use in SQL LIKE clauses
 * Escapes %, _, and \ characters
 * @param input - The string to sanitize
 * @returns The sanitized string safe for SQL LIKE
 */
export function sanitizeSqlLike(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Validate and clamp a limit parameter
 * @param limit - The limit value
 * @param defaultLimit - Default value if not provided
 * @param maxLimit - Maximum allowed limit
 * @returns The clamped limit value
 */
export function validateLimit(limit: any, defaultLimit: number, maxLimit: number): number {
  if (limit === undefined || limit === null) {
    return defaultLimit;
  }
  const num = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  if (typeof num !== 'number' || isNaN(num)) {
    return defaultLimit;
  }
  return Math.min(Math.max(1, num), maxLimit);
}

/**
 * Validate and clamp an offset parameter
 * @param offset - The offset value
 * @param defaultOffset - Default value if not provided (usually 0)
 * @returns The validated offset (non-negative integer)
 */
export function validateOffset(offset: any, defaultOffset: number = 0): number {
  if (offset === undefined || offset === null) {
    return defaultOffset;
  }
  const num = typeof offset === 'string' ? parseInt(offset, 10) : offset;
  if (typeof num !== 'number' || isNaN(num)) {
    return defaultOffset;
  }
  return Math.max(0, Math.floor(num));
}

/**
 * Estimate token count for a response
 * Uses rough approximation of 4 characters per token
 * @param data - The data to estimate
 * @returns Object with token count and optional warning
 */
export function estimateTokens(data: any): { tokens: number; warning?: string } {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  const tokens = Math.ceil(json.length / 4);
  return {
    tokens,
    warning: tokens > 15000
      ? `Large response (~${tokens} tokens). Consider using filters or pagination to reduce context usage.`
      : undefined
  };
}
