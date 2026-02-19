import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "/api/auth",
  plugins: [usernameClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
