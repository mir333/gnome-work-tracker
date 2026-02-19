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
  trustedOrigins: ["http://localhost:5173"],
  secret: process.env.BETTER_AUTH_SECRET!,
  hooks: {
    after: [
      {
        matcher: (context) => context.path === "/sign-up/email",
        handler: async (ctx) => {
          const body = ctx.context.body as { user?: { id?: string } } | undefined;
          if (body?.user?.id) {
            await prisma.userProfile.create({
              data: { userId: body.user.id },
            });
          }
        },
      },
    ],
  },
});

export type Auth = typeof auth;
