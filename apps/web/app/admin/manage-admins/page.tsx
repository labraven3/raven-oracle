"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type AdminUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "MODERATOR";
  isAdminApproved: boolean;
  adminApprovedAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  _count?: {
    raffleEntries: number;
    alphaSubmissions: number;
  };
};

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"approved" | "pending">("approved");

  useEffect(() => {
    loadAdmins();
  }, [activeTab]);

  async function loadAdmins() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("raven_token");
      const response = await fetch(
        `${API_BASE_URL}/admin/whitelist?filter=${activeTab}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to load admins");
      const data = await response.json();
      setAdmins(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  async function approveAdmin(userId: string) {
    try {
      const token = localStorage.getItem("raven_token");
      const response = await fetch(
        `${API_BASE_URL}/admin/whitelist/${userId}/approve`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to approve admin");
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    }
  }

  async function rejectAdmin(userId: string, reason?: string) {
    try {
      const token = localStorage.getItem("raven_token");
      const response = await fetch(
        `${API_BASE_URL}/admin/whitelist/${userId}/reject`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) throw new Error("Failed to reject admin");
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Manage Admins</h1>
        <p className="text-zinc-400">
          Approve or remove admin access for team members
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab("approved")}
          className={`px-4 py-3 font-bold text-sm transition-colors ${
            activeTab === "approved"
              ? "border-b-2 border-violet-500 text-violet-400"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          Approved Admins
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-3 font-bold text-sm transition-colors ${
            activeTab === "pending"
              ? "border-b-2 border-violet-500 text-violet-400"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          Pending Approval
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full"></div>
          </div>
          <p className="text-zinc-400 mt-4">Loading admins...</p>
        </div>
      )}

      {/* Admins Table */}
      {!loading && admins.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 font-bold text-sm text-zinc-400">
                  Email
                </th>
                <th className="text-left py-3 px-4 font-bold text-sm text-zinc-400">
                  Username
                </th>
                <th className="text-left py-3 px-4 font-bold text-sm text-zinc-400">
                  Role
                </th>
                <th className="text-left py-3 px-4 font-bold text-sm text-zinc-400">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-bold text-sm text-zinc-400">
                  {activeTab === "approved" ? "Approved" : "Created"}
                </th>
                <th className="text-right py-3 px-4 font-bold text-sm text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr
                  key={admin.id}
                  className="border-b border-white/10 hover:bg-white/5 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-white">{admin.email}</td>
                  <td className="py-3 px-4 text-sm text-zinc-400">
                    {admin.username || "-"}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        admin.role === "ADMIN"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-orange-500/20 text-orange-400"
                      }`}
                    >
                      {admin.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        admin.isAdminApproved
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {admin.isAdminApproved ? "Approved" : "Pending"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-zinc-500">
                    {admin.adminApprovedAt
                      ? new Date(admin.adminApprovedAt).toLocaleDateString()
                      : new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex gap-2 justify-end">
                      {activeTab === "pending" && (
                        <button
                          onClick={() => approveAdmin(admin.id)}
                          className="px-3 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      {activeTab === "pending" && (
                        <button
                          onClick={() => rejectAdmin(admin.id, "Rejected by admin")}
                          className="px-3 py-1 text-xs font-bold bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                        >
                          Reject
                        </button>
                      )}
                      {activeTab === "approved" && (
                        <button
                          onClick={() => rejectAdmin(admin.id, "Revoked by admin")}
                          className="px-3 py-1 text-xs font-bold bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && admins.length === 0 && (
        <div className="text-center py-12 border border-white/10 rounded-lg">
          <p className="text-zinc-500 mb-4">
            {activeTab === "approved" ? "No approved admins" : "No pending approvals"}
          </p>
          <Link
            href="/admin"
            className="text-violet-400 hover:text-violet-300 text-sm font-bold"
          >
            Back to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
