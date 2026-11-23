"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { NotificationEvent } from "@/types/notifications";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export function NotificationBell({
  notifications = [],
  onOpen,
}: {
  notifications?: NotificationEvent[];
  onOpen?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const t = useTranslations("NotificationBell");

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        aria-label={t("label", { count: unreadCount })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(0,212,170,0.8)]"
          />
        )}
      </button>

      {isOpen && (
        <div
          id={panelId}
          ref={dropdownRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("panelLabel")}
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

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-foreground/70 text-xs font-mono">
                No notifications yet
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      notif.read
                        ? "bg-transparent border-transparent"
                        : "bg-primary/5 border-primary/20"
                    }`}
                  >
                    {!notif.read && (
                      <span className="sr-only">{t("unreadBadge")}</span>
                    )}
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
                  </li>
                ))}
              </ul>
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
