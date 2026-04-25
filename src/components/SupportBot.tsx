import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Msg = { from: "bot" | "user"; text: string };

const GREETING: Msg = {
  from: "bot",
  text:
    "Hi 👋 I'm Monetra's support bot. Ask me about withdrawals, upgrades, " +
    "referrals, daily check-in, or unlocking tasks.",
};

const SUGGESTIONS = [
  "How do withdrawals work?",
  "How do I upgrade?",
  "How do referrals pay?",
  "How do I unlock locked tasks?",
];

/**
 * Floating support chat. Uses the `support-bot` edge function (no key needed)
 * which auto-replies with FAQ-style answers based on keyword matching.
 */
export const SupportBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setMessages((m) => [...m, { from: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("support-bot", { body: { message: trimmed } });
      const reply = data?.reply ?? "I couldn't reach the support service. Try again.";
      setMessages((m) => [...m, { from: "bot", text: reply }]);
    } catch {
      setMessages((m) => [...m, { from: "bot", text: "Sorry, something went wrong. Try again." }]);
    } finally {
      setBusy(false);
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
        <div className="fixed bottom-44 right-5 sm:bottom-24 sm:right-6 z-40 w-[min(92vw,360px)] glass-card rounded-2xl border border-primary/30 overflow-hidden shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-background/20 grid place-items-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Monetra Support</div>
              <div className="text-[11px] opacity-80">Auto-reply • usually instant</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 max-h-80 overflow-y-auto p-3 space-y-2 bg-background/60">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.from === "bot"
                    ? "bg-secondary/70 text-foreground rounded-bl-sm"
                    : "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                }`}
              >
                {m.text}
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
        </div>
      )}
    </>
  );
};
