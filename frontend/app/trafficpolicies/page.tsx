"use client";

import ComingSoon from "@/components/ComingSoon";
import Shell from "@/components/Shell";

export default function Page() {
  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Traffic policies", href: "/trafficpolicies" },
      ]}
    >
      <ComingSoon title="Traffic policies" />
    </Shell>
  );
}
