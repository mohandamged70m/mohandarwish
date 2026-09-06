// Generate a bcrypt hash for DASHBOARD_PASSWORD_HASH.
// Run WITHOUT committing the password anywhere:
//   $env:DASHBOARD_PASSWORD='your-secret-password'; node scripts/hash-password.mjs
// Paste the printed hash into .env.local and Vercel env vars as DASHBOARD_PASSWORD_HASH.
import bcrypt from "bcryptjs";

const pw = process.env.DASHBOARD_PASSWORD;
if (!pw) {
  console.error("Set DASHBOARD_PASSWORD first:\n  $env:DASHBOARD_PASSWORD='your-secret-password'; node scripts/hash-password.mjs");
  process.exit(1);
}
const hash = await bcrypt.hash(pw, 12);
console.log(hash);
