"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { NotificationEvent } from "@/types/notifications";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export type NotificationFilter = "all" | "invoice" | "funding" | "delivery";

function matchesActivityFilter(
  notif: NotificationEvent,
  filter: NotificationFilter,
): boolean {
  if (filter === "all") return true;
  const kind = notif.type.toLowerCase();
  if (filter === "funding") {
    return (
      kind.includes("funded") ||
      kind.includes("listed") ||
      kind.includes("repaid") ||
      kind.includes("defaulted") ||
      kind.includes("pool")
    );
  }
  if (filter === "delivery") {
    return kind.includes("shipped") || kind.includes("delivery");
  }
  return kind.includes("invoice") || kind.includes("created");
}

export function NotificationBell({
  notifications = [],
  onOpen,
}: {
  notifications?: NotificationEvent[];
  onOpen?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = notifications.filter((n) =>
    matchesActivityFilter(n, filter),
  );

  const handleClose = () => setIsOpen(false);

  // Focus trap hook
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, handleClose);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    if (!isOpen && onOpen) {
      onOpen();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="relative p-2 rounded-lg border border-border bg-background-secondary text-muted-foreground hover:text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
        onClick={toggleOpen}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(0,212,170,0.8)]" />
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 md:right-auto md:left-auto mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-lg shadow-2xl z-50 p-2 flex flex-col gap-2 origin-top-right md:origin-top"
        >
          <div ref={trapRef} tabIndex={-1} className="outline-none">
            <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-border/40 pb-2">
              <span className="text-xs font-bold font-mono text-foreground uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {unreadCount} new
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <div
                className="flex items-center gap-1 px-1 pb-2 mb-1 border-b border-border/30"
                role="tablist"
                aria-label="Filter notifications by activity"
              >
                {(
                  [
                    ["all", "All"],
                    ["invoice", "Invoices"],
                    ["funding", "Funding"],
                    ["delivery", "Delivery"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    onClick={() => setFilter(key)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      filter === key
                        ? "bg-primary/15 text-primary font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-foreground/70 text-xs font-mono">
                No notifications yet
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-foreground/70 text-xs font-mono">
                No matching activity
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      notif.read
                        ? "bg-transparent border-transparent"
                        : "bg-primary/5 border-primary/20"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`text-xs font-bold font-mono ${
                          notif.read ? "text-foreground/70" : "text-primary"
                        }`}
                      >
                        {notif.type}
                      </span>
                      <span className="text-[10px] text-foreground/70 whitespace-nowrap ml-2">
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(timestamp: number) {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
