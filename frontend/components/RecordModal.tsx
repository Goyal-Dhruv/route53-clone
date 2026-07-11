"use client";

import { useEffect, useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import Select, { SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { api } from "@/lib/api";
import { DnsRecord, HostedZone, RECORD_TYPES, VALUE_HINTS } from "@/lib/types";

interface RecordModalProps {
  visible: boolean;
  zone: HostedZone;
  record: DnsRecord | null; // null = create mode
  onDismiss: () => void;
  onSaved: (message: string) => void;
}

const TYPE_OPTIONS: SelectProps.Options = RECORD_TYPES.map(t => ({
  label: `${t} — ${VALUE_HINTS[t].split(",")[0]}`,
  value: t,
}));

function subnameOf(zone: HostedZone, fqdn: string): string {
  if (fqdn === zone.name) return "";
  const suffix = "." + zone.name;
  return fqdn.endsWith(suffix) ? fqdn.slice(0, -suffix.length) : fqdn;
}

/** Create/edit form for a DNS record, presented as a Route 53-style modal. */
export default function RecordModal({ visible, zone, record, onDismiss, onSaved }: RecordModalProps) {
  const [name, setName] = useState("");
  const [typeOption, setTypeOption] = useState<SelectProps.Option>(TYPE_OPTIONS[0] as SelectProps.Option);
  const [ttl, setTtl] = useState("300");
  const [values, setValues] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isDefault = Boolean(record?.is_default);

  useEffect(() => {
    if (!visible) return;
    if (record) {
      setName(subnameOf(zone, record.name));
      setTypeOption({ label: record.type, value: record.type });
      setTtl(String(record.ttl));
      setValues(record.values.join("\n"));
    } else {
      setName("");
      setTypeOption(TYPE_OPTIONS[0] as SelectProps.Option);
      setTtl("300");
      setValues("");
    }
    setError("");
  }, [visible, record, zone]);

  const selectedType = typeOption.value ?? "A";
  const hint = VALUE_HINTS[selectedType] ?? "";

  const submit = async () => {
    const cleanValues = values
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);
    if (cleanValues.length === 0) {
      setError("At least one value is required.");
      return;
    }
    const ttlNum = Number.parseInt(ttl, 10);
    if (Number.isNaN(ttlNum) || ttlNum < 0) {
      setError("TTL must be a non-negative number of seconds.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { name, type: selectedType, ttl: ttlNum, values: cleanValues };
    try {
      if (record) {
        await api(`/api/zones/${zone.id}/records/${record.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        onSaved(`Record ${record.name} was updated successfully.`);
      } else {
        const created = await api<DnsRecord>(`/api/zones/${zone.id}/records`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`Record ${created.name} was created successfully.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={record ? "Edit record" : "Create record"}
      size="medium"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving}>
              {record ? "Save changes" : "Create record"}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        {error ? <Alert type="error">{error}</Alert> : null}
        {isDefault ? (
          <Alert type="info">
            This is a default record created with the hosted zone. Only its TTL and value can be edited.
          </Alert>
        ) : null}
        <FormField
          label="Record name"
          description={`Keep blank to create a record for the root domain (${zone.name}).`}
          constraintText={`The record name ends with .${zone.name}`}
        >
          <Input
            value={name}
            onChange={({ detail }) => setName(detail.value)}
            placeholder="subdomain"
            disabled={isDefault}
          />
        </FormField>
        <FormField label="Record type" description="The DNS type determines how traffic is routed.">
          <Select
            selectedOption={typeOption}
            onChange={({ detail }) => {
              if (detail.selectedOption) setTypeOption(detail.selectedOption);
            }}
            options={
              isDefault
                ? [{ label: record?.type ?? "", value: record?.type ?? "" }]
                : TYPE_OPTIONS
            }
            disabled={isDefault}
          />
        </FormField>
        <FormField
          label="TTL (seconds)"
          description="The amount of time, in seconds, that DNS resolvers cache this record."
        >
          <Input value={ttl} onChange={({ detail }) => setTtl(detail.value)} type="number" />
        </FormField>
        <FormField label="Value" description="Enter one value per line." constraintText={hint}>
          <Textarea
            value={values}
            onChange={({ detail }) => setValues(detail.value)}
            rows={4}
            placeholder={hint}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}
