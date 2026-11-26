// Generates ADMIN_CODE_HASH for .env.local without ever writing the plain code to disk.
// Usage:  npm run admin:hash -- "your-secret-code"
import { scryptSync, randomBytes } from "node:crypto";

const code = process.argv[2];
if (!code) {
  console.error('Usage: npm run admin:hash -- "your-secret-code"');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(code.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`ADMIN_CODE_HASH=scrypt:${salt.toString("hex")}:${hash.toString("hex")}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
