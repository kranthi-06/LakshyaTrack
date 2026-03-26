from app.progress_engine import events, realtime, redis_client


def test_ingest_batch_persists_events_and_publishes_update(monkeypatch):
    captured = {
        "persisted": [],
        "counter_updates": [],
        "invalidations": [],
        "published": [],
    }

    monkeypatch.setattr(
        events,
        "_persist_events_immediately",
        lambda accepted: captured["persisted"].append(list(accepted)) or {"mongo": len(accepted), "sql": len(accepted), "buffered": 0},
    )
    monkeypatch.setattr(
        events,
        "_update_realtime_counters",
        lambda event: captured["counter_updates"].append(event["event_type"]),
    )
    monkeypatch.setattr(
        redis_client,
        "invalidate_user_analytics",
        lambda user_id: captured["invalidations"].append(user_id),
    )
    monkeypatch.setattr(
        realtime,
        "publish_user_update",
        lambda user_id, payload: captured["published"].append((user_id, payload)),
    )

    payload = [
        {"event_type": "page_visit", "user_id": "user-1", "metadata": {"page": "Dashboard"}},
        {"event_type": "quiz_completed", "user_id": "user-1", "metadata": {"quiz_name": "Arrays"}},
    ]

    result = events.ingest_batch(payload)

    assert result["accepted"] == 2
    assert result["duplicates"] == 0
    assert result["rejected"] == 0
    assert result["errors"] == 0
    assert len(captured["persisted"]) == 1
    assert len(captured["persisted"][0]) == 2
    assert captured["counter_updates"] == ["PAGE_VISIT", "QUIZ_COMPLETED"]
    assert captured["invalidations"] == ["user-1", "user-1"]
    assert captured["published"][0][0] == "user-1"
    assert captured["published"][0][1]["eventCount"] == 2


def test_persist_events_immediately_buffers_when_durable_storage_fails(monkeypatch):
    buffered = []

    monkeypatch.setattr(events, "_persist_events_to_mongo", lambda accepted: 0)
    monkeypatch.setattr(events, "_persist_events_to_sql", lambda accepted: 0)
    monkeypatch.setattr(redis_client, "buffer_event", lambda event: buffered.append(event))

    result = events._persist_events_immediately(
        [{"event_type": "PAGE_VISIT", "user_id": "user-1", "timestamp": None}]
    )

    assert result == {"mongo": 0, "sql": 0, "buffered": 1}
    assert len(buffered) == 1


def test_realtime_publish_user_update_reaches_local_subscriber(monkeypatch):
    monkeypatch.setattr(redis_client, "_get_redis", lambda: None)

    subscriber_id, queue = realtime.subscribe_local("user-stream")
    try:
        realtime.publish_user_update(
            "user-stream",
            {"kind": "progress_updated", "userId": "user-stream", "eventCount": 1},
        )
        message = queue.get_nowait()
    finally:
        realtime.unsubscribe_local("user-stream", subscriber_id)

    assert "progress_updated" in message
    assert "user-stream" in message
