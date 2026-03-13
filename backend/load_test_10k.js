import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 2000 },   // Ramp up to 2000 users in 1 min
    { duration: '2m', target: 5000 },   // Ramp up to 5000 users in 2 min
    { duration: '2m', target: 10000 },  // Ramp up to 10000 users in 2 min
    { duration: '2m', target: 10000 },  // Stay at 10000 users
    { duration: '1m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s under heavy load
    http_req_failed: ['rate<0.05'],    // Allow up to 5% failure rate at 10k users
  },
};

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // 1. Health check
  const healthRes = http.get('http://127.0.0.1:8000/health', params);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Root check
  const rootRes = http.get('http://127.0.0.1:8000/', params);
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
  });

  // Simulate realistic user thinking time
  sleep(Math.random() * 3 + 2); 
}
