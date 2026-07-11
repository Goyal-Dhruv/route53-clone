"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import InfoLink from "@/components/InfoLink";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";
import type { HostedZone, Paginated } from "@/lib/types";

/** One of the four feature cards at the top of the Route 53 dashboard. */
function FeatureCard({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: React.ReactNode;
}) {
  return (
    <Box textAlign="center" padding="s">
      <SpaceBetween size="s">
        <Box variant="h3">{title}</Box>
        <Box variant="p" color="text-body-secondary">
          {description}
        </Box>
        <div>{actions}</div>
      </SpaceBetween>
    </Box>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [zoneTotal, setZoneTotal] = useState<number | null>(null);
  const [domain, setDomain] = useState("");

  useEffect(() => {
    api<Paginated<HostedZone>>("/api/zones?page=1&page_size=1")
      .then(res => setZoneTotal(res.total))
      .catch(() => setZoneTotal(0));
  }, []);

  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Dashboard", href: "/dashboard" },
      ]}
    >
      <SpaceBetween size="l">
        <Header variant="h1" info={<InfoLink />}>
          Route 53 Dashboard
        </Header>

        {/* The four feature cards, exactly as in the Route 53 console. */}
        <Container>
          <ColumnLayout columns={4} variant="text-grid">
            <FeatureCard
              title="DNS management"
              description="A hosted zone tells Route 53 how to respond to DNS queries for a domain such as example.com."
              actions={
                <Button onClick={() => router.push("/hostedzones/create")}>Create hosted zone</Button>
              }
            />
            <FeatureCard
              title="Availability monitoring"
              description="Health checks monitor your applications and web resources, and direct DNS queries to healthy resources."
              actions={<Button onClick={() => router.push("/healthchecks")}>Create health check</Button>}
            />
            <FeatureCard
              title="Traffic management"
              description="A visual tool that lets you easily create policies for multiple endpoints in complex configurations."
              actions={<Button onClick={() => router.push("/trafficpolicies")}>Create policy</Button>}
            />
            <FeatureCard
              title="Domain registration"
              description="A domain is the name, such as example.com, that your users use to access your application."
              actions={<Button onClick={() => router.push("/domains")}>Register domain</Button>}
            />
          </ColumnLayout>
        </Container>

        {/* Live stats for the parts of the clone that are actually implemented. */}
        <Container header={<Header variant="h2">Your resources</Header>}>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Hosted zones</Box>
              <Box fontSize="display-l" fontWeight="bold">
                <Link
                  href="/hostedzones"
                  onFollow={e => {
                    e.preventDefault();
                    router.push("/hostedzones");
                  }}
                >
                  {zoneTotal === null ? "—" : String(zoneTotal)}
                </Link>
              </Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Health checks</Box>
              <Box fontSize="display-l" fontWeight="bold">
                0
              </Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Traffic policies</Box>
              <Box fontSize="display-l" fontWeight="bold">
                0
              </Box>
            </div>
          </ColumnLayout>
        </Container>

        <Container header={<Header variant="h2">Register domain</Header>}>
          <SpaceBetween size="s">
            <Box variant="p">Find and register an available domain, or transfer your existing domains to Route 53.</Box>
            <Input
              value={domain}
              onChange={({ detail }) => setDomain(detail.value)}
              placeholder="Enter a domain name"
            />
            <Box variant="small" color="text-body-secondary">
              Each label (each part between dots) can be up to 63 characters long and must start with
              a-z or 0-9. Maximum length: 255 characters, including dots. Valid characters: a-z, 0-9,
              and - (hyphen)
            </Box>
            <Button onClick={() => router.push("/domains")}>Check</Button>
          </SpaceBetween>
        </Container>

        <Table
          header={
            <Header variant="h2" actions={<Button iconName="refresh" ariaLabel="Refresh" />}>
              Notifications
            </Header>
          }
          items={[]}
          columnDefinitions={[
            { id: "resource", header: "Resource", cell: () => "" },
            { id: "status", header: "Status", cell: () => "" },
            { id: "update", header: "Last update", cell: () => "" },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
              No notifications to display
            </Box>
          }
        />

        <Container header={<Header variant="h2">Service health</Header>}>
          <Box variant="p">
            To view the current status of Route 53, see the AWS Service Health Dashboard.
          </Box>
        </Container>
      </SpaceBetween>
    </Shell>
  );
}
