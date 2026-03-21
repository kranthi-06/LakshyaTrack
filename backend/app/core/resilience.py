"""
LakshyaTrack Resilience Engine
============================
Production-grade fault-tolerance infrastructure:
- Circuit Breaker pattern with automatic recovery
- Exponential backoff retry mechanism
- Timeout protection for all external calls
- Rate limiter for flood protection
- System health metrics tracker
- Self-protection layer for cascading failure prevention
"""
import asyncio
import functools
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Deque, Dict, List, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover - optional dependency at runtime
    redis_async = None


# ═══════════════════════════════════════════════════════════════
# CIRCUIT BREAKER
# ═══════════════════════════════════════════════════════════════

class CircuitState(str, Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing — reject calls immediately
    HALF_OPEN = "half_open" # Testing recovery


@dataclass
class CircuitBreaker:
    """
    Prevents cascading failures by disabling calls to a failing dependency.

    States:
        CLOSED  → Normal. Track failures.
        OPEN    → After `failure_threshold` fails, reject immediately.
        HALF_OPEN → After `recovery_timeout` seconds, allow ONE test call.
    """
    name: str
    failure_threshold: int = 5
    recovery_timeout: float = 60.0   # seconds before trying again
    half_open_max_calls: int = 1

    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int = field(default=0, init=False)
    _last_failure_time: float = field(default=0.0, init=False)
    _half_open_calls: int = field(default=0, init=False)
    _success_count: int = field(default=0, init=False)
    _total_calls: int = field(default=0, init=False)

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                logger.info("Circuit '%s' → HALF_OPEN (testing recovery)", self.name)
        return self._state

    def record_success(self) -> None:
        self._total_calls += 1
        self._success_count += 1
        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            logger.info("Circuit '%s' → CLOSED (recovered)", self.name)
        elif self._state == CircuitState.CLOSED:
            self._failure_count = max(0, self._failure_count - 1)

    def record_failure(self) -> None:
        self._total_calls += 1
        self._failure_count += 1
        self._last_failure_time = time.monotonic()

        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            logger.warning("Circuit '%s' → OPEN (recovery failed)", self.name)
        elif self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
            logger.warning(
                "Circuit '%s' → OPEN (threshold %d reached)",
                self.name, self.failure_threshold,
            )

    def allow_request(self) -> bool:
        state = self.state
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.HALF_OPEN:
            self._half_open_calls += 1
            return self._half_open_calls <= self.half_open_max_calls
        return False  # OPEN

    def get_status(self) -> dict:
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "total_calls": self._total_calls,
            "success_count": self._success_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
        }


# Global circuit breaker registry
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0,
) -> CircuitBreaker:
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(
            name=name,
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )
    return _circuit_breakers[name]


def get_all_circuit_breakers() -> Dict[str, dict]:
    return {name: cb.get_status() for name, cb in _circuit_breakers.items()}


# ═══════════════════════════════════════════════════════════════
# RETRY WITH EXPONENTIAL BACKOFF
# ═══════════════════════════════════════════════════════════════

async def retry_with_backoff(
    func: Callable,
    *args,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple = (Exception,),
    circuit_breaker_name: Optional[str] = None,
    **kwargs,
) -> Any:
    """
    Execute an async function with exponential backoff retry.

    Args:
        func: Async callable to execute.
        max_retries: Maximum number of retry attempts.
        base_delay: Initial delay between retries (seconds).
        max_delay: Maximum delay cap.
        backoff_factor: Multiplier for delay growth.
        retryable_exceptions: Tuple of exceptions that trigger a retry.
        circuit_breaker_name: Optional circuit breaker to check before retrying.
    """
    cb = get_circuit_breaker(circuit_breaker_name) if circuit_breaker_name else None
    last_exception = None

    for attempt in range(max_retries + 1):
        # Check circuit breaker
        if cb and not cb.allow_request():
            logger.warning(
                "Circuit '%s' is OPEN — skipping call (attempt %d)",
                circuit_breaker_name, attempt + 1,
            )
            raise CircuitBreakerOpenError(
                f"Circuit breaker '{circuit_breaker_name}' is open"
            )

        try:
            result = await func(*args, **kwargs)
            if cb:
                cb.record_success()
            return result
        except retryable_exceptions as e:
            last_exception = e
            if cb:
                cb.record_failure()

            if attempt >= max_retries:
                logger.error(
                    "All %d retries exhausted for %s: %s",
                    max_retries, func.__name__, str(e),
                )
                raise

            delay = min(base_delay * (backoff_factor ** attempt), max_delay)
            logger.warning(
                "Retry %d/%d for %s after %.1fs (error: %s)",
                attempt + 1, max_retries, func.__name__, delay, str(e),
            )
            await asyncio.sleep(delay)

    raise last_exception  # Should never reach here


