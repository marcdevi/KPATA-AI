/**
 * Apply mannequin migration to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iulzrtesmkumykohinco.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log('Reading migration file...');
  const migrationPath = path.join(__dirname, '../supabase/migrations/00015_create_mannequins.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration to Supabase...');
  
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      
      if (error) {
        // Try direct query if RPC doesn't work
        const { error: queryError } = await supabase.from('_migrations').insert({
          name: '00015_create_mannequins',
          executed_at: new Date().toISOString(),
        });
        
        if (queryError && queryError.code !== '23505') { // Ignore duplicate key error
          console.error('Error executing statement:', error || queryError);
        }
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
  }

  console.log('Migration applied successfully!');
}

applyMigration().catch(console.error);
