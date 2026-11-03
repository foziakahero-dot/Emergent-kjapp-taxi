#!/usr/bin/env node
/**
 * SNAR QA waitlist synthetic smoke test.
 * NEVER invoked automatically by builds or deployments.
 * Explicit SNAR_QA_SMOKE_CONFIRM=YES required; endpoint is fixed to api-qa.
 * Creates exactly one synthetic QA record; cleanup is a separate explicit step.
 */
import { createHash } from "node:crypto";

const confirm = process.env.SNAR_QA_SMOKE_CONFIRM;
if (confirm !== "YES") {
  console.error("Blocked. To run a single synthetic QA registration, set SNAR_QA_SMOKE_CONFIRM=YES.");
  process.exit(2);
}

const qa = "https://api-qa.snarapp.no/api";
const readyResponse = await fetch(qa + "/ready", { headers: { "Cache-Control": "no-cache" } });
const ready = await readyResponse.json();
if (!readyResponse.ok || !ready.ready || ready.release?.environment !== "qa" ||
    ready.checks?.qa_mode !== true || ready.checks?.qa_database_isolated !== true ||
    ready.checks?.production_mode !== false) {
  throw new Error("QA isolation guard failed — no registration sent.");
}

const identity = {
  name: "SNAR QA SYNTHETIC 20261103",
  phone: "+4799999901",
  email: "snar-qa-20261103@example.invalid",
  city: "Oslo",
  role: "passenger",
  website: "",
};
const normalized = [identity.role, identity.phone, identity.email, identity.city.toLocaleLowerCase()].join("|");
const identityKey = createHash("sha256").update(normalized).digest("hex");

console.log("QA environment:", ready.release.environment, "commit:", ready.release.commit);
console.log("QA isolation:", ready.checks.qa_database_isolated);
console.log("Synthetic identity_key for QA cleanup:", identityKey);
console.log("Submitting one synthetic registration only to:", qa + "/marketing/waitlist");
const response = await fetch(qa + "/marketing/waitlist", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-SNAR-Test": "synthetic" },
  body: JSON.stringify(identity),
});
const result = await response.json().catch(() => ({}));
console.log("HTTP:", response.status, "body:", JSON.stringify(result));
if (response.status !== 201 || result.ok !== true || result.status !== "registered") {
  throw new Error("Synthetic QA registration did not pass. Inspect QA backend and stop.");
}
console.log("PASS. Verify identity_key appears in Atlas snar_qa.beta_waitlist and SNAR QA Admin.");
console.log("Then delete only the exact synthetic identity_key from QA, including its related test email-outbox record.");
