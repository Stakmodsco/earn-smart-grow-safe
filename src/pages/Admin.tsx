import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Eye, Flag, Inbox, Paperclip, RefreshCw, Search, X } from "lucide-react";
import { COUNTRIES } from "@/lib/paymentMethods";

const Admin = () => {
  const { user, loading } = useAuth();
  const { format } = useCurrency();
  const isAdmin = useIsAdmin(user?.id);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [upgrades, setUpgrades] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setAdminCheckDone(true), 500);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const loadAll = async () => {
    const [u, w, p, s] = await Promise.all([
      supabase.from("transactions").select("*, profiles!inner(email, full_name, level)").eq("type", "upgrade").order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals").select("*, profiles!inner(email, full_name, level)").order("requested_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("app_settings").select("*"),
    ]);
    setUpgrades(u.data ?? []);
    setWithdrawals(w.data ?? []);
    setUsers(p.data ?? []);
    const map: any = {}; s.data?.forEach((r: any) => (map[r.key] = r.value)); setSettings(map);
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && adminCheckDone) return <Navigate to="/dashboard" replace />;
  if (!isAdmin) return <div className="min-h-screen"><Navbar /><div className="container py-20 text-center">Checking access…</div></div>;

  const reviewUpgrade = async (id: string, action: "approve" | "reject") => {
    const { data, error } = await supabase.functions.invoke("admin-review-upgrade", { body: { transaction_id: id, action } });
    if (error || data?.error) return toast.error(error?.message ?? data.error);
    toast.success(`Upgrade ${action}d`);
    loadAll();
  };

  const reviewWithdrawal = async (id: string, action: "complete" | "reject") => {
    const { data, error } = await supabase.functions.invoke("admin-review-withdrawal", { body: { withdrawal_id: id, action } });
    if (error || data?.error) return toast.error(error?.message ?? data.error);
    toast.success(`Withdrawal ${action}d`);
    loadAll();
  };

  const toggleFlag = async (uid: string, flagged: boolean) => {
    const { error } = await supabase.from("profiles").update({ flagged: !flagged }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success(flagged ? "Unflagged" : "Flagged");
    loadAll();
  };

  const viewProof = async (path: string) => {
    const { data } = await supabase.storage.from("proofs").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const saveSetting = async (key: string, value: any) => {
    const { error } = await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) return toast.error(error.message);
    toast.success(`${key} saved`);
    loadAll();
  };

  const pendingUpgrades = upgrades.filter((u) => u.status === "pending");
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container py-10 max-w-7xl">
        <div className="text-xs uppercase tracking-widest text-primary mb-2">Admin</div>
        <h1 className="font-display text-4xl font-semibold mb-8">Operations console</h1>

        <Tabs defaultValue="upgrades">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="upgrades">Upgrades <Pill>{pendingUpgrades.length}</Pill></TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals <Pill>{pendingWithdrawals.length}</Pill></TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="tickets"><Inbox className="h-3.5 w-3.5 mr-1" /> Tickets</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="upgrades">
            <Card className="glass-card p-6 rounded-xl">
              {upgrades.length === 0 ? <Empty label="No upgrade requests yet" /> : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground"><tr><Th>User</Th><Th>To</Th><Th>Amount</Th><Th>Method / Details</Th><Th>Status</Th><Th>When</Th><Th /></tr></thead>
                  <tbody>{upgrades.map((u) => (
                    <tr key={u.id} className="border-t border-border align-top">
                      <Td><div>{u.profiles?.full_name || "—"}</div><div className="text-xs text-muted-foreground">{u.profiles?.email}</div></Td>
                      <Td>L{u.target_level}</Td>
                      <Td>{format(u.amount)}</Td>
                      <Td className="max-w-sm"><PaymentDetails method={u.payment_method} notes={u.notes} /></Td>
                      <Td><StatusBadge status={u.status} /></Td>
                      <Td className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</Td>
                      <Td>
                        <div className="flex gap-1 justify-end">
                          {u.proof_url && <Button size="sm" variant="ghost" onClick={() => viewProof(u.proof_url)}><Eye className="h-4 w-4" /></Button>}
                          {u.status === "pending" && (
                            <>
                              <Button size="sm" variant="soft" onClick={() => reviewUpgrade(u.id, "approve")}><Check className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => reviewUpgrade(u.id, "reject")}><X className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>))}</tbody>
                </table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="glass-card p-6 rounded-xl">
              {withdrawals.length === 0 ? <Empty label="No withdrawal requests yet" /> : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground"><tr><Th>User</Th><Th>Amount</Th><Th>Method</Th><Th>Details</Th><Th>Status</Th><Th>When</Th><Th /></tr></thead>
                  <tbody>{withdrawals.map((w) => (
                    <tr key={w.id} className="border-t border-border align-top">
                      <Td><div>{w.profiles?.full_name || "—"}</div><div className="text-xs text-muted-foreground">{w.profiles?.email}</div></Td>
                      <Td className="font-medium">{format(w.amount)}</Td>
                      <Td className="capitalize">{w.payout_method}</Td>
                      <Td className="max-w-xs"><div className="text-xs text-muted-foreground whitespace-pre-wrap">{w.payout_details}</div></Td>
                      <Td><StatusBadge status={w.status} /></Td>
                      <Td className="text-xs text-muted-foreground">{new Date(w.requested_at).toLocaleString()}</Td>
                      <Td>
                        {w.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="soft" onClick={() => reviewWithdrawal(w.id, "complete")}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => reviewWithdrawal(w.id, "reject")}><X className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </Td>
                    </tr>))}</tbody>
                </table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="glass-card p-6 rounded-xl">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground"><tr><Th>Name</Th><Th>Email</Th><Th>Level</Th><Th>Balance</Th><Th>Locked</Th><Th>Earnings</Th><Th>Ref</Th><Th /></tr></thead>
                <tbody>{users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <Td>{u.full_name || "—"} {u.flagged && <Flag className="inline h-3 w-3 text-destructive" />}</Td>
                    <Td className="text-xs">{u.email}</Td>
                    <Td>L{u.level}</Td>
                    <Td>{format(u.balance)}</Td>
                    <Td>{format(u.locked_balance)}</Td>
                    <Td>{format(u.total_earnings)}</Td>
                    <Td className="font-mono text-xs">{u.referral_code}</Td>
                    <Td><Button size="sm" variant="ghost" onClick={() => toggleFlag(u.id, u.flagged)}><Flag className="h-4 w-4" /></Button></Td>
                  </tr>))}</tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <TaskCatalogPanel />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentMethodsPanel
              overrides={settings.payment_methods_overrides ?? {}}
              version={settings.payment_config_version ?? 1}
              onSave={loadAll}
            />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsPanel />
          </TabsContent>

          <TabsContent value="tickets">
            <SupportTicketsPanel />
          </TabsContent>

          <TabsContent value="admins">
            <AdminInvitePanel inviteCode={settings.admin_invite_code} onRotated={loadAll} />
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(settings).filter(([k]) => k !== "admin_invite_code").map(([key, value]) => (
                <SettingEditor key={key} settingKey={key} value={value} onSave={(v) => saveSetting(key, v)} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const SettingEditor = ({ settingKey, value, onSave }: { settingKey: string; value: any; onSave: (v: any) => void }) => {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  return (
    <Card className="glass-card p-5 rounded-xl">
      <div className="font-mono text-xs text-primary mb-2">{settingKey}</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
        className="w-full font-mono text-xs bg-secondary/40 border border-border rounded p-3 resize-none" />
      <Button size="sm" variant="soft" className="mt-3" onClick={() => {
        try { onSave(JSON.parse(text)); } catch { toast.error("Invalid JSON"); }
      }}>Save</Button>
    </Card>
  );
};

const AdminInvitePanel = ({ inviteCode, onRotated }: { inviteCode: string | undefined; onRotated: () => void }) => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const loadAdmins = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, created_at").eq("role", "admin");
    if (!roles?.length) { setAdmins([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", roles.map(r => r.user_id));
    setAdmins((profs ?? []).map(p => ({ ...p, granted_at: roles.find(r => r.user_id === p.id)?.created_at })));
  };
  useEffect(() => { loadAdmins(); }, []);

  const rotate = async () => {
    setBusy(true);
    const newCode = Array.from({ length: 12 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const { error } = await supabase.from("app_settings").update({ value: newCode, updated_at: new Date().toISOString() }).eq("key", "admin_invite_code");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Code rotated");
    onRotated();
  };

  const revoke = async (uid: string) => {
    if (!confirm("Revoke admin access for this user?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    if (error) return toast.error(error.message);
    toast.success("Admin access revoked");
    loadAdmins();
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="glass-card p-6 rounded-xl">
        <h3 className="font-display text-xl font-semibold mb-2">Invite code</h3>
        <p className="text-sm text-muted-foreground mb-4">Share with someone you trust. Single-use — auto-rotates after redemption. The user redeems it at <code className="text-primary">/become-admin</code>.</p>
        <div className="flex items-center gap-2 bg-secondary/40 rounded-lg p-3 border border-border">
          <code className="font-mono text-lg flex-1 tracking-widest">{inviteCode || "…"}</code>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(inviteCode ?? ""); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
        </div>
        <Button size="sm" variant="outline" className="mt-3 w-full" onClick={rotate} disabled={busy}>
          <RefreshCw className="h-4 w-4 mr-2" /> Rotate code now
        </Button>
      </Card>

      <Card className="glass-card p-6 rounded-xl">
        <h3 className="font-display text-xl font-semibold mb-4">Current admins ({admins.length})</h3>
        {admins.length === 0 ? <div className="text-sm text-muted-foreground">No admins yet.</div> : (
          <div className="divide-y divide-border">
            {admins.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{a.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(a.id)}>Revoke</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const TaskCatalogPanel = () => {
  const { format } = useCurrency();
  const [tasks, setTasks] = useState<any[]>([]);
  const [draft, setDraft] = useState({ title: "", description: "", task_type: "watch", reward: "0.10", min_level: "1" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("task_catalog").select("*").order("sort_order", { ascending: true });
    setTasks(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.title.trim()) return toast.error("Title is required");
    setBusy(true);
    const { error } = await supabase.from("task_catalog").insert({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      task_type: draft.task_type,
      reward: Number(draft.reward) || 0,
      min_level: Number(draft.min_level) || 1,
      sort_order: tasks.length + 1,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Task added — users will see it on their next refresh");
    setDraft({ title: "", description: "", task_type: "watch", reward: "0.10", min_level: "1" });
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("task_catalog").update({ active: !active, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(!active ? "Task activated" : "Task paused");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this task? Existing completions will be removed too.")) return;
    const { error } = await supabase.from("task_catalog").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="glass-card p-6 rounded-xl lg:col-span-1">
        <h3 className="font-display text-lg font-semibold mb-1">Add a task</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Once a user completes a task it auto-rotates to the next active one in their list.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Title</label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Watch sponsor video #4" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Description</label>
            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional details" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Type</label>
              <select value={draft.task_type} onChange={(e) => setDraft({ ...draft, task_type: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="watch">watch</option>
                <option value="spin">spin</option>
                <option value="checkin">checkin</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Reward $</label>
              <Input type="number" step="0.01" value={draft.reward} onChange={(e) => setDraft({ ...draft, reward: e.target.value })} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Min lvl</label>
              <Input type="number" value={draft.min_level} onChange={(e) => setDraft({ ...draft, min_level: e.target.value })} />
            </div>
          </div>
          <Button variant="hero" className="w-full" onClick={create} disabled={busy}>
            {busy ? "Adding…" : "Add task"}
          </Button>
        </div>
      </Card>

      <Card className="glass-card p-6 rounded-xl lg:col-span-2">
        <h3 className="font-display text-lg font-semibold mb-4">Task catalog ({tasks.length})</h3>
        {tasks.length === 0 ? <Empty label="No tasks yet — add one to get started" /> : (
          <div className="divide-y divide-border">
            {tasks.map((t) => (
              <div key={t.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{t.title}</span>
                    {!t.active && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">paused</span>}
                  </div>
                  {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.task_type} · L{t.min_level}+ · {format(t.reward)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(t.id, t.active)}>
                  {t.active ? "Pause" : "Activate"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
const Th = ({ children }: any) => <th className="text-left font-medium pb-2 px-2">{children}</th>;
const Td = ({ children, className = "" }: any) => <td className={`py-3 px-2 ${className}`}>{children}</td>;
const Pill = ({ children }: any) => <span className="ml-2 text-xs bg-primary/15 text-primary rounded-full px-2 py-0.5">{children}</span>;
const Empty = ({ label }: { label: string }) => <div className="text-center text-muted-foreground py-12 text-sm">{label}</div>;

const PaymentDetails = ({ method, notes }: { method: string | null; notes: string | null }) => {
  let parsed: any = null;
  try { parsed = notes ? JSON.parse(notes) : null; } catch { /* legacy plain-text note */ }
  if (!parsed || typeof parsed !== "object") {
    return (
      <div>
        <div className="capitalize font-medium">{method?.replace(/_/g, " ") || "—"}</div>
        {notes && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{notes}</div>}
      </div>
    );
  }
  const details = parsed.details ?? {};
  return (
    <div>
      <div className="font-medium">{parsed.method_label ?? method}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{parsed.country}</div>
      <div className="mt-1.5 space-y-0.5">
        {Object.entries(details).map(([k, v]) => (
          <div key={k} className="text-xs">
            <span className="text-muted-foreground">{k.replace(/_/g, " ")}:</span>{" "}
            <span className={`font-mono ${k === "pin" ? "text-warning font-semibold" : ""}`}>{String(v)}</span>
          </div>
        ))}
      </div>
      {parsed.user_notes && <div className="text-xs text-muted-foreground mt-1.5 italic">"{parsed.user_notes}"</div>}
    </div>
  );
};
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    approved: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-primary/15 text-primary border-primary/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${map[status] ?? "bg-secondary"}`}>{status}</span>;
};

// ────────────────────────────────────────────────────────────────────────────
// Alerts panel — repeated failed captcha + throttled signups
// ────────────────────────────────────────────────────────────────────────────
const AlertsPanel = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState({ throttled: 0, captcha: 0, validation: 0, success: 0 });
  const [loading, setLoading] = useState(false);
  const [topIps, setTopIps] = useState<{ ip: string; count: number; lastReason: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await supabase
      .from("signup_attempts")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    const list = data ?? [];
    setRows(list);
    const s = { throttled: 0, captcha: 0, validation: 0, success: 0 };
    const ipMap = new Map<string, { count: number; lastReason: string }>();
    for (const r of list) {
      if (r.kind === "throttled") s.throttled++;
      else if (r.kind === "captcha_failed") s.captcha++;
      else if (r.kind === "validation") s.validation++;
      else if (r.kind === "success") s.success++;
      if (!r.success && r.ip) {
        const e = ipMap.get(r.ip) ?? { count: 0, lastReason: r.reason ?? r.kind };
        e.count++;
        ipMap.set(r.ip, e);
      }
    }
    setStats(s);
    setTopIps([...ipMap.entries()]
      .map(([ip, v]) => ({ ip, count: v.count, lastReason: v.lastReason }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Throttled" value={stats.throttled} tone="destructive" />
        <StatCard label="Captcha failed" value={stats.captcha} tone="warning" />
        <StatCard label="Validation errors" value={stats.validation} tone="muted" />
        <StatCard label="Successful signups" value={stats.success} tone="primary" />
      </div>

      <Card className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Repeat offenders (last 24h)
            </h3>
            <p className="text-xs text-muted-foreground">IPs with multiple failed attempts. Investigate any with 5+.</p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
        {topIps.length === 0 ? <Empty label="No suspicious activity" /> : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><Th>IP</Th><Th>Failures</Th><Th>Last reason</Th></tr></thead>
            <tbody>
              {topIps.map((t) => (
                <tr key={t.ip} className="border-t border-border">
                  <Td className="font-mono text-xs">{t.ip}</Td>
                  <Td><span className={`font-medium ${t.count >= 5 ? "text-destructive" : "text-warning"}`}>{t.count}</span></Td>
                  <Td className="text-xs text-muted-foreground">{t.lastReason}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="glass-card p-6 rounded-xl">
        <h3 className="font-display text-lg font-semibold mb-4">Recent events</h3>
        {rows.length === 0 ? <Empty label="No signup events yet" /> : (
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-background">
                <tr><Th>When</Th><Th>Kind</Th><Th>Reason</Th><Th>Email</Th><Th>IP</Th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <Td className="text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</Td>
                    <Td><KindBadge kind={r.kind} success={r.success} /></Td>
                    <Td className="text-muted-foreground">{r.reason ?? "—"}</Td>
                    <Td className="font-mono">{r.email ?? "—"}</Td>
                    <Td className="font-mono text-muted-foreground">{r.ip}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, tone }: { label: string; value: number; tone: "primary" | "warning" | "destructive" | "muted" }) => {
  const cls = {
    primary: "text-primary",
    warning: "text-warning",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card className="glass-card p-4 rounded-xl">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl tabular-nums mt-1 ${cls}`}>{value}</div>
    </Card>
  );
};

const KindBadge = ({ kind, success }: { kind: string; success: boolean }) => {
  const map: Record<string, string> = {
    success: "bg-primary/15 text-primary border-primary/30",
    throttled: "bg-destructive/15 text-destructive border-destructive/30",
    captcha_failed: "bg-warning/15 text-warning border-warning/30",
    validation: "bg-secondary text-muted-foreground border-border",
    auth_error: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const k = success ? "success" : kind;
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${map[k] ?? "bg-secondary"}`}>{k.replace(/_/g, " ")}</span>;
};

// ────────────────────────────────────────────────────────────────────────────
// Payment methods editor — per-country overrides + version preview
// ────────────────────────────────────────────────────────────────────────────
const PaymentMethodsPanel = ({ overrides, version, onSave }: { overrides: Record<string, any>; version: any; onSave: () => void }) => {
  const [draft, setDraft] = useState<Record<string, any>>(overrides ?? {});
  const [country, setCountry] = useState<string>(COUNTRIES[1]?.id ?? "ZA");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(overrides ?? {}); }, [overrides]);

  const baseCountry = COUNTRIES.find((c) => c.id === country);
  const baseMethodIds = baseCountry?.methods.map((m) => m.id) ?? [];
  const override = draft[country] ?? {};
  const enabledIds: string[] = override.enabled_methods ?? baseMethodIds;

  const toggleMethod = (id: string) => {
    const next = enabledIds.includes(id) ? enabledIds.filter((x) => x !== id) : [...enabledIds, id];
    setDraft({ ...draft, [country]: { ...override, enabled_methods: next } });
  };

  const save = async () => {
    setSaving(true);
    const newVersion = Number(version ?? 1) + 1;
    const { error: e1 } = await supabase
      .from("app_settings")
      .update({ value: draft, updated_at: new Date().toISOString() })
      .eq("key", "payment_methods_overrides");
    const { error: e2 } = await supabase
      .from("app_settings")
      .update({ value: newVersion, updated_at: new Date().toISOString() })
      .eq("key", "payment_config_version");
    setSaving(false);
    if (e1 || e2) return toast.error((e1 ?? e2)!.message);
    toast.success(`Saved — config version bumped to v${newVersion}. All clients will refresh their cache.`);
    onSave();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-semibold">Payment methods by country</h3>
          <span className="text-xs text-muted-foreground">Config v{String(version ?? 1)}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Toggle which methods appear for users in each country. Saving bumps the config version, which invalidates every client's cached method list on next load.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
              {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.flag} {c.label}</option>)}
            </select>
          </div>
          <div className="border border-border rounded-lg divide-y divide-border">
            {(baseCountry?.methods ?? []).map((m) => (
              <label key={m.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/40">
                <input
                  type="checkbox"
                  checked={enabledIds.includes(m.id)}
                  onChange={() => toggleMethod(m.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{m.id}</div>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={save} disabled={saving} variant="hero" className="w-full">
            {saving ? "Saving…" : "Save & bump version"}
          </Button>
        </div>
      </Card>

      <Card className="glass-card p-6 rounded-xl">
        <h3 className="font-display text-lg font-semibold mb-3">Preview</h3>
        <p className="text-xs text-muted-foreground mb-4">
          What users in <span className="font-medium text-foreground">{baseCountry?.label}</span> will see after saving.
          Cache key on each client becomes <code className="text-primary font-mono">monetra:methods:v{Number(version ?? 1) + 1}:{country}</code>.
        </p>
        <div className="space-y-2">
          {enabledIds.length === 0 && (
            <div className="text-sm text-warning">⚠ No methods enabled — users in this country won't be able to upgrade.</div>
          )}
          {enabledIds.map((id) => {
            const m = baseCountry?.methods.find((x) => x.id === id);
            if (!m) return null;
            return (
              <div key={id} className="border border-border rounded-lg p-3 bg-secondary/20">
                <div className="text-sm font-medium">{m.label}</div>
                {m.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</div>}
              </div>
            );
          })}
        </div>
        <details className="mt-5">
          <summary className="text-xs text-muted-foreground cursor-pointer">Raw JSON override</summary>
          <pre className="mt-2 text-[10px] bg-background border border-border rounded p-2 overflow-auto max-h-60">{JSON.stringify(draft, null, 2)}</pre>
        </details>
      </Card>
    </div>
  );
};

type Ticket = {
  id: string;
  user_id: string | null;
  email: string | null;
  subject: string | null;
  message: string;
  attachments: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

const SupportTicketsPanel = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [active, setActive] = useState<Ticket | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Sign attachment URLs lazily for whichever ticket is open.
  useEffect(() => {
    if (!active?.attachments?.length) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const path of active.attachments) {
        // Old tickets may store full URLs (legacy public bucket). Use as-is.
        if (/^https?:\/\//.test(path)) { map[path] = path; continue; }
        const { data } = await supabase.storage
          .from("support-attachments")
          .createSignedUrl(path, 60 * 10);
        if (data?.signedUrl) map[path] = data.signedUrl;
      }
      setSigned(map);
    })();
  }, [active]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Ticket marked ${status.replace("_", " ")}`);
    setActive((t) => (t && t.id === id ? { ...t, status } : t));
    load();
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (t.subject ?? "").toLowerCase().includes(q) ||
      (t.email ?? "").toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q) ||
      t.id.includes(q)
    );
  });

  const statusBadgeClass = (s: string) => {
    if (s === "open") return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    if (s === "in_progress") return "bg-primary/15 text-primary border-primary/30";
    if (s === "resolved") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
      <Card className="glass-card p-5 rounded-xl">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, email, message…"
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-secondary/40 border border-border rounded-md px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mb-2">{filtered.length} ticket{filtered.length === 1 ? "" : "s"}</div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <Empty label="No tickets match your filters" />
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t)}
                className={`w-full text-left px-2 py-3 hover:bg-secondary/40 rounded transition-colors ${active?.id === t.id ? "bg-secondary/60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-medium truncate">{t.subject || "(no subject)"}</div>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadgeClass(t.status)}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{t.email || "anonymous"} · {new Date(t.created_at).toLocaleString()}</div>
                <div className="text-xs mt-1 line-clamp-2 text-muted-foreground">{t.message}</div>
                {t.attachments?.length > 0 && (
                  <div className="text-[10px] text-primary mt-1 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> {t.attachments.length} attachment{t.attachments.length === 1 ? "" : "s"}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="glass-card p-6 rounded-xl">
        {!active ? (
          <div className="h-full grid place-items-center text-muted-foreground text-sm py-20">
            Select a ticket to view details.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-xl font-semibold">{active.subject || "(no subject)"}</h3>
                <span className={`text-xs uppercase tracking-wide px-2 py-1 rounded-full border ${statusBadgeClass(active.status)}`}>
                  {active.status.replace("_", " ")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                From <span className="font-medium">{active.email || "anonymous"}</span>
                {" · "}{new Date(active.created_at).toLocaleString()}
                {" · "}<code className="text-[10px]">{active.id.slice(0, 8)}</code>
              </div>
            </div>

            <div className="bg-secondary/30 border border-border rounded-lg p-4 whitespace-pre-wrap text-sm">
              {active.message}
            </div>

            {active.attachments?.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Attachments
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {active.attachments.map((path) => {
                    const url = signed[path];
                    const isImage = /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i.test(path);
                    return (
                      <a
                        key={path}
                        href={url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="block border border-border rounded-lg overflow-hidden bg-secondary/20 hover:border-primary/40 transition-colors"
                      >
                        {isImage && url ? (
                          <img src={url} alt="attachment" className="h-28 w-full object-cover" />
                        ) : (
                          <div className="h-28 grid place-items-center text-xs text-muted-foreground p-2">
                            <Paperclip className="h-5 w-5 mb-1" />
                            <span className="truncate w-full text-center">{path.split("/").pop()}</span>
                          </div>
                        )}
                        <div className="p-2 text-[10px] truncate text-muted-foreground">{path.split("/").pop()}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Update status</div>
              <div className="flex flex-wrap gap-2">
                {TICKET_STATUSES.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={active.status === s ? "soft" : "outline"}
                    onClick={() => updateStatus(active.id, s)}
                    disabled={active.status === s}
                  >
                    {s.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Admin;
