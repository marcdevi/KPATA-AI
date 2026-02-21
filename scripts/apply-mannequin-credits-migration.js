#!/usr/bin/env node

/**
 * Apply mannequin credits migration to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '00016_update_mannequin_credits.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration to update mannequin credits...');
    
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
    console.log('Custom mannequin jobs now cost 2 credits, regular jobs cost 1 credit.');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();
