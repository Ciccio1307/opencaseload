"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { login } from "@/app/actions/auth";
import { THERAPIST_NAME } from "@/lib/branding";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/60 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-bordeaux-gradient w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-md">
            <Lock className="text-white" size={24} />
          </div>
          <CardTitle className="text-2xl font-bold text-bordeaux-gradient">
            Ciao{THERAPIST_NAME ? `, ${THERAPIST_NAME}` : ""}
          </CardTitle>
          <CardDescription>Inserisci la password per accedere alla tua agenda</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4 pt-4">
            <div>
              <input
                type="password"
                name="password"
                className={`w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                  state?.error ? "border-red-500" : "border-border"
                }`}
                placeholder="Password"
              />
              {state?.error && <p className="text-red-500 text-sm mt-2 text-center">{state.error}</p>}
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="w-full h-12 text-lg rounded-xl bg-bordeaux-gradient hover:opacity-90 border-0 text-white shadow-md"
            >
              {pending ? "Accesso..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
