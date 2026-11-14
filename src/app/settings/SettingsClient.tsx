"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save, LogOut, ShieldOff } from "lucide-react";
import { changePassword, logout, logoutEverywhere } from "@/app/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

export function SettingsClient() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);

  return (
    <div className="p-4 space-y-6 pb-8">
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-bordeaux-gradient">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account</p>
        </div>
      </header>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Settings className="mr-2" size={20} />
            Change password
          </CardTitle>
          <CardDescription>
            Update the password used to sign in. Other devices are signed out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Current password</label>
              <input
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">New password</label>
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Confirm new password</label>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
            {state?.success && <p className="text-green-600 dark:text-green-400 text-sm font-medium">Password updated successfully!</p>}

            <Button type="submit" disabled={pending} className="w-full bg-bordeaux-gradient hover:opacity-90 border-0 text-white">
              <Save size={18} className="mr-2" />
              Save password
            </Button>
          </form>
        </CardContent>
      </Card>

      <form action={logout}>
        <Button type="submit" variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40">
          <LogOut size={18} className="mr-2" />
          Sign out
        </Button>
      </form>

      <form action={logoutEverywhere}>
        <Button type="submit" variant="ghost" className="w-full text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
          <ShieldOff size={18} className="mr-2" />
          Sign out of all devices
        </Button>
      </form>
    </div>
  );
}
