import { execSync } from "node:child_process";

/** Every run starts from the same seeded data. Set E2E_RESEED=0 to skip (faster local re-runs). */
export default function globalSetup() {
  if (process.env.E2E_RESEED === "0") return;
  execSync("npm run db:seed -- --reset", { stdio: "inherit" });
}
