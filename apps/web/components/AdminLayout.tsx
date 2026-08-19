"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const menuItems = [
    {
      title: "Dashboard",
      icon: "📊",
      href: "/admin",
      description: "Overview & statistics",
    },
    {
      title: "Hero Settings",
      icon: "🎨",
      href: "/admin/hero-settings",
      description: "Customize hero section",
    },
    {
      title: "Community Links",
      icon: "🔗",
      href: "/admin/community-links",
      description: "Manage footer links",
    },
    {
      title: "Audit Logs",
      icon: "📋",
      href: "/admin/audit-logs",
      description: "View system logs",
    },
    {
      title: "Alpha Moderation",
      icon: "⚡",
      href: "/admin/alpha",
      description: "Review alpha submissions",
    },
    {
      title: "Chat Moderation",
      icon: "💬",
      href: "/admin/chat",
      description: "Moderate chat messages",
    },
    {
      title: "User Management",
      icon: "👥",
      href: "/admin/users",
      description: "Manage users & bans",
    },
    {
      title: "Raffle Management",
      icon: "🎟️",
      href: "/admin/raffles",
      description: "Cancel & review raffles",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] text-white">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-0.5 w-full bg-white transition-all ${sidebarOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 w-full bg-white transition-all ${sidebarOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-full bg-white transition-all ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>

            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-violet-500/50">
                R
              </div>
              <div>
                <div className="font-black text-sm tracking-[.2em]">RAVEN ORACLE</div>
                <div className="text-[8px] text-violet-300 tracking-[.15em]">ADMIN PANEL</div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 text-xs font-bold border border-white/10 rounded-lg hover:bg-white/5"
            >
              ← Back to Site
            </Link>
            <Link
              href="/account"
              className="px-4 py-2 text-xs font-black bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg shadow-lg shadow-violet-500/30"
            >
              Account
            </Link>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-[73px] left-0 bottom-0 z-40 border-r border-white/10 bg-black/40 backdrop-blur-xl transition-all duration-300 overflow-y-auto ${
          sidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <nav className="p-6 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg p-4 transition-all ${
                isActive(item.href)
                  ? "bg-violet-500/20 border border-violet-500/50 shadow-lg shadow-violet-500/20"
                  : "border border-white/10 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">{item.icon}</span>
                <span className="font-bold text-sm">{item.title}</span>
              </div>
              <p className="text-xs text-zinc-500 ml-10">{item.description}</p>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={`pt-[73px] transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        <div className="p-6">{children}</div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
