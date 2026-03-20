"""
Background jobs scheduler for LakshyaTrack.
Handles:
- Opportunity expiry checks every 6 hours
- Periodic fetching from RSS feeds and public APIs every 6 hours
- Duplicate removal
- AI enrichment of opportunities
"""
import logging
from typing import Any, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, get_db_session
from app.services import document_store_service, opportunity_service

logger = logging.getLogger(__name__)


def _log_job_event(job_name: str, status: str, details: Optional[dict[str, Any]] = None) -> None:
    document_store_service.record_task_log(
        task_name=job_name,
        status=status,
        source="scheduler",
        details=details or {},
    )


async def check_expired_opportunities_job():
    """Check and mark opportunities as expired, remove duplicates."""
    logger.info("Running job: check_expired_opportunities_job")
    _log_job_event("check_expired_opportunities_job", "started")
    db: Session = SessionLocal()
    try:
        expired = opportunity_service.cleanup_expired_opportunities(db)
        dupes = opportunity_service.remove_duplicates(db)
        logger.info(f"Marked {expired} expired, removed {dupes} duplicates.")
        _log_job_event(
            "check_expired_opportunities_job",
            "success",
            {"expired_count": expired, "duplicate_count": dupes},
        )
    except Exception as e:
        logger.error(f"Error in check_expired_opportunities_job: {e}")
        _log_job_event(
            "check_expired_opportunities_job",
            "failed",
            {"error": str(e)},
        )
    finally:
        db.close()


async def fetch_external_opportunities_job():
    """Fetch new opportunities from RSS feeds and public APIs."""
    logger.info("Running job: fetch_external_opportunities_job")
    _log_job_event("fetch_external_opportunities_job", "started")
    db: Session = SessionLocal()
    try:
        rss_count = await opportunity_service.fetch_rss_opportunities(db)
        api_count = await opportunity_service.fetch_public_api_opportunities(db)
        logger.info(f"Fetched {rss_count} from RSS, {api_count} from APIs.")
        _log_job_event(
            "fetch_external_opportunities_job",
            "success",
            {"rss_count": rss_count, "api_count": api_count},
        )
    except Exception as e:
        logger.error(f"Error in fetch_external_opportunities_job: {e}")
        _log_job_event(
            "fetch_external_opportunities_job",
            "failed",
            {"error": str(e)},
        )
    finally:
        db.close()


async def refresh_trending_opportunities_job():
    """Periodic AI-powered discovery for trending roles."""
    logger.info("Running job: refresh_trending_opportunities_job")
    _log_job_event("refresh_trending_opportunities_job", "started")
    db: Session = SessionLocal()

    trending_roles = [
        "Software Engineer",
        "Data Scientist",
        "Product Manager",
        "UX Designer",
        "DevOps Engineer",
        "Full Stack Developer",
        "Machine Learning Engineer",
    ]

    try:
        for role in trending_roles:
            logger.info(f"Discovering opportunities for: {role}")
            await opportunity_service.generate_opportunities(
                target_role=role,
                skills=[],
                level="Beginner",
                db=db
            )
        logger.info("Trending opportunities refresh completed.")
        _log_job_event(
            "refresh_trending_opportunities_job",
            "success",
            {"roles_processed": trending_roles},
        )
    except Exception as e:
        logger.error(f"Error in refresh_trending_opportunities_job: {e}")
        _log_job_event(
            "refresh_trending_opportunities_job",
            "failed",
            {"error": str(e)},
        )
    finally:
        db.close()


async def enrich_opportunities_job():
    """Run AI enrichment on opportunities missing skill tags."""
    logger.info("Running job: enrich_opportunities_job")
    _log_job_event("enrich_opportunities_job", "started")
    db: Session = SessionLocal()
    try:
        count = await opportunity_service.enrich_opportunities_with_ai(db)
        logger.info(f"Enriched {count} opportunities with AI skill tags.")
        _log_job_event(
            "enrich_opportunities_job",
            "success",
            {"enriched_count": count},
        )
    except Exception as e:
        logger.error(f"Error in enrich_opportunities_job: {e}")
        _log_job_event(
            "enrich_opportunities_job",
            "failed",
            {"error": str(e)},
        )
    finally:
        db.close()


