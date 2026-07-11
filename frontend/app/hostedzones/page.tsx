"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import Textarea from "@cloudscape-design/components/textarea";
import InfoLink from "@/components/InfoLink";
import Shell from "@/components/Shell";
import { useFlash } from "@/app/providers";
import { api } from "@/lib/api";
import type { HostedZone, Paginated } from "@/lib/types";

const PAGE_SIZE = 10;

export default function HostedZonesPage() {
  const router = useRouter();
  const { addFlash } = useFlash();

  const [zones, setZones] = useState<HostedZone[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [search, setSearch] = useState(""); // debounced value sent to the API
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [loading, setLoading] = useState(true);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      const res = await api<Paginated<HostedZone>>(`/api/zones?${params.toString()}`);
      setZones(res.items);
      setTotal(res.total);
    } catch (e) {
      addFlash("error", e instanceof Error ? e.message : "Failed to load hosted zones.");
    } finally {
      setLoading(false);
    }
  }, [page, search, addFlash]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the text filter into a server-side search.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(filterText);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filterText]);

  const zone = selected[0];

  const closeDelete = () => {
    setDeleteVisible(false);
    setConfirmText("");
  };

  const doDelete = async () => {
    if (!zone) return;
    setDeleting(true);
    try {
      await api(`/api/zones/${zone.id}`, { method: "DELETE" });
      addFlash("success", `Hosted zone ${zone.name} was deleted successfully.`);
      setSelected([]);
      closeDelete();
      load();
    } catch (e) {
      addFlash("error", e instanceof Error ? e.message : "Failed to delete hosted zone.");
      closeDelete();
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = () => {
    if (!zone) return;
    setEditComment(zone.comment || "");
    setEditVisible(true);
  };

  const doEdit = async () => {
    if (!zone) return;
    setSaving(true);
    try {
      await api(`/api/zones/${zone.id}`, {
        method: "PATCH",
        body: JSON.stringify({ comment: editComment }),
      });
      addFlash("success", `Hosted zone ${zone.name} was updated successfully.`);
      setEditVisible(false);
      setSelected([]);
      load();
    } catch (e) {
      addFlash("error", e instanceof Error ? e.message : "Failed to update hosted zone.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell
      breadcrumbs={[
        { text: "Route 53", href: "/dashboard" },
        { text: "Hosted zones", href: "/hostedzones" },
      ]}
    >
      <Table
        variant="full-page"
        loading={loading}
        loadingText="Loading hosted zones"
        items={zones}
        trackBy="id"
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected([...detail.selectedItems])}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={`(${total})`}
            info={<InfoLink />}
            description="Automatic mode is the current search behavior optimized for best filter results."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Refresh" onClick={load} />
                <Button disabled={!zone} onClick={() => zone && router.push(`/hostedzones/${zone.id}`)}>
                  View details
                </Button>
                <Button disabled={!zone} onClick={openEdit}>
                  Edit
                </Button>
                <Button disabled={!zone} onClick={() => setDeleteVisible(true)}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => router.push("/hostedzones/create")}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        columnDefinitions={[
          {
            id: "name",
            header: "Hosted zone name",
            sortingField: "name",
            cell: z => (
              <Link
                href={`/hostedzones/${z.id}`}
                onFollow={e => {
                  e.preventDefault();
                  router.push(`/hostedzones/${z.id}`);
                }}
              >
                {z.name}
              </Link>
            ),
          },
          { id: "type", header: "Type", cell: z => (z.type === "public" ? "Public" : "Private") },
          { id: "created_by", header: "Created by", cell: () => "Route 53 Console" },
          { id: "records", header: "Record count", cell: z => z.record_count },
          { id: "comment", header: "Description", cell: z => z.comment || "-" },
          { id: "id", header: "Hosted zone ID", cell: z => z.id },
        ]}
        filter={
          <TextFilter
            filteringText={filterText}
            filteringPlaceholder="Filter records by property or value"
            onChange={({ detail }) => setFilterText(detail.filteringText)}
            countText={search ? `${total} match${total === 1 ? "" : "es"}` : ""}
          />
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
                No hosted zones
              </Box>
              <Box variant="p" color="inherit">
                There are no hosted zones created for this account.
              </Box>
              <Button onClick={() => router.push("/hostedzones/create")}>Create hosted zone</Button>
            </SpaceBetween>
          </Box>
        }
      />

      <Modal
        visible={editVisible}
        onDismiss={() => setEditVisible(false)}
        header={`Edit ${zone?.name ?? "hosted zone"}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditVisible(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={doEdit}>
                Save changes
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField label="Description - optional" description="Add a comment to help you identify this hosted zone.">
          <Textarea value={editComment} onChange={({ detail }) => setEditComment(detail.value)} rows={3} />
        </FormField>
      </Modal>

      <Modal
        visible={deleteVisible}
        onDismiss={closeDelete}
        header={`Delete ${zone?.name ?? "hosted zone"}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={closeDelete}>
                Cancel
              </Button>
              <Button variant="primary" disabled={confirmText !== "delete"} loading={deleting} onClick={doDelete}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning">
            Deleting the hosted zone {zone?.name} can&apos;t be undone. A hosted zone that contains
            records other than the default NS and SOA records can&apos;t be deleted — delete those
            records first.
          </Alert>
          <FormField label={'To confirm deletion, type "delete" in the field below.'}>
            <Input value={confirmText} onChange={({ detail }) => setConfirmText(detail.value)} placeholder="delete" />
          </FormField>
        </SpaceBetween>
      </Modal>
    </Shell>
  );
}
