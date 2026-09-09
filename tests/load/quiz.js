// k6 Load Test: Authenticated quiz flow
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, THRESHOLDS } from "./config.js";

export const options = {
  scenarios: {
    quiz_flow: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
    },
  },
  thresholds: THRESHOLDS,
};

function login(email, password) {
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
    },
  );
  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return body.access_token;
  }
  return null;
}

export default function () {
  // Use test student credentials from env
  const email = __ENV.TEST_STUDENT_EMAIL || "student@test.com";
  const password = __ENV.TEST_STUDENT_PASSWORD || "testpassword123";

  const token = login(email, password);
  if (!token) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. Fetch enrollments/dashboard
  const dashRes = http.get(`${BASE_URL}/learn`, { headers });
  check(dashRes, {
    "dashboard status 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 3 + 1);

  // 2. Fetch quizzes/assessments
  const quizRes = http.get(`${BASE_URL}/catalog`, { headers });
  check(quizRes, {
    "catalog status 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);

  // 3. Certificate page
  const certRes = http.get(`${BASE_URL}/certificates`, { headers });
  check(certRes, {
    "certificates accessible": (r) => r.status === 200 || r.status === 307,
  });
}