async def expire_subscriptions_job():
    """Check and expire active subscriptions past their end date."""
    logger.info("Running job: expire_subscriptions_job")
    _log_job_event("expire_subscriptions_job", "started")
    db: Session = SessionLocal()
    try:
        from app.services.subscription_service import expire_subscriptions
        count = expire_subscriptions(db)
        logger.info(f"Expired {count} subscriptions/micro-purchases.")
        _log_job_event(
            "expire_subscriptions_job",
            "success",
            {"expired_count": count},
        )
    except Exception as e:
        logger.error(f"Error in expire_subscriptions_job: {e}")
        _log_job_event(
            "expire_subscriptions_job",
            "failed",
            {"error": str(e)},
        )
    finally:
        db.close()


async def auto_populate_reasoning_job():
    """Auto-populate reasoning questions for all topics and companies."""
    logger.info("Running job: auto_populate_reasoning_job")
    _log_job_event("auto_populate_reasoning_job", "started")
    try:
        from app.services.reasoning_service import auto_populate_all
        results = await auto_populate_all()
        total_topics = sum(
            v for v in results.get("topics", {}).values() if isinstance(v, int)
        )
        total_companies = sum(
            v for v in results.get("companies", {}).values() if isinstance(v, int)
        )
        fallback_seeded = results.get("fallback_seeded", 0)
        logger.info(
            "Reasoning auto-populate: %d topic questions, %d company questions, %d fallback seeded.",
            total_topics, total_companies, fallback_seeded,
        )
        _log_job_event(
            "auto_populate_reasoning_job",
            "success",
            {
                "topic_questions_added": total_topics,
                "company_questions_added": total_companies,
                "fallback_seeded": fallback_seeded,
            },
        )
    except Exception as e:
        logger.error(f"Error in auto_populate_reasoning_job: {e}")
        _log_job_event(
            "auto_populate_reasoning_job",
            "failed",
            {"error": str(e)},
        )


def setup_background_jobs():
    """Initialize and start the background scheduler."""
    scheduler = AsyncIOScheduler()

    # 1. Every 6 hours: Fetch from external sources (RSS + APIs)
    scheduler.add_job(
        fetch_external_opportunities_job,
        IntervalTrigger(hours=6),
        id="fetch_external_opps",
        name="Fetch external opportunities every 6 hours",
        replace_existing=True
    )

    # 2. Every 6 hours (offset by 1 hour): Check & cleanup expired + duplicates
    scheduler.add_job(
        check_expired_opportunities_job,
        IntervalTrigger(hours=6, minutes=30),
        id="check_expired_opps",
        name="Check expired opportunities every 6 hours",
        replace_existing=True
    )

    # 3. Every 12 hours: Refresh trending AI-generated opportunities
    scheduler.add_job(
        refresh_trending_opportunities_job,
        CronTrigger(hour="*/12"),
        id="refresh_trending_opps",
        name="Refresh trending opportunities every 12 hours",
        replace_existing=True
    )

    # 4. Every 6 hours: AI skill extraction for untagged opportunities
    scheduler.add_job(
        enrich_opportunities_job,
        IntervalTrigger(hours=6, minutes=15),
        id="enrich_opps",
        name="AI enrich opportunities every 6 hours",
        replace_existing=True
    )

    # 5. Every 30 minutes: Expire outdated subscriptions
    scheduler.add_job(
        expire_subscriptions_job,
        IntervalTrigger(minutes=30),
        id="expire_subscriptions",
        name="Expire outdated subscriptions every 30 minutes",
        replace_existing=True
    )

    # 6. Every 8 hours: Auto-populate reasoning questions via AI
    scheduler.add_job(
        auto_populate_reasoning_job,
        IntervalTrigger(hours=8),
        id="auto_populate_reasoning",
        name="Auto-populate reasoning questions every 8 hours",
        replace_existing=True
    )

    scheduler.start()
    logger.info("Background scheduler started with opportunity + subscription + reasoning cycles.")
    return scheduler
