import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Copy, Eye, Flag, RefreshCw, X } from "lucide-react";

const Admin = () => {
  const { user, loading } = useAuth();
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
          <TabsList className="mb-6">
            <TabsTrigger value="upgrades">Upgrades <Pill>{pendingUpgrades.length}</Pill></TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals <Pill>{pendingWithdrawals.length}</Pill></TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
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
                      <Td>${Number(u.amount).toFixed(2)}</Td>
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
                      <Td className="font-medium">${Number(w.amount).toFixed(2)}</Td>
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
                    <Td>${Number(u.balance).toFixed(2)}</Td>
                    <Td>${Number(u.locked_balance).toFixed(2)}</Td>
                    <Td>${Number(u.total_earnings).toFixed(2)}</Td>
                    <Td className="font-mono text-xs">{u.referral_code}</Td>
                    <Td><Button size="sm" variant="ghost" onClick={() => toggleFlag(u.id, u.flagged)}><Flag className="h-4 w-4" /></Button></Td>
                  </tr>))}</tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <TaskCatalogPanel />
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
                    {t.task_type} · L{t.min_level}+ · ${Number(t.reward).toFixed(2)}
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

export default Admin;
