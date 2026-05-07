-- Add type column to news table (may already exist on fresh installs)
ALTER TABLE news ADD COLUMN type TEXT NOT NULL DEFAULT 'update';
