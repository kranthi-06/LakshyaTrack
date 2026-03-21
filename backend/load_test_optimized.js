import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for detailed analysis
const healthSuccess = new Rate('health_success');
const rootSuccess = new Rate('root_success');
const reqDuration = new Trend('custom_duration');

export const options = {
  stages: [
    // Phase 1: Warm-up
    { duration: '10s', target: 100 },
    { duration: '20s', target: 100 },

    // Phase 2: Medium load
    { duration: '10s', target: 500 },
    { duration: '20s', target: 500 },

    // Phase 3: Heavy load
    { duration: '10s', target: 1000 },
    { duration: '20s', target: 1000 },

    // Phase 4: Stress test
    { duration: '10s', target: 2000 },
    { duration: '20s', target: 2000 },

    // Phase 5: Peak stress
    { duration: '10s', target: 3000 },
    { duration: '20s', target: 3000 },

    // Ramp down
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% under 2s
    http_req_failed: ['rate<0.05'],       // Less than 5% failures
  },
};

export default function () {
  // Test health endpoint (lightweight cached response)
  const healthRes = http.get('http://127.0.0.1:8000/health');
  const hOk = healthRes.status === 200 || healthRes.status === 429;
  check(healthRes, { 'health OK': () => hOk });
  healthSuccess.add(hOk);
  reqDuration.add(healthRes.timings.duration);

  // Test root endpoint (ultra-lightweight)
  const rootRes = http.get('http://127.0.0.1:8000/');
  const rOk = rootRes.status === 200 || rootRes.status === 429;
  check(rootRes, { 'root OK': () => rOk });
  rootSuccess.add(rOk);
  reqDuration.add(rootRes.timings.duration);

  // Simulate realistic user think time
  sleep(Math.random() * 2 + 1);
}
