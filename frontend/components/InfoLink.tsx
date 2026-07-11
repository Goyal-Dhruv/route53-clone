"use client";

import Link from "@cloudscape-design/components/link";

/** The small blue "Info" link that sits next to every heading in the AWS console. */
export default function InfoLink() {
  return (
    <Link variant="info" onFollow={e => e.preventDefault()}>
      Info
    </Link>
  );
}
