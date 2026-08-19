"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();

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

  // Verify admin access on mount
  useEffect(() => {
    const verifyAccess = async () => {
      const token = localStorage.getItem("raven_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api"}/admin/overview`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          setIsAuthorized(false);
          router.push("/admin/login");
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        setIsAuthorized(false);
        router.push("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] text-white">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-zinc-400 mt-4">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] text-white">
        <div className="text-center">
          <div className="text-red-400 text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-zinc-400 mb-6">You do not have admin access</p>
          <Link
            href="/admin/login"
            className="px-6 py-3 bg-violet-500 hover:bg-violet-600 rounded-lg font-bold transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("raven_token");
    document.cookie = "raven_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    router.push("/admin/login");
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      theme === "dark"
        ? "bg-gradient-to-br from-[#0a0a0f] via-[#0f0a1f] to-[#0a0a0f] text-white"
        : "bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900"
    }`}>
      {/* Top Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl transition-colors ${
        theme === "dark"
          ? "border-white/10 bg-black/40"
          : "border-gray-200 bg-white/40"
      }`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                theme === "dark"
                  ? "border border-white/10 hover:bg-white/5"
                  : "border border-gray-300 hover:bg-gray-100"
              }`}
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-0.5 transition-all ${
                  theme === "dark" ? "bg-white" : "bg-gray-900"
                } ${sidebarOpen ? 'rotate-45 translate-y-1.5 w-full' : 'w-full'}`} />
                <span className={`block h-0.5 transition-all ${
                  theme === "dark" ? "bg-white" : "bg-gray-900"
                } ${sidebarOpen ? 'opacity-0 w-full' : 'w-full'}`} />
                <span className={`block h-0.5 transition-all ${
                  theme === "dark" ? "bg-white" : "bg-gray-900"
                } ${sidebarOpen ? '-rotate-45 -translate-y-2 w-full' : 'w-full'}`} />
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
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                theme === "dark"
                  ? "border border-white/10 hover:bg-white/5"
                  : "border border-gray-300 hover:bg-gray-100"
              }`}
            >
              ← Back to Site
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-[73px] left-0 bottom-0 z-40 border-r backdrop-blur-xl transition-all duration-300 overflow-y-auto ${
          theme === "dark"
            ? "border-white/10 bg-black/40"
            : "border-gray-200 bg-white/40"
        } ${
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
                  : theme === "dark"
                  ? "border border-white/10 hover:border-white/20 hover:bg-white/5"
                  : "border border-gray-300 hover:border-gray-400 hover:bg-gray-100"
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
          className={`fixed inset-0 z-30 lg:hidden ${
            theme === "dark" ? "bg-black/50" : "bg-black/20"
          }`}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
