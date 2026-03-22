/**
 * Environment configuration contract for kinetic-portfolio.
 * 
 * CRITICAL: This module is safe to import in test environments.
 * - `ENV` object always exports with safe defaults (empty strings)
 * - `assertEnvValid()` is ONLY called by startServer() - not on import
 * - Tests can import server modules without setting production secrets
 * 
 * See ENV_CONTRACT.md for complete variable definitions and setup.
 */

interface EnvConfig {
  appId: string;
  cookieSecret: string;
  databaseUrl: string;
  oAuthServerUrl: string;
  ownerOpenId: string;
  isProduction: boolean;
  enableLocalAdminAuthBypass: boolean;
  enableLocalContentFallback: boolean;
  forgeApiUrl: string;
  forgeApiKey: string;
  allowedOrigins: string[];
}

interface ValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
}

function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";
  const localAdminAuthBypass = !isProduction && parseBooleanFlag(process.env.LOCAL_ADMIN_AUTH_BYPASS);
  const localContentFallback =
    !isProduction && parseBooleanFlag(process.env.LOCAL_CONTENT_IN_MEMORY_FALLBACK);
  
  const criticalVars = [
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL },
    { name: 'JWT_SECRET', value: process.env.JWT_SECRET },
    { name: 'OAUTH_SERVER_URL', value: process.env.OAUTH_SERVER_URL },
    { name: 'OWNER_OPEN_ID', value: process.env.OWNER_OPEN_ID },
  ].filter(variable => {
    if (variable.name === "DATABASE_URL" && localContentFallback) {
      return false;
    }

    if (
      (variable.name === "OAUTH_SERVER_URL" || variable.name === "OWNER_OPEN_ID") &&
      localAdminAuthBypass
    ) {
      return false;
    }

    return true;
  });
  
  for (const { name, value } of criticalVars) {
    if (!value || value.trim() === '') {
      missing.push(name);
    }
  }
  
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters for security');
  }
  
  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function createEnv(): EnvConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const localAdminAuthBypass = parseBooleanFlag(process.env.LOCAL_ADMIN_AUTH_BYPASS);
  const localContentFallback = parseBooleanFlag(process.env.LOCAL_CONTENT_IN_MEMORY_FALLBACK);

  return {
    appId: process.env.VITE_APP_ID ?? "",
    cookieSecret: process.env.JWT_SECRET ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "",
    oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
    ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
    isProduction,
    enableLocalAdminAuthBypass: !isProduction && localAdminAuthBypass,
    enableLocalContentFallback: !isProduction && localContentFallback,
    forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
    forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  };
}

/**
 * Validates that all critical environment variables are present and valid.
 * 
 * IMPORTANT: This function is ONLY called by startServer() in index.ts.
 * It is NOT called on module import, allowing tests to safely import server modules.
 * 
 * @throws Exits process with code 1 if validation fails
 */
export function assertEnvValid(): void {
  const validation = validateEnv();
  
  if (!validation.valid) {
    const errorMessage = [
      '',
      '═══════════════════════════════════════════════════════════',
      '  [FATAL] Environment Configuration Error',
      '═══════════════════════════════════════════════════════════',
      '',
    ];
    
    if (validation.missing.length > 0) {
      errorMessage.push('  Missing required environment variables:');
      validation.missing.forEach(name => {
        errorMessage.push(`    ✗ ${name}`);
      });
      errorMessage.push('');
    }
    
    if (validation.errors.length > 0) {
      errorMessage.push('  Validation errors:');
      validation.errors.forEach(error => {
        errorMessage.push(`    ✗ ${error}`);
      });
      errorMessage.push('');
    }
    
    errorMessage.push('  Server cannot start without proper configuration.');
    errorMessage.push('  Please see ENV_CONTRACT.md for setup instructions.');
    errorMessage.push('');
    errorMessage.push('═══════════════════════════════════════════════════════════');
    errorMessage.push('');
    
    console.error(errorMessage.join('\n'));
    process.exit(1);
  }
}

/**
 * Global environment configuration object.
 * 
 * Always exports with safe defaults (empty strings) to allow test imports.
 * Critical values are validated by assertEnvValid() at server startup.
 */
export const ENV = createEnv();
