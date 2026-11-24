"use client";

import React, { useState } from "react";
import { Bell, CheckCheck, FileText, Landmark, User, Inbox } from "lucide-react";
import { useNotifications, NotificationCategory } from "../../hooks/useNotifications";


function formatTime(timestamp: number) {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
    }
/**
 * NotificationBell component displays unread notification badges and a dropdown
 * allowing users to view recent events, mark individual or all items as read,
 * and filter notifications by category (All, Invoices, Pools, Account) without
 * altering read statuses.
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    allNotifications,
    isLoading,
    category,
    setCategory,
    counts,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const unreadCount = counts.unread;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        aria-label="Open notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-card border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100">Notifications</h3>
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400 font-mono">
                {counts.filtered}
                </span>
            </div>
            <button
              onClick={() => markAllAsRead()}
              className="text-xs text-teal-400 hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          </div>

          {/* Category filter tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/50 px-2 py-1.5 gap-1 text-xs">
            <button
              onClick={() => setCategory("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${category === "all" ? "bg-teal-500/20 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setCategory("invoice")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${category === "invoice" ? "bg-teal-500/20 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              <FileText className="w-3 h-3" />
              Invoices ({counts.invoice})
            </button>
            <button
              onClick={() => setCategory("pool")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${category === "pool" ? "bg-teal-500/20 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              <Landmark className="w-3 h-3" />
              Pools ({counts.pool})
            </button>
            <button
              onClick={() => setCategory("account")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${category === "account" ? "bg-teal-500/20 text-teal-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              <User className="w-3 h-3" />
              Account ({counts.account})
            </button>
              </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-300 text-sm font-medium">
                  No {category === "all" ? "" : category} notifications
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  You have no recent events matching this category.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                  <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-3 transition-colors cursor-pointer hover:bg-slate-800/50 flex gap-3 items-start ${
                    n.read ? "opacity-60 bg-transparent" : "bg-slate-800/20"
                    }`}
                  >
                      <span
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      n.read ? "bg-transparent" : "bg-teal-400"
                        }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-slate-200 uppercase">
                        {n.event_type}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(n.occurred_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {JSON.stringify(n.data)}
                    </p>
                  </div>
              </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
