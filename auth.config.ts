// CLI-only config: keep schema generation out of the Worker request lifecycle.
import { betterAuth } from "better-auth";
import { createAuthOptions } from "./src/lib/auth.ts";

export const auth = betterAuth(createAuthOptions());
