import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const integrationDir = "lib/integrations";
const adapter = readFileSync(`${integrationDir}/adapter.ts`, "utf8");
const googleClassroom = readFileSync(`${integrationDir}/google-classroom.ts`, "utf8");
const lti = readFileSync(`${integrationDir}/lti.ts`, "utf8");

describe("Integration adapter layer", () => {
  it("defines IntegrationAdapter interface", () => {
    expect(adapter).toMatch(/export interface IntegrationAdapter/);
    expect(adapter).toMatch(/verify\(\)/);
    expect(adapter).toMatch(/listCourses\(\)/);
    expect(adapter).toMatch(/syncRoster/);
    expect(adapter).toMatch(/syncGrades/);
    expect(adapter).toMatch(/getConfigFields/);
  });

  it("defines LmsUser, LmsCourse, LmsGrade types", () => {
    expect(adapter).toMatch(/export interface LmsUser/);
    expect(adapter).toMatch(/export interface LmsCourse/);
    expect(adapter).toMatch(/export interface LmsGrade/);
  });

  it("has adapter registry (registerAdapter, getAdapter, listAdapters)", () => {
    expect(adapter).toMatch(/registerAdapter/);
    expect(adapter).toMatch(/getAdapter/);
    expect(adapter).toMatch(/listAdapters/);
  });

  it("Google Classroom adapter implements IntegrationAdapter", () => {
    expect(googleClassroom).toMatch(/implements IntegrationAdapter/);
    expect(googleClassroom).toMatch(/readonly provider = "google_classroom"/);
    expect(googleClassroom).toMatch(/classroom\.googleapis\.com/);
  });

  it("Google Classroom has OAuth2 token refresh", () => {
    expect(googleClassroom).toMatch(/refreshAccessToken/);
    expect(googleClassroom).toMatch(/oauth2\.googleapis\.com\/token/);
  });

  it("Google Classroom roster sync fetches students + teachers", () => {
    expect(googleClassroom).toMatch(/\/students\?pageSize/);
    expect(googleClassroom).toMatch(/\/teachers\?pageSize/);
  });

  it("LTI adapter implements IntegrationAdapter", () => {
    expect(lti).toMatch(/implements IntegrationAdapter/);
    expect(lti).toMatch(/readonly provider = "lti"/);
  });

  it("LTI has JWKS verification", () => {
    expect(lti).toMatch(/jwksUri/);
    expect(lti).toMatch(/JWKS endpoint unreachable/);
  });

  it("LTI defines OIDC config fields", () => {
    expect(lti).toMatch(/Issuer URL/);
    expect(lti).toMatch(/Authorization Endpoint/);
    expect(lti).toMatch(/Token Endpoint/);
    expect(lti).toMatch(/JWKS URI/);
  });
});
