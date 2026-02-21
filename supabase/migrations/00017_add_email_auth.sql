-- Add email-based auth support to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'phone_e164'
  ) THEN
    EXECUTE 'ALTER TABLE profiles ALTER COLUMN phone_e164 DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'phone'
  ) THEN
    EXECUTE 'ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON profiles (lower(email))
  WHERE email IS NOT NULL;
