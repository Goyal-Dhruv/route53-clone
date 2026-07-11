"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import Select, { SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import InfoLink from "@/components/InfoLink";
import RecordModal from "@/components/RecordModal";
import Shell from "@/components/Shell";
import { useFlash } from "@/app/providers";
import { api, downloadExport } from "@/lib/api";
import { DnsRecord, HostedZone, Paginated, RECORD_TYPES } from "@/lib/types";

const PAGE_SIZE = 10;

const TYPE_FILTER_OPTIONS: SelectProps.Options = [
  { label: "All types", value: "" },
  ...RECORD_TYPES.map(t => ({ label: t, value: t })),
];

export default function ZoneDetailPage() {
  const router = useRouter();
  const params = useParams();
  const zoneId = params.id as string;
  const { addFlash } = useFlash();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SelectProps.Option>(
    TYPE_FILTER_OPTIONS[0] as SelectProps.Option
  );
  const [selected, setSelected] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<DnsRecord | null>(null);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadZone = useCallback(async () => {
    try {
      const z = await api<HostedZone>(`/api/zones/${zoneId}`);
      setZone(z);
    } catch {
      setNotFound(true);
    }
  }, [zoneId]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (search) p.set("search", search);
      if (typeFilter.value) p.set("type", String(typeFilter.value));
      const res = await api<Paginated<DnsRecord>>(`/api/zones/${zoneId}/records?${p.toString()}`);
      setRecords(res.items);
      setTotal(res.total);
    } catch (e) {
      addFlash("error", e instanceof Error ? e.message : "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [zoneId, page, search, typeFilter, addFlash]);

  useEffect(() => {
    loadZone();
  }, [loadZone]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(filterText);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filterText]);

  const refresh = () => {
    loadZone();
    loadRecords();
    setSelected([]);
  };

  const onSaved = (message: string) => {
    setModalVisible(false);
    setEditing(null);
    addFlash("success", message);
    refresh();
  };

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };
  const openEdit = (r: DnsRecord) => {
    setEditing(r);
    setModalVisible(true);
  };

  const deletable = selected.filter(r => !r.is_default);

  const doBulkDelete = async () => {
    setDeleting(true);
    try {
      const res = await api<{ deleted: number; skipped_default: number }>(
        `/api/zones/${zoneId}/records/bulk-delete`,
        { method: "POST", body: JSON.stringify({ ids: selected.map(r => r.id) }) }
      );
      addFlash(
        "success",
        `${res.deleted} record${res.deleted === 1 ? "" : "s"} deleted.` +
          (res.skipped_default ? ` ${res.skipped_default} default record(s) were skipped.` : "")
      );
      setDeleteVisible(false);
      refresh();
    } catch (e) {
      addFlash("error", e instanceof Error ? e.message : "Failed to delete records.");
    } finally {
      setDeleting(false);
    }
  };

  const onExport = async (id: string) => {
    if (!zone) return;
    const base = zone.name.replace(/\.$/, "");
    try {
      if (id === "json") await downloadExport(zoneId, "json", `${base}.json`);
      else await downloadExport(zoneId, "bind", `${base}.zone`);
      addFlash("success", `Hosted zone exported as ${id.toUpperCase()}.`);
    } catch (e) {
      addFlash("error", e instanceof Error ? e.message : "Export failed.");
    }
  };

  if (notFound) {
    return (
      <Shell
        breadcrumbs={[
          { text: "Route 53", href: "/dashboard" },
          { text: "Hosted zones", href: "/hostedzones" },
        ]}
      >
        <Alert
          type="error"
          header="Hosted zone not found"
          action={<Button onClick={() => router.push("/hostedzones")}>Back to hosted zones</Button>}
        >
          No hosted zone was found with ID {zoneId}.
        </Alert>
      </Shell>
    );
  }

  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Hosted zones", href: "/hostedzones" },
        { text: zone?.name ?? zoneId, href: `/hostedzones/${zoneId}` },
      ]}
    >
      <SpaceBetween size="l">
        <Header variant="h1" info={<InfoLink />}>
          {zone?.name ?? "Hosted zone"}
        </Header>

        <Container
          header={
            <Header variant="h2" info={<InfoLink />}>
              Hosted zone details
            </Header>
          }
        >
          <ColumnLayout columns={4} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Hosted zone ID</Box>
              <div>{zone?.id ?? "—"}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Type</Box>
              <div>{zone ? (zone.type === "public" ? "Public" : "Private") : "—"}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Record count</Box>
              <div>{zone?.record_count ?? "—"}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Description</Box>
              <div>{zone?.comment || "-"}</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Box variant="awsui-key-label">Name servers</Box>
              <div>
                {zone?.name_servers?.length ? (
                  <SpaceBetween size="xxs">
                    {zone.name_servers.map(ns => (
                      <div key={ns}>{ns}</div>
                    ))}
                  </SpaceBetween>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </ColumnLayout>
        </Container>

        <Table
          loading={loading}
          loadingText="Loading records"
          items={records}
          trackBy="id"
          selectionType="multi"
          selectedItems={selected}
          onSelectionChange={({ detail }) => setSelected([...detail.selectedItems])}
          header={
            <Header
              variant="h2"
              counter={selected.length ? `(${selected.length}/${total})` : `(${total})`}
              info={<InfoLink />}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button iconName="refresh" ariaLabel="Refresh" onClick={refresh} />
                  <Button disabled={selected.length !== 1} onClick={() => selected[0] && openEdit(selected[0])}>
                    Edit record
                  </Button>
                  <Button disabled={deletable.length === 0} onClick={() => setDeleteVisible(true)}>
                    Delete record
                  </Button>
                  <ButtonDropdown
                    items={[
                      { id: "json", text: "Export as JSON" },
                      { id: "bind", text: "Export as BIND zone file" },
                    ]}
                    onItemClick={({ detail }) => onExport(detail.id)}
                  >
                    Export
                  </ButtonDropdown>
                  <Button variant="primary" onClick={openCreate}>
                    Create record
                  </Button>
                </SpaceBetween>
              }
            >
              Records
            </Header>
          }
          columnDefinitions={[
            { id: "name", header: "Record name", cell: r => r.name, sortingField: "name" },
            {
              id: "type",
              header: "Type",
              cell: r => (
                <SpaceBetween direction="horizontal" size="xxs">
                  <span>{r.type}</span>
                  {r.is_default ? <Badge color="grey">default</Badge> : null}
                </SpaceBetween>
              ),
            },
            { id: "routing", header: "Routing policy", cell: () => "Simple" },
            {
              id: "value",
              header: "Value/Route traffic to",
              cell: r => (
                <div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}>
                  {r.values.join("\n")}
                </div>
              ),
            },
            { id: "ttl", header: "TTL (seconds)", cell: r => r.ttl },
          ]}
          filter={
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <TextFilter
                  filteringText={filterText}
                  filteringPlaceholder="Filter records by property or value"
                  onChange={({ detail }) => setFilterText(detail.filteringText)}
                  countText={search ? `${total} match${total === 1 ? "" : "es"}` : ""}
                />
              </div>
              <div style={{ width: 200 }}>
                <Select
                  selectedOption={typeFilter}
                  options={TYPE_FILTER_OPTIONS}
                  onChange={({ detail }) => {
                    if (detail.selectedOption) {
                      setTypeFilter(detail.selectedOption);
                      setPage(1);
                    }
                  }}
                />
              </div>
            </div>
          }
          pagination={
            <Pagination
              currentPageIndex={page}
              pagesCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              onChange={({ detail }) => setPage(detail.currentPageIndex)}
            />
          }
          empty={
            <Box textAlign="center" color="inherit" padding={{ vertical: "xl" }}>
              <SpaceBetween size="s">
                <Box variant="strong" color="inherit">
                  No records
                </Box>
                <Box variant="p" color="inherit">
                  No DNS records match your filters.
                </Box>
                <Button onClick={openCreate}>Create record</Button>
              </SpaceBetween>
            </Box>
          }
        />
      </SpaceBetween>

      {zone ? (
        <RecordModal
          visible={modalVisible}
          zone={zone}
          record={editing}
          onDismiss={() => {
            setModalVisible(false);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      ) : null}

      <Modal
        visible={deleteVisible}
        onDismiss={() => setDeleteVisible(false)}
        header="Delete records"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={deleting} onClick={doBulkDelete}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box>
            Delete {deletable.length} record{deletable.length === 1 ? "" : "s"}? This action
            can&apos;t be undone.
          </Box>
          {selected.length !== deletable.length ? (
            <Alert type="info">
              Default NS and SOA records are required by the hosted zone and will be skipped.
            </Alert>
          ) : null}
        </SpaceBetween>
      </Modal>
    </Shell>
  );
}
