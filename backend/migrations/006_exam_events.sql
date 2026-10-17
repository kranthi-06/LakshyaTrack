-- Migration 006: Store observed exam events separately from penalty violations.
CREATE TABLE IF NOT EXISTS exam_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_event_id VARCHAR(120) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    exam_topic VARCHAR(200),
    exam_difficulty VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_exam_events_user_client_event UNIQUE (user_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS ix_exam_events_user_created
    ON exam_events(user_id, created_at);