class CircuitBreakerOpenError(Exception):
    """Raised when a circuit breaker is open and rejects the call."""
    pass


# ═══════════════════════════════════════════════════════════════
# TIMEOUT PROTECTION
# ═══════════════════════════════════════════════════════════════

async def with_timeout(
    coro,
    timeout_seconds: float = 30.0,
    fallback: Any = None,
    error_message: str = "Operation timed out",
) -> Any:
    """
    Wrap an awaitable with a timeout. Returns fallback on timeout.
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        logger.warning("Timeout (%.1fs): %s", timeout_seconds, error_message)
        if fallback is not None:
            return fallback
        raise TimeoutError(error_message)


# ═══════════════════════════════════════════════════════════════
# RATE LIMITER (in-memory, per-process)
# ═══════════════════════════════════════════════════════════════

@dataclass
class RateLimiter:
    """Simple sliding-window rate limiter."""
    name: str
    max_calls: int = 60
    window_seconds: float = 60.0
    _call_timestamps: Deque[float] = field(default_factory=deque, init=False)

    def _evict_expired(self, cutoff: float) -> None:
        # Use deque popleft for amortized O(1) eviction under high request rates.
        while self._call_timestamps and self._call_timestamps[0] <= cutoff:
            self._call_timestamps.popleft()

    def allow(self) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        self._evict_expired(cutoff)
        if len(self._call_timestamps) >= self.max_calls:
            return False
        self._call_timestamps.append(now)
        return True

    def remaining(self) -> int:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        self._evict_expired(cutoff)
        return max(0, self.max_calls - len(self._call_timestamps))


_rate_limiters: Dict[str, RateLimiter] = {}
_rate_limiters_last_seen: Dict[str, float] = {}
_RATE_LIMITER_IDLE_EVICT_SECONDS = 5 * 60
_RATE_LIMITER_MAX_KEYS = 50000
_redis_rate_client = None
_redis_rate_url: Optional[str] = None


def get_rate_limiter(
    name: str,
    max_calls: int = 60,
    window_seconds: float = 60.0,
) -> RateLimiter:
    now = time.monotonic()
    # Bound memory growth when many unique limiter keys are seen (e.g. many unique IPs).
    if len(_rate_limiters) > _RATE_LIMITER_MAX_KEYS:
        stale_cutoff = now - _RATE_LIMITER_IDLE_EVICT_SECONDS
        stale_keys = [k for k, ts in _rate_limiters_last_seen.items() if ts < stale_cutoff]
        for k in stale_keys:
            _rate_limiters.pop(k, None)
            _rate_limiters_last_seen.pop(k, None)
    if name not in _rate_limiters:
        _rate_limiters[name] = RateLimiter(
            name=name, max_calls=max_calls, window_seconds=window_seconds
        )
    _rate_limiters_last_seen[name] = now
    return _rate_limiters[name]


async def _get_redis_rate_client(redis_url: str):
    global _redis_rate_client, _redis_rate_url
    if not redis_url or redis_async is None:
        return None
    if _redis_rate_client is not None and _redis_rate_url == redis_url:
        return _redis_rate_client
    try:
        client = redis_async.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        await client.ping()
        _redis_rate_client = client
        _redis_rate_url = redis_url
        return _redis_rate_client
    except Exception:
        logger.warning("Redis rate limiter unavailable; falling back to in-memory limiter.")
        _redis_rate_client = None
        _redis_rate_url = redis_url
        return None


async def allow_rate_limit(
    name: str,
    max_calls: int,
    window_seconds: float,
    backend: str = "auto",
    redis_url: str = "",
) -> bool:
    """
    Check rate-limit allowance using configured backend.
    - redis: distributed fixed-window counter in Redis
    - memory: per-process in-memory limiter
    - auto: try redis, fallback to memory
    """
    backend_mode = (backend or "auto").strip().lower()
    use_redis = backend_mode in ("redis", "auto")

    if use_redis:
        client = await _get_redis_rate_client(redis_url)
        if client is not None:
            try:
                # Fixed-window bucket for stable distributed throttling.
                window = max(1, int(window_seconds))
                bucket = int(time.time() // window)
                key = f"rl:{name}:{bucket}"
                current = await client.incr(key)
                if current == 1:
                    await client.expire(key, window + 2)
                return int(current) <= int(max_calls)
            except Exception:
                if backend_mode == "redis":
                    return True  # fail-open for availability

    # Memory backend (or fallback from auto/redis)
    limiter = get_rate_limiter(name, max_calls=max_calls, window_seconds=window_seconds)
    return limiter.allow()


# ═══════════════════════════════════════════════════════════════
# SYSTEM HEALTH METRICS
# ═══════════════════════════════════════════════════════════════

class HealthMetrics:
    """
    Tracks system-wide health metrics for monitoring.
    Thread-safe via simple timestamp-based tracking.
    """

    def __init__(self):
        self._request_count = 0
        self._error_count = 0
        self._response_times: List[float] = []
        self._module_errors: Dict[str, int] = defaultdict(int)
        self._module_successes: Dict[str, int] = defaultdict(int)
        self._start_time = time.monotonic()
        self._max_response_times = 1000  # Keep last N for memory safety

    def record_request(self, module: str, duration_ms: float, success: bool) -> None:
        self._request_count += 1
        self._response_times.append(duration_ms)
        if len(self._response_times) > self._max_response_times:
            self._response_times = self._response_times[-self._max_response_times:]

        if success:
            self._module_successes[module] += 1
        else:
            self._error_count += 1
            self._module_errors[module] += 1

    def get_summary(self) -> dict:
        uptime = time.monotonic() - self._start_time
        avg_response = (
            sum(self._response_times) / len(self._response_times)
            if self._response_times
            else 0
        )
        p95_response = (
            sorted(self._response_times)[int(len(self._response_times) * 0.95)]
            if len(self._response_times) >= 20
            else avg_response
        )
        error_rate = (
            (self._error_count / self._request_count * 100)
            if self._request_count > 0
            else 0
        )

        module_health = {}
        all_modules = set(self._module_successes.keys()) | set(self._module_errors.keys())
        for mod in all_modules:
            total = self._module_successes.get(mod, 0) + self._module_errors.get(mod, 0)
            success_rate = (
                self._module_successes.get(mod, 0) / total * 100 if total > 0 else 100
            )
            module_health[mod] = {
                "total_requests": total,
                "successes": self._module_successes.get(mod, 0),
                "errors": self._module_errors.get(mod, 0),
                "success_rate_pct": round(success_rate, 1),
                "status": "healthy" if success_rate >= 90 else "degraded" if success_rate >= 50 else "critical",
            }

        return {
            "uptime_seconds": round(uptime, 1),
            "total_requests": self._request_count,
            "total_errors": self._error_count,
            "error_rate_pct": round(error_rate, 2),
            "avg_response_ms": round(avg_response, 1),
            "p95_response_ms": round(p95_response, 1),
            "module_health": module_health,
            "circuit_breakers": get_all_circuit_breakers(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Singleton health metrics instance
health_metrics = HealthMetrics()


# ═══════════════════════════════════════════════════════════════
# SAFE EXECUTION HELPERS
# ═══════════════════════════════════════════════════════════════

async def safe_execute(
    func: Callable,
    *args,
    fallback: Any = None,
    module: str = "unknown",
    timeout: float = 30.0,
    **kwargs,
) -> Any:
    """
    Execute a function with full protection:
    - Timeout
    - Error catching
    - Health metrics recording
    - Fallback return on failure

    Use this to wrap any operation that should never crash the system.
    """
    start = time.monotonic()
    try:
        if asyncio.iscoroutinefunction(func):
            result = await asyncio.wait_for(
                func(*args, **kwargs), timeout=timeout
            )
        else:
            result = await asyncio.wait_for(
                asyncio.to_thread(func, *args, **kwargs), timeout=timeout
            )
        duration = (time.monotonic() - start) * 1000
        health_metrics.record_request(module, duration, success=True)
        return result
    except asyncio.TimeoutError:
        duration = (time.monotonic() - start) * 1000
        health_metrics.record_request(module, duration, success=False)
        logger.error("TIMEOUT in module '%s' after %.1fs", module, timeout)
        return fallback
    except Exception as e:
        duration = (time.monotonic() - start) * 1000
        health_metrics.record_request(module, duration, success=False)
        logger.error("ERROR in module '%s': %s: %s", module, type(e).__name__, str(e))
        return fallback


def safe_get(data: Any, *keys, default: Any = None) -> Any:
    """
    Safely navigate nested dicts/lists without raising exceptions.
    Example: safe_get(data, "user", "profile", "name", default="Unknown")
    """
    current = data
    for key in keys:
        try:
            if isinstance(current, dict):
                current = current.get(key, default)
            elif isinstance(current, (list, tuple)) and isinstance(key, int):
                current = current[key] if 0 <= key < len(current) else default
            else:
                return default
        except (KeyError, IndexError, TypeError, AttributeError):
            return default
        if current is None:
            return default
    return current


def safe_json_parse(text: str, fallback: Any = None) -> Any:
    """Parse JSON safely, returning fallback on any error."""
    import json
    import re

    if not text or not isinstance(text, str):
        return fallback

    # Try direct parse first
    clean = text.strip()
    try:
        return json.loads(clean)
    except (json.JSONDecodeError, ValueError):
        pass

    # Try extracting from markdown code blocks
    if "```json" in clean:
        try:
            clean = clean.split("```json")[1].split("```")[0].strip()
            return json.loads(clean)
        except (json.JSONDecodeError, ValueError, IndexError):
            pass
    elif "```" in clean:
        try:
            clean = clean.split("```")[1].split("```")[0].strip()
            return json.loads(clean)
        except (json.JSONDecodeError, ValueError, IndexError):
            pass

    # Try regex extraction for JSON objects/arrays
    try:
        json_match = re.search(r'(\{.*\}|\[.*\])', clean, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
    except (json.JSONDecodeError, ValueError):
        pass

    return fallback


# ═══════════════════════════════════════════════════════════════
# INPUT VALIDATION HELPERS
# ═══════════════════════════════════════════════════════════════

def validate_string(
    value: Any,
    field_name: str = "field",
    min_length: int = 0,
    max_length: int = 10000,
    allow_empty: bool = False,
) -> str:
    """Validate and sanitize a string input."""
    if value is None:
        if allow_empty:
            return ""
        raise ValueError(f"{field_name} is required")

    if not isinstance(value, str):
        value = str(value)

    value = value.strip()

    if not allow_empty and len(value) < max(min_length, 1):
        raise ValueError(f"{field_name} must be at least {max(min_length, 1)} characters")

    if len(value) > max_length:
        value = value[:max_length]

    return value


def validate_email(email: str) -> str:
    """Basic email validation."""
    import re
    email = validate_string(email, "email", min_length=5, max_length=254)
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValueError("Invalid email format")
    return email.lower()


def validate_int(
    value: Any,
    field_name: str = "field",
    min_val: int = 0,
    max_val: int = 1000000,
    default: Optional[int] = None,
) -> int:
    """Validate an integer input."""
    if value is None:
        if default is not None:
            return default
        raise ValueError(f"{field_name} is required")
    try:
        result = int(value)
    except (ValueError, TypeError):
        if default is not None:
            return default
        raise ValueError(f"{field_name} must be a valid integer")

    return max(min_val, min(result, max_val))


def sanitize_for_logging(text: str, max_length: int = 500) -> str:
    """Truncate and sanitize text for safe logging."""
    if not text:
        return ""
    clean = text.replace("\n", " ").replace("\r", "")
    return clean[:max_length] + ("..." if len(clean) > max_length else "")
