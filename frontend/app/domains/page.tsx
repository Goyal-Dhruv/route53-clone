"use client";

import ComingSoon from "@/components/ComingSoon";
import Shell from "@/components/Shell";

export default function Page() {
  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Registered domains", href: "/domains" },
      ]}
    >
      <ComingSoon title="Registered domains" />
    </Shell>
  );
}
