"""
Background jobs scheduler for VidyaMithra.
Handles:
- Opportunity expiry checks every 6 hours
- Periodic fetching from RSS feeds and public APIs every 6 hours
- Duplicate removal
- AI enrichment of opportunities
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.services import opportunity_service

logger = logging.getLogger(__name__)


async def check_expired_opportunities_job():
    """Check and mark opportunities as expired, remove duplicates."""
    logger.info("Running job: check_expired_opportunities_job")
    db: Session = SessionLocal()
    try:
        expired = opportunity_service.cleanup_expired_opportunities(db)
        dupes = opportunity_service.remove_duplicates(db)
        logger.info(f"Marked {expired} expired, removed {dupes} duplicates.")
    except Exception as e:
        logger.error(f"Error in check_expired_opportunities_job: {e}")
    finally:
        db.close()


async def fetch_external_opportunities_job():
    """Fetch new opportunities from RSS feeds and public APIs."""
    logger.info("Running job: fetch_external_opportunities_job")
    db: Session = SessionLocal()
    try:
        rss_count = await opportunity_service.fetch_rss_opportunities(db)
        api_count = await opportunity_service.fetch_public_api_opportunities(db)
        logger.info(f"Fetched {rss_count} from RSS, {api_count} from APIs.")
    except Exception as e:
        logger.error(f"Error in fetch_external_opportunities_job: {e}")
    finally:
        db.close()


async def refresh_trending_opportunities_job():
    """Periodic AI-powered discovery for trending roles."""
    logger.info("Running job: refresh_trending_opportunities_job")
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
    except Exception as e:
        logger.error(f"Error in refresh_trending_opportunities_job: {e}")
    finally:
        db.close()


async def enrich_opportunities_job():
    """Run AI enrichment on opportunities missing skill tags."""
    logger.info("Running job: enrich_opportunities_job")
    db: Session = SessionLocal()
    try:
        count = await opportunity_service.enrich_opportunities_with_ai(db)
        logger.info(f"Enriched {count} opportunities with AI skill tags.")
    except Exception as e:
        logger.error(f"Error in enrich_opportunities_job: {e}")
    finally:
        db.close()


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

    scheduler.start()
    logger.info("Background scheduler started with 6-hour cycles.")
    return scheduler
