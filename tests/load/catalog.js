// k6 Load Test: Anonymous catalog browse
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, THRESHOLDS } from "./config.js";

export const options = {
  scenarios: {
    catalog_browse: {
      executor: "constant-vus",
      vus: 20,
      duration: "30s",
    },
  },
  thresholds: THRESHOLDS,
};

export default function catalogLoadTest() {
  // 1. Landing page
  const landingRes = http.get(`${BASE_URL}/`);
  check(landingRes, {
    "landing status 200": (r) => r.status === 200,
    "landing has content": (r) => r.body.includes("Coding School"),
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time

  // 2. Catalog page
  const catalogRes = http.get(`${BASE_URL}/catalog`);
  check(catalogRes, {
    "catalog status 200": (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1);

  // 3. Certificate verification page (public)
  const verifyRes = http.get(`${BASE_URL}/verify`);
  check(verifyRes, {
    "verify page accessible": (r) => r.status === 200 || r.status === 307,
  });
}
