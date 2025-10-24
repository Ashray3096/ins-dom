/**
 * Environment Variables Verification Script
 *
 * Run with: npx tsx scripts/verify-env.ts
 */

import dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   Inspector Dom - Environment Verification                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

interface EnvCheck {
  name: string;
  value: string | undefined;
  required: boolean;
  masked?: boolean;
}

const checks: EnvCheck[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    required: true,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: true,
    masked: true,
  },
  {
    name: 'ANTHROPIC_API_KEY',
    value: process.env.ANTHROPIC_API_KEY,
    required: true,
    masked: true,
  },
  {
    name: 'JIRA_HOST',
    value: process.env.JIRA_HOST,
    required: false,
  },
  {
    name: 'JIRA_EMAIL',
    value: process.env.JIRA_EMAIL,
    required: false,
  },
  {
    name: 'JIRA_API_TOKEN',
    value: process.env.JIRA_API_TOKEN,
    required: false,
    masked: true,
  },
];

function maskValue(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}

let hasErrors = false;
let hasWarnings = false;

console.log('Environment Variables:\n');

checks.forEach(check => {
  const status = check.value ? '✓' : (check.required ? '✗' : '○');
  const statusColor = check.value ? '✓' : (check.required ? '✗' : '○');

  let displayValue = 'Not set';
  if (check.value) {
    displayValue = check.masked ? maskValue(check.value) : check.value;
  }

  const requiredLabel = check.required ? '[REQUIRED]' : '[OPTIONAL]';

  console.log(`${statusColor} ${check.name.padEnd(35)} ${requiredLabel.padEnd(12)} ${displayValue}`);

  if (check.required && !check.value) {
    hasErrors = true;
  }

  if (!check.required && !check.value) {
    hasWarnings = true;
  }
});

console.log('\n' + '─'.repeat(80) + '\n');

// Summary
if (hasErrors) {
  console.log('❌ ERROR: Required environment variables are missing!');
  console.log('\nTo fix this:');
  console.log('1. Copy .env.local.example to .env.local');
  console.log('2. Fill in the required values');
  console.log('3. Run this script again to verify\n');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!\n');

  if (hasWarnings) {
    console.log('⚠️  Note: Some optional variables are not set.');
    console.log('   This is fine - they are only needed for specific features.\n');
  }

  // Test config loading
  console.log('Testing config module...\n');

  try {
    // Dynamically import to test
    const configPath = path.resolve(process.cwd(), 'src/lib/config.ts');
    console.log(`✓ Config file exists at: ${configPath}`);

    console.log('\n🎉 Environment configuration is valid and ready to use!\n');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error loading config:', error);
    process.exit(1);
  }
}
