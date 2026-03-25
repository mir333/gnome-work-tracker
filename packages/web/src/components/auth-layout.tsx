import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo className="h-10 w-auto mb-3" />
          <h1 className="text-2xl font-bold tracking-tight">Work Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your work, stay focused
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
