// k6 Load Testing Configuration
// Run: k6 run tests/load/config.js

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
export const SUPABASE_URL = __ENV.SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";

export const THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1000"],
  http_req_failed: ["rate<0.01"],
  http_reqs: ["rate>10"],
};

export const SCENARIOS = {
  // Constant load: 10 VUs for 30 seconds
  constant_load: {
    executor: "constant-vus",
    vus: 10,
    duration: "30s",
    tags: { scenario: "constant" },
  },
  // Ramp-up: 0→50 VUs over 60 seconds
  ramp_up: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "20s", target: 20 },
      { duration: "40s", target: 50 },
      { duration: "20s", target: 0 },
    ],
    tags: { scenario: "ramp" },
  },
};
