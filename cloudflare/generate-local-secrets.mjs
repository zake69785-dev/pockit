import { webcrypto } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const file = join(dirname(fileURLToPath(import.meta.url)), ".dev.vars");
if (existsSync(file))
  throw new Error("Local secrets already exist; refusing to overwrite them.");
const key = await webcrypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const raw = Buffer.from(await webcrypto.subtle.exportKey("raw", key.publicKey));
const jwk = await webcrypto.subtle.exportKey("jwk", key.privateKey);
const publicKey = raw.toString("base64url");
const vars = {
  ADMIN_TOKEN: webcrypto.getRandomValues(new Uint8Array(32)),
  DATA_KEY: webcrypto.getRandomValues(new Uint8Array(32)),
};
writeFileSync(
  file,
  [
    `ADMIN_TOKEN=${Buffer.from(vars.ADMIN_TOKEN).toString("base64url")}`,
    `DATA_KEY=${Buffer.from(vars.DATA_KEY).toString("base64url")}`,
    `VAPID_SUBJECT=mailto:pockit-push@example.invalid`,
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${jwk.d}`,
  ].join("\n") + "\n",
  { flag: "wx" },
);
console.log(
  `Local secrets created in ignored file cloudflare/.dev.vars. Public VAPID key: ${publicKey}`,
);
