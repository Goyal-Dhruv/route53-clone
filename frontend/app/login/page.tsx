"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { api, getToken, setToken } from "@/lib/api";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/hostedzones");
  }, [router]);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter an email address and a password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      router.push("/hostedzones");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{ width: 420, maxWidth: "100%" }}>
        <SpaceBetween size="l">
          <Box textAlign="center">
            <Box variant="h1">Route 53 Clone</Box>
            <Box color="text-body-secondary">Next.js · FastAPI · SQLite</Box>
          </Box>
          <Container header={<Header variant="h2">Sign in</Header>}>
            <SpaceBetween size="l">
              {error ? <Alert type="error">{error}</Alert> : null}
              <Alert type="info">Authentication is mocked — sign in with any email and password.</Alert>
              <FormField label="Email address">
                <Input
                  value={email}
                  onChange={({ detail }) => setEmail(detail.value)}
                  placeholder="you@example.com"
                  type="email"
                />
              </FormField>
              <FormField label="Password">
                <Input
                  value={password}
                  onChange={({ detail }) => setPassword(detail.value)}
                  type="password"
                  onKeyDown={({ detail }) => {
                    if (detail.key === "Enter") submit();
                  }}
                />
              </FormField>
              <Button variant="primary" fullWidth loading={loading} onClick={submit}>
                Sign in
              </Button>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      </div>
    </div>
  );
}
