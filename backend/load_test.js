import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 }, // Ramp up to 50 users
    { duration: '30s', target: 50 }, // Stay at 50 for 30 seconds
    { duration: '10s', target: 100 }, // Ramp up to 100 users
    { duration: '30s', target: 100 }, // Stay at 100 for 30 seconds
    { duration: '10s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be < 1%
  },
};

export default function () {
  // Test health endpoint
  const healthRes = http.get('http://127.0.0.1:8000/api/v1/health');
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // Test root endpoint
  const rootRes = http.get('http://127.0.0.1:8000/');
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
