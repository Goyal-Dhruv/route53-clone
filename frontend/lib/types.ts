export interface User {
  id: number;
  email: string;
  name: string;
}

export interface HostedZone {
  id: string;
  name: string;
  type: "public" | "private" | string;
  comment: string;
  record_count: number;
  created_at: string | null;
  name_servers?: string[];
}

export interface DnsRecord {
  id: number;
  zone_id: string;
  name: string;
  type: string;
  ttl: number;
  values: string[];
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "PTR", "SRV", "CAA"] as const;

export const VALUE_HINTS: Record<string, string> = {
  A: "IPv4 address, e.g. 192.0.2.235 — one value per line",
  AAAA: "IPv6 address, e.g. 2001:0db8::8a2e:0370:7334",
  CNAME: "Domain name this record routes to, e.g. www.example.com (single value only)",
  MX: "Priority and mail server, e.g. 10 mail.example.com.",
  TXT: "Text value, e.g. v=spf1 include:example.com ~all",
  NS: "Name server, e.g. ns-1.awsdns-01.com.",
  PTR: "Domain name, e.g. www.example.com.",
  SRV: "priority weight port target, e.g. 1 10 5269 xmpp.example.com.",
  CAA: 'flags tag "value", e.g. 0 issue "letsencrypt.org"',
  SOA: "Start of authority value (managed with the hosted zone)",
};
