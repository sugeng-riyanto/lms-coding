"use client";

import { useState } from "react";
import { MessageBell } from "./message-bell";
import { MessagingPanel } from "./messaging-panel";
import type { Lang } from "@/lib/i18n";

interface MessagingProps {
  lang?: Lang;
  userId: string;
  role: "teacher" | "student";
}

export function Messaging({ lang = "en", userId, role }: MessagingProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <MessageBell lang={lang} userId={userId} onOpen={() => setOpen(true)} />
      {open && (
        <MessagingPanel lang={lang} userId={userId} role={role} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
