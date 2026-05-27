import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { Auth } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { auth } from "./auth";

export const serverClient = createAuthClient({
	plugins: [oauthProviderResourceClient(auth as unknown as Auth)],
});
