import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Send, X, LifeBuoy, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { from: "bot" | "user"; text: string; canEscalate?: boolean };

const BOT_NAME = "Cheddar4u Support";

const GREETING: Msg = {
  from: "bot",
  text:
    "Hi 👋 I'm the Cheddar4u Support assistant. Ask me about withdrawals, " +
    "upgrades, referrals, daily check-in, unlocks, account access, payments, " +
    "or anything else about the platform.",
};

const SUGGESTIONS = [
  "How do withdrawals work?",
  "How do I upgrade?",
  "How do referrals pay?",
  "How do I unlock locked tasks?",
  "I forgot my password",
  "My payment isn't approved",
];

// Render simple **bold** segments without showing the asterisks.
function renderText(text: string) {
  // Strip standalone asterisks while turning **xxx** into <strong>.
  const parts: Array<{ b: boolean; t: string }> = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ b: false, t: text.slice(last, m.index) });
    parts.push({ b: true, t: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ b: false, t: text.slice(last) });
  // Drop any stray single asterisks that aren't part of a bold pair.
  return parts.map((p, i) =>
    p.b ? (
      <strong key={i} className="font-semibold">{p.t}</strong>
    ) : (
      <span key={i}>{p.t.replace(/\*/g, "")}</span>
    ),
  );
}

export const SupportBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Escalation form state
  const [escalating, setEscalating] = useState(false);
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, escalating]);

  // Pre-fill email from current session
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setTicketEmail(data.user.email);
    });
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages((m) => [...m, { from: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("support-bot", { body: { message: trimmed } });
      const reply = data?.reply ?? "I couldn't reach the support service. Try again.";
      setMessages((m) => [
        ...m,
        { from: "bot", text: reply, canEscalate: true },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Sorry, something went wrong. Try again.", canEscalate: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const submitTicket = async () => {
    if (!ticketBody.trim()) {
      toast.error("Please describe your issue.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // Upload attachments to the private support-attachments bucket. We
      // store the storage paths on the ticket — the admin inbox creates
      // signed URLs on demand to preview them.
      const paths: string[] = [];
      for (const file of ticketFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 10MB and was skipped.`);
          continue;
        }
        const folder = userId ?? "anon";
        const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("support-attachments")
          .upload(path, file, { upsert: false });
        if (upErr) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        paths.push(path);
      }

      const { error } = await supabase.from("support_tickets").insert({
        user_id: userId,
        email: ticketEmail || null,
        subject: ticketSubject || null,
        message: ticketBody,
        attachments: urls,
      });
      if (error) throw error;

      toast.success("Ticket submitted — our support team will respond once available.");
      setMessages((m) => [
        ...m,
        {
          from: "bot",
          text:
            "Thanks — your ticket is now in our queue. Our support team will respond once available, usually within 24 hours. Keep an eye on your inbox.",
        },
      ]);
      setEscalating(false);
      setTicketSubject("");
      setTicketBody("");
      setTicketFiles([]);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open support chat"
        className="fixed bottom-24 right-5 sm:bottom-6 sm:right-6 z-40 h-14 w-14 rounded-full grid place-items-center shadow-xl bg-gradient-to-br from-primary to-accent text-primary-foreground hover:scale-105 transition-transform"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-44 right-5 sm:bottom-24 sm:right-6 z-40 w-[min(92vw,380px)] glass-card rounded-2xl border border-primary/30 overflow-hidden shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-background/20 grid place-items-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{BOT_NAME}</div>
              <div className="text-[11px] opacity-80">Auto-reply • usually instant</div>
            </div>
          </div>

          {!escalating ? (
            <>
              <div ref={scrollRef} className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2 bg-background/60">
                {messages.map((m, i) => (
                  <div key={i} className="space-y-1.5">
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.from === "bot"
                          ? "bg-secondary/70 text-foreground rounded-bl-sm"
                          : "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                      }`}
                    >
                      {renderText(m.text)}
                    </div>
                    {m.from === "bot" && m.canEscalate && (
                      <button
                        onClick={() => setEscalating(true)}
                        className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <LifeBuoy className="h-3 w-3" /> Not satisfied? Escalate to live support
                      </button>
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="bg-secondary/70 max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground italic">
                    typing…
                  </div>
                )}
              </div>

              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5 bg-background/60">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border hover:border-primary/50 hover:bg-primary/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="p-2 border-t border-border bg-background/80 flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a question…"
                  className="h-9"
                  disabled={busy}
                />
                <Button type="submit" size="sm" variant="hero" disabled={busy || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <div ref={scrollRef} className="flex-1 max-h-[420px] overflow-y-auto p-3 space-y-3 bg-background/60">
              <div className="text-sm">
                <div className="font-medium flex items-center gap-1.5">
                  <LifeBuoy className="h-4 w-4 text-primary" /> Escalate to live support
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Describe your issue. Our support team will respond once available — usually within 24 hours.
                </p>
              </div>

              <Input
                placeholder="Email (so we can reply)"
                type="email"
                value={ticketEmail}
                onChange={(e) => setTicketEmail(e.target.value)}
                className="h-9"
              />
              <Input
                placeholder="Subject (optional)"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="h-9"
              />
              <Textarea
                placeholder="Describe your complaint or issue in detail…"
                value={ticketBody}
                onChange={(e) => setTicketBody(e.target.value)}
                className="min-h-[110px] text-sm"
              />

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Attach screenshots or documents (optional)</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setTicketFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              {ticketFiles.length > 0 && (
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  {ticketFiles.map((f) => (
                    <div key={f.name} className="truncate">• {f.name}</div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setEscalating(false)}
                  disabled={submitting}
                >
                  Back to chat
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  size="sm"
                  className="flex-1"
                  onClick={submitTicket}
                  disabled={submitting || !ticketBody.trim()}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit ticket"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
