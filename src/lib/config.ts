/**
 * Centralized Configuration
 *
 * All environment variables and app configuration in one place
 */

// Validate required environment variables
const requiredEnvVars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};

// Check for missing variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
}

export const config = {
  // Supabase
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },

  // Anthropic AI
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    defaultModel: 'claude-sonnet-4-20250514',
    defaultMaxTokens: 16000,
  },

  // Jira (optional)
  jira: {
    host: process.env.JIRA_HOST,
    email: process.env.JIRA_EMAIL,
    apiToken: process.env.JIRA_API_TOKEN,
  },

  // App settings
  app: {
    name: 'Inspector Dom',
    environment: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // File upload limits
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['PDF', 'HTML', 'EMAIL', 'MSG', 'CSV', 'EXCEL'] as const,
    allowedMimeTypes: [
      'application/pdf',
      'text/html',
      'message/rfc822', // .eml
      'application/vnd.ms-outlook', // .msg
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },

  // AI extraction defaults
  extraction: {
    defaultTemperature: 0,
    defaultMaxTokens: 16000,
    maxRetries: 3,
    timeoutMs: 300000, // 5 minutes
  },
} as const;

// Type exports for better IDE support
export type Config = typeof config;
export type FileType = typeof config.upload.allowedTypes[number];
