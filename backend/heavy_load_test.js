import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },  // Ramp to 500
    { duration: '30s', target: 1000 }, // Ramp to 1000
    { duration: '30s', target: 2000 }, // Stress test at 2000
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'], // Allow some rate limiting but not core failures
  },
};

export default function () {
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  // Test root and health endpoints
  const responses = http.batch([
    ['GET', 'http://127.0.0.1:8000/', null, params],
    ['GET', 'http://127.0.0.1:8000/health', null, params],
  ]);

  check(responses[0], {
    'root status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  check(responses[1], {
    'health status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  sleep(1);
}
