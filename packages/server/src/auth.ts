import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  plugins: [username()],
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [(process.env.CORS_ORIGIN || "http://localhost:5173")],
  secret: process.env.BETTER_AUTH_SECRET!,
  hooks: {
    after: async (ctx: any) => {
      if (ctx.path === "/sign-up/email") {
        const body = ctx.context?.body as { user?: { id?: string } } | undefined;
        if (body?.user?.id) {
          await prisma.userProfile.create({
            data: { userId: body.user.id },
          });
        }
      }
      return ctx;
    },
  },
});

export type Auth = typeof auth;
