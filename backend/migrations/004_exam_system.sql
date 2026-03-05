-- Migration 004: Exam Proctoring System
-- Adds exam_violations table and extends quiz_attempts with violation tracking

-- 1. Create exam_violations table
CREATE TABLE IF NOT EXISTS exam_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    violation_type VARCHAR NOT NULL,
    exam_topic VARCHAR,
    exam_difficulty VARCHAR,
    penalty_hours FLOAT DEFAULT 1.0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_exam_violations_user_id ON exam_violations(user_id);
CREATE INDEX IF NOT EXISTS ix_exam_violations_created_at ON exam_violations(created_at);

-- 2. Add violation columns to quiz_attempts (if not exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quiz_attempts' AND column_name = 'violation_flag'
    ) THEN
        ALTER TABLE quiz_attempts ADD COLUMN violation_flag BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quiz_attempts' AND column_name = 'terminated'
    ) THEN
        ALTER TABLE quiz_attempts ADD COLUMN terminated BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
