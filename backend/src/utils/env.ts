/**
 * Validate that all required environment variables are set before the server starts.
 * Fail-fast: the process exits immediately if anything critical is missing.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

export function validateEnv(): void {
  // dotenv is already loaded by app.ts, but server.ts calls us first
  // so we load it here as well to be safe
  require('dotenv').config();

  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables:\n   ${missing.join('\n   ')}`);
    process.exit(1);
  }

  // Enforce minimum JWT secret length
  if (process.env.JWT_SECRET!.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters for production safety');
    process.exit(1);
  }

  // Warn if Google Sheets is partially configured
  const SHEETS_VARS = ['GOOGLE_SHEETS_CLIENT_EMAIL', 'GOOGLE_SHEETS_PRIVATE_KEY', 'GOOGLE_SHEETS_SPREADSHEET_ID'];
  const presentSheets = SHEETS_VARS.filter((k) => process.env[k]);
  if (presentSheets.length > 0 && presentSheets.length < SHEETS_VARS.length) {
    const missing = SHEETS_VARS.filter((k) => !process.env[k]);
    console.warn(`⚠️  Partial Google Sheets config — sync disabled. Missing: ${missing.join(', ')}`);
  } else if (presentSheets.length === SHEETS_VARS.length) {
    console.log('📊 Google Sheets sync enabled');
  }

  // Warn if Trello credentials are partially configured
  const TRELLO_VARS = ['TRELLO_API_KEY', 'TRELLO_TOKEN'];
  const presentTrello = TRELLO_VARS.filter((k) => process.env[k]);
  if (presentTrello.length === 1) {
    const missingTrello = TRELLO_VARS.filter((k) => !process.env[k]);
    console.warn(`⚠️  Partial Trello config — server credentials disabled. Missing: ${missingTrello.join(', ')}`);
  } else if (presentTrello.length === TRELLO_VARS.length) {
    console.log('📋 Trello server credentials configured');
  }

  console.log('✅ Environment variables validated');
}
