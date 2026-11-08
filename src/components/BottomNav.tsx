"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, RotateCcw } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  
  const navItems = [
    { label: "Dashboard", href: "/", icon: Home },
    { label: "Patients", href: "/patients", icon: Users },
    { label: "Recoveries", href: "/recoveries", icon: RotateCcw },
  ];

  if (pathname === '/login') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t pb-safe shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)]">
      <div className="flex justify-around items-center h-16 mx-auto max-w-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary/70"
              }`}
            >
              <div className={`p-1 rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-primary' : ''} />
              </div>
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
