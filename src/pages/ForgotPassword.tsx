import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const { error } = await supabase.functions.invoke("recovery-reset", {
      body: {
        email: email.trim().toLowerCase(),
        recoveryKey: recoveryKey.trim(),
        password,
      },
    });

    if (error) {
      toast.error(error.message || "Password reset failed");
      return;
    }

    toast.success("Password reset successful. You can now sign in.");
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleReset} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Reset Password</h1>

        <p className="text-sm text-muted-foreground">
          Enter your email and one of your saved recovery keys.
        </p>

        <input
          className="w-full rounded-md border px-3 py-2 bg-background"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full rounded-md border px-3 py-2 bg-background"
          placeholder="Recovery key"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
        />

        <input
          type="password"
          className="w-full rounded-md border px-3 py-2 bg-background"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          className="w-full rounded-md border px-3 py-2 bg-background"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button className="w-full rounded-md bg-primary text-primary-foreground py-2">
          Reset Password
        </button>
      </form>
    </div>
  );
};

export default ForgotPassword;
