"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save, LogOut } from "lucide-react";
import { changePassword, logout } from "@/app/actions/auth";

export default function SettingsPage() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <div className="p-4 space-y-6 pb-8">
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-bordeaux-gradient">Impostazioni</h1>
          <p className="text-muted-foreground text-sm">Gestisci il tuo account</p>
        </div>
      </header>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Settings className="mr-2" size={20} />
            Cambia Password
          </CardTitle>
          <CardDescription>
            Modifica la password per accedere all&apos;app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Password Attuale</label>
              <input
                type="password"
                name="currentPassword"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nuova Password</label>
              <input
                type="password"
                name="newPassword"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Ripeti Nuova Password</label>
              <input
                type="password"
                name="confirmPassword"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
            {state?.success && <p className="text-green-600 text-sm font-medium">Password aggiornata con successo!</p>}

            <Button type="submit" disabled={pending} className="w-full bg-bordeaux-gradient hover:opacity-90 border-0 text-white">
              <Save size={18} className="mr-2" />
              Salva Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <form action={logout}>
        <Button type="submit" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
          <LogOut size={18} className="mr-2" />
          Esci dall&apos;app (Logout)
        </Button>
      </form>
    </div>
  );
}
