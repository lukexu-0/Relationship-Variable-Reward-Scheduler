import { useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useAuth } from "./useAuth";

export function AuthPanel() {
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (mode === "login") {
        await auth.login({ email, password });
      } else {
        await auth.register({ email, password, timezone });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed");
    }
  };

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <Card
        title="Relationship Reward Scheduler"
        subtitle="Adaptive relationship event planning with feedback-aware timing"
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <Button variant={mode === "login" ? "primary" : "soft"} onClick={() => setMode("login")}>
            Login
          </Button>
          <Button
            variant={mode === "register" ? "primary" : "soft"}
            onClick={() => setMode("register")}
          >
            Register
          </Button>
        </div>

        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />

          <label htmlFor="password" style={{ marginTop: 10 }}>
            Password
          </label>
          <input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            type="password"
          />

          {mode === "register" ? (
            <>
              <label htmlFor="timezone" style={{ marginTop: 10 }}>
                Timezone
              </label>
              <input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
              />
            </>
          ) : null}

          {error ? (
            <p style={{ color: "#8a2222", marginTop: 10 }}>
              {error}
            </p>
          ) : null}

          <div style={{ marginTop: 12 }}>
            <Button type="submit">{mode === "login" ? "Sign In" : "Create Account"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
