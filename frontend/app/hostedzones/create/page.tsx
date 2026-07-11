"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import InfoLink from "@/components/InfoLink";
import Shell from "@/components/Shell";
import { useFlash } from "@/app/providers";
import { api } from "@/lib/api";
import type { HostedZone } from "@/lib/types";

export default function CreateHostedZonePage() {
  const router = useRouter();
  const { addFlash } = useFlash();

  const [name, setName] = useState("");
  const [type, setType] = useState("public");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Enter a domain name for the hosted zone.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const zone = await api<HostedZone>("/api/zones", {
        method: "POST",
        body: JSON.stringify({ name, type, comment }),
      });
      addFlash("success", `Hosted zone ${zone.name} was created successfully.`);
      router.push(`/hostedzones/${zone.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create hosted zone.");
      setSaving(false);
    }
  };

  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Hosted zones", href: "/hostedzones" },
        { text: "Create hosted zone", href: "/hostedzones/create" },
      ]}
    >
      <Box padding={{ top: "s" }}>
        <SpaceBetween size="l">
          <Header variant="h1" info={<InfoLink />} description="Enter the domain that you want to route traffic for.">
            Create hosted zone
          </Header>
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => router.push("/hostedzones")} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={submit} loading={saving}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="l">
              {error ? <Alert type="error">{error}</Alert> : null}
              <Container header={<Header variant="h2">Hosted zone configuration</Header>}>
                <SpaceBetween size="l">
                  <FormField
                    label="Domain name"
                    description="This is the name of the domain that you want to route traffic for."
                    constraintText="Enter a fully qualified domain name, for example, example.com."
                  >
                    <Input
                      value={name}
                      onChange={({ detail }) => setName(detail.value)}
                      placeholder="example.com"
                      onKeyDown={({ detail }) => {
                        if (detail.key === "Enter") submit();
                      }}
                    />
                  </FormField>
                  <FormField label="Description - optional" description="Add a comment about this hosted zone.">
                    <Textarea
                      value={comment}
                      onChange={({ detail }) => setComment(detail.value)}
                      rows={2}
                      placeholder="A short description to help you identify this hosted zone."
                    />
                  </FormField>
                  <FormField
                    label="Type"
                    description="A public hosted zone determines how traffic is routed on the internet. A private hosted zone determines how traffic is routed within a VPC."
                  >
                    <RadioGroup
                      value={type}
                      onChange={({ detail }) => setType(detail.value)}
                      items={[
                        {
                          value: "public",
                          label: "Public hosted zone",
                          description: "Routes traffic on the internet.",
                        },
                        {
                          value: "private",
                          label: "Private hosted zone",
                          description: "Routes traffic within one or more VPCs.",
                        },
                      ]}
                    />
                  </FormField>
                </SpaceBetween>
              </Container>
            </SpaceBetween>
          </Form>
        </SpaceBetween>
      </Box>
    </Shell>
  );
}
