// k6 Load Test: Certificate verification (public, high-concurrency)
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, THRESHOLDS } from "./config.js";

export const options = {
  scenarios: {
    cert_verify: {
      executor: "constant-vus",
      vus: 50,
      duration: "30s",
    },
  },
  thresholds: {
    ...THRESHOLDS,
    http_req_duration: ["p(95)<300", "p(99)<600"],
  },
};

export default function () {
  // Public certificate verification endpoint
  const res = http.get(`${BASE_URL}/verify`);
  check(res, {
    "verify page status 200": (r) => r.status === 200,
    "verify responds fast": (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 1 + 0.5);

  // Landing page (CDN-cached)
  const landing = http.get(`${BASE_URL}/`);
  check(landing, {
    "landing status 200": (r) => r.status === 200,
  });
}
