from app.progress_system.models import ActivityLog


def test_activity_log_uses_non_reserved_python_attribute_name():
    assert "event_metadata" in ActivityLog.__mapper__.attrs
    assert "metadata" not in ActivityLog.__mapper__.attrs
    assert ActivityLog.__table__.c["metadata"].name == "metadata"
