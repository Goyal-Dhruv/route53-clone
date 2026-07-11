"use client";

import ComingSoon from "@/components/ComingSoon";
import Shell from "@/components/Shell";

export default function Page() {
  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Profiles", href: "/profiles" },
      ]}
    >
      <ComingSoon title="Profiles" />
    </Shell>
  );
}
