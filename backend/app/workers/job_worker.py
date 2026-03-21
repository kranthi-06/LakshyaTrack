import asyncio

from app.services.job_queue import run_worker_forever


if __name__ == "__main__":
    asyncio.run(run_worker_forever())
