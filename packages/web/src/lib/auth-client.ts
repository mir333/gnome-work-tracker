import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL}/api/auth`,
  plugins: [usernameClient(), passkeyClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
