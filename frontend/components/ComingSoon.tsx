"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import InfoLink from "@/components/InfoLink";

export default function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        counter="(0)"
        info={<InfoLink />}
        actions={<Button iconName="refresh" ariaLabel="Refresh" />}
      >
        {title}
      </Header>
      <Container>
        <SpaceBetween size="m">
          <Alert type="info" header="Coming soon">
            {description ??
              `${title} is outside the core scope of this Route 53 clone and is present as a placeholder.`}
          </Alert>
          <Box color="text-body-secondary">
            In the meantime, head to Hosted zones to manage DNS.
          </Box>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}
