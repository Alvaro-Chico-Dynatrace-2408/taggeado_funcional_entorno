import React, { useState, useMemo, useCallback } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { Select } from "@dynatrace/strato-components/forms";
import { Button } from "@dynatrace/strato-components/buttons";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { UploadIcon, MagnifyingGlassIcon, DocumentIcon } from "@dynatrace/strato-icons";

import type { EntityType, AFSource } from "../utils/entity-types";
import {
  ALL_SEARCHABLE_TYPES,
  ENTITY_TYPE_LABELS,
  extractAllAFFromTags,
  isK8sEntityType,
} from "../utils/entity-types";
import { AFBadge } from "../components/AFBadge";
import { buildBulkFetchByIds, buildBulkServicesCalledByApps } from "../utils/dql-queries";
import { validateEntityId } from "../utils/validators";

/* ─── Constants ─── */
const APP_TYPES: EntityType[] = ["application", "mobile_application", "custom_application"];
const MAX_IDS = 500;

/* ─── Types ─── */
interface BulkResultRow {
  id: string;
  name: string;
  directAF: string[];
  inheritedAF: string[];
  afSource: AFSource;
  afCount: number;
}

/* ─── All namespaces AF query (for k8s inheritance) ─── */
const ALL_NS_AF_QUERY = `fetch dt.entity.cloud_application_namespace, from:now()-7d
| fieldsAdd tags, entity.name, clustered_by[dt.entity.kubernetes_cluster]
| filter contains(toString(tags), "AppFuncional_DatalakeInfo")
| limit 5000`;

export const BulkSearchView = () => {
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  /* ─── File upload handler ─── */
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      // Validate each line as an entity ID
      const validIds = lines.filter(validateEntityId);
      setEntityIds(validIds.slice(0, MAX_IDS));
      setSearchTriggered(false);
    };
    reader.readAsText(file);
  }, []);

  /* ─── Trigger search ─── */
  const handleSearch = useCallback(() => {
    if (selectedType && entityIds.length > 0) {
      setSearchTriggered(true);
    }
  }, [selectedType, entityIds]);

  /* ─── Main entity fetch ─── */
  const bulkQuery = useMemo(() => {
    if (!searchTriggered || !selectedType || entityIds.length === 0) return null;
    return buildBulkFetchByIds(selectedType, entityIds);
  }, [searchTriggered, selectedType, entityIds]);

  const { data: bulkData, isLoading: bulkLoading } = useDql(
    bulkQuery ? { query: bulkQuery, maxResultRecords: 5000 } : { query: "" },
    { enabled: !!bulkQuery }
  );

  /* ─── K8s namespace AF data (for workloads, pods, clusters, nodes) ─── */
  const needsNsAF = searchTriggered && selectedType && (
    selectedType === "kubernetes_cluster" ||
    selectedType === "cloud_application_namespace" ||
    selectedType === "cloud_application" ||
    selectedType === "cloud_application_instance" ||
    selectedType === "kubernetes_node"
  );

  const { data: allNsData } = useDql(
    { query: ALL_NS_AF_QUERY, maxResultRecords: 5000 },
    { enabled: !!needsNsAF }
  );

  /* ─── App AF from services (for application types) ─── */
  const isAppType = selectedType && APP_TYPES.includes(selectedType);
  const appAFQuery = useMemo(() => {
    if (!searchTriggered || !isAppType || entityIds.length === 0) return null;
    return buildBulkServicesCalledByApps(entityIds, selectedType!);
  }, [searchTriggered, isAppType, entityIds, selectedType]);

  const { data: appAFData, isLoading: appAFLoading } = useDql(
    appAFQuery ? { query: appAFQuery, maxResultRecords: 10000 } : { query: "" },
    { enabled: !!appAFQuery }
  );

  /* ─── Node AF query: pods→namespaces lookup ─── */
  const nodeAFQuery = useMemo(() => {
    if (!searchTriggered || selectedType !== "kubernetes_node" || !bulkData?.records) return null;
    // Get node names for the lookup query
    const nodeNames = bulkData.records
      .map((r) => (r as Record<string, unknown>)["entity.name"] as string)
      .filter(Boolean);
    if (nodeNames.length === 0) return null;
    // Use a single query that resolves AF for all nodes
    return `fetch dt.entity.cloud_application_instance, from:now()-7d
| fields id, namespaceName
| lookup [fetch dt.entity.cloud_application_namespace, from:now()-7d | expand tags | filter contains(tags,"AppFuncional") | fieldsAdd ff=1], sourceField:namespaceName, lookupField:entity.name, fields:{ff,tags}
| filterOut isNull(ff)
| lookup [fetch dt.entity.kubernetes_node, from:now()-7d | expand runs[dt.entity.cloud_application_instance] | fieldsAdd NodeName=entity.name], lookupField:\`runs[dt.entity.cloud_application_instance]\`, sourceField:id, fields:{NodeName}
| filterOut isNull(NodeName)
| fields NodeName, tags
| dedup NodeName, tags`;
  }, [searchTriggered, selectedType, bulkData]);

  const { data: nodeAFData } = useDql(
    nodeAFQuery ? { query: nodeAFQuery, maxResultRecords: 10000 } : { query: "" },
    { enabled: !!nodeAFQuery }
  );

  /* ─── Build results table ─── */
  const results = useMemo<BulkResultRow[]>(() => {
    if (!bulkData?.records || !searchTriggered) return [];

    const rows: BulkResultRow[] = [];

    for (const record of bulkData.records) {
      const rec = record as Record<string, unknown>;
      const id = rec.id as string;
      const name = (rec["entity.name"] as string) || "";
      const tags = (rec.tags as unknown[]) || [];
      const directAF = extractAllAFFromTags(tags);

      let inheritedAF: string[] = [];
      let afSource: AFSource = "direct";

      // Resolve inherited AF based on entity type
      if (selectedType === "kubernetes_cluster" && allNsData?.records) {
        // Cluster: aggregate AF from all its namespaces
        for (const nsRec of allNsData.records) {
          const ns = nsRec as Record<string, unknown>;
          let clusterField: unknown = ns["clustered_by[dt.entity.kubernetes_cluster]"];
          if (clusterField === undefined || clusterField === null) {
            for (const key of Object.keys(ns)) {
              if (key.toLowerCase().includes("cluster")) {
                clusterField = ns[key];
                if (clusterField !== undefined && clusterField !== null) break;
              }
            }
          }
          let nsClusterId: string | null = null;
          if (typeof clusterField === "string") nsClusterId = clusterField;
          else if (Array.isArray(clusterField) && clusterField.length > 0) {
            const first = clusterField[0];
            if (typeof first === "string") nsClusterId = first;
            else if (first && typeof first === "object") nsClusterId = (first as Record<string, unknown>).id as string;
          } else if (clusterField && typeof clusterField === "object") {
            nsClusterId = (clusterField as Record<string, unknown>).id as string;
          }
          if (nsClusterId !== id) continue;
          const nsTags = ns.tags;
          const nsTagsArr: string[] = Array.isArray(nsTags) ? nsTags as string[] : [];
          const nsAF = extractAllAFFromTags(nsTagsArr);
          for (const af of nsAF) {
            if (!inheritedAF.includes(af)) inheritedAF.push(af);
          }
        }
        afSource = "aggregated-namespaces";
      } else if ((selectedType === "cloud_application" || selectedType === "cloud_application_instance") && allNsData?.records) {
        // Workload/Pod: inherit from namespace
        const nsNameField = rec.namespaceName;
        const nsNames: string[] = Array.isArray(nsNameField) ? nsNameField as string[] : nsNameField ? [nsNameField as string] : [];
        for (const nsRec of allNsData.records) {
          const ns = nsRec as Record<string, unknown>;
          const nsName = (ns["entity.name"] as string) || "";
          if (!nsNames.includes(nsName)) continue;
          const nsTags = ns.tags;
          const nsTagsArr: string[] = Array.isArray(nsTags) ? nsTags as string[] : [];
          const nsAF = extractAllAFFromTags(nsTagsArr);
          for (const af of nsAF) {
            if (!inheritedAF.includes(af)) inheritedAF.push(af);
          }
        }
        afSource = "inherited-namespace";
      } else if (selectedType === "cloud_application_namespace") {
        // Namespace: AF is direct only (it's the source of truth)
        afSource = "direct";
      } else if (selectedType === "kubernetes_node" && nodeAFData?.records) {
        // Node: aggregate AF from pods' namespaces
        for (const nodeRec of nodeAFData.records) {
          const nr = nodeRec as Record<string, unknown>;
          const nodeName = (nr.NodeName as string) || "";
          if (nodeName !== name) continue;
          const tag = (nr.tags as string) || "";
          if (!tag) continue;
          const afKeyIdx = tag.indexOf("AppFuncional_DatalakeInfo");
          if (afKeyIdx === -1) continue;
          const colonIndex = tag.indexOf(":", afKeyIdx + "AppFuncional_DatalakeInfo".length);
          if (colonIndex === -1) continue;
          const afValue = tag.substring(colonIndex + 1).trim();
          if (afValue && !inheritedAF.includes(afValue)) inheritedAF.push(afValue);
        }
        afSource = "aggregated-namespaces";
      } else if (isAppType && appAFData?.records) {
        // App types: inherit from called services
        for (const svcRec of appAFData.records) {
          const svc = svcRec as Record<string, unknown>;
          const appId = (svc.appId as string) || "";
          if (appId !== id) continue;
          const tag = (svc.tags as string) || "";
          if (!tag) continue;
          const afKeyIdx = tag.indexOf("AppFuncional_DatalakeInfo");
          if (afKeyIdx === -1) continue;
          const colonIndex = tag.indexOf(":", afKeyIdx + "AppFuncional_DatalakeInfo".length);
          if (colonIndex === -1) continue;
          const afValue = tag.substring(colonIndex + 1).trim();
          if (afValue && !inheritedAF.includes(afValue)) inheritedAF.push(afValue);
        }
        afSource = "inherited-service";
      }

      const afCount = directAF.length + inheritedAF.length;
      rows.push({ id, name, directAF, inheritedAF, afSource, afCount });
    }

    // Add rows for IDs that were not found
    const foundIds = new Set(rows.map((r) => r.id));
    for (const reqId of entityIds) {
      if (!foundIds.has(reqId) && validateEntityId(reqId)) {
        rows.push({ id: reqId, name: "(No encontrada)", directAF: [], inheritedAF: [], afSource: "none", afCount: 0 });
      }
    }

    return rows;
  }, [bulkData, allNsData, appAFData, nodeAFData, searchTriggered, selectedType, entityIds, isAppType]);

  const isLoading = bulkLoading || (isAppType && appAFLoading);

  /* ─── Export to CSV ─── */
  const handleExport = useCallback(() => {
    if (results.length === 0) return;
    const header = "ID;Nombre;AF Directa;AF Heredada;Nº Tags";
    const lines = results.map((r) =>
      `${r.id};${r.name};${r.directAF.join(", ")};${r.inheritedAF.join(", ")};${r.afCount}`
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bulk_af_${selectedType}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [results, selectedType]);

  /* ─── DataTable columns ─── */
  const tableColumns = useMemo<DataTableColumnDef<BulkResultRow>[]>(() => {
    const tone = selectedType && isK8sEntityType(selectedType) ? "k8s" : "non-k8s";
    return [
      {
        id: "name",
        header: "Nombre",
        accessor: "name",
        cell: ({ value }) => <span style={{ fontSize: 13 }}>{String(value)}</span>,
      },
      {
        id: "id",
        header: "ID",
        accessor: "id",
        cell: ({ value }) => <span style={{ fontSize: 12 }}>{String(value)}</span>,
      },
      {
        id: "afCount",
        header: "Nº Tags",
        accessor: "afCount",
        cell: ({ value }) => <span style={{ fontSize: 12, fontWeight: 600 }}>{String(value)}</span>,
      },
      {
        id: "af",
        header: "AF",
        accessor: "directAF",
        cell: ({ rowData }) => {
          const allAF = [...rowData.directAF, ...rowData.inheritedAF];
          if (allAF.length === 0) {
            return <AFBadge af={null} source="none" tone={tone} />;
          }
          // If only direct AF
          if (rowData.inheritedAF.length === 0) {
            return <AFBadge af={rowData.directAF} source="direct" tone={tone} />;
          }
          // If only inherited AF
          if (rowData.directAF.length === 0) {
            return <AFBadge af={rowData.inheritedAF} source={rowData.afSource} tone={tone} />;
          }
          // Both direct and inherited
          return (
            <Flex gap={4} style={{ flexWrap: "wrap" }}>
              <AFBadge af={rowData.directAF} source="direct" tone={tone} />
              <AFBadge af={rowData.inheritedAF} source={rowData.afSource} tone={tone} />
            </Flex>
          );
        },
      },
    ];
  }, [selectedType]);

  return (
    <Flex flexDirection="column" gap={0}>
      {/* ── Hero banner ── */}
      <Flex
        flexDirection="column"
        gap={4}
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #0a1a3e 40%, #0D47A1 80%, #1976D2 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          paddingTop: 28,
          paddingBottom: 28,
          paddingLeft: 36,
          paddingRight: 36,
        }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(25, 118, 210, 0.2)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -25, right: 80, width: 90, height: 90, borderRadius: "50%", background: "rgba(13, 71, 161, 0.25)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 10, right: 180, width: 50, height: 50, borderRadius: "50%", background: "rgba(25, 118, 210, 0.12)", pointerEvents: "none" }} />

        <Flex alignItems="center" gap={12}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
          >
            <DocumentIcon style={{ fontSize: "22px", color: "#64B5F6" }} />
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Heading level={2} style={{ color: "#fff", margin: 0 }}>
              Búsqueda Masiva
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Sube un fichero .txt con IDs de entidades para resolver su AF en bloque
            </Text>
          </Flex>
        </Flex>
      </Flex>

      {/* ── Content area ── */}
      <Flex flexDirection="column" gap={20} style={{ padding: "24px 36px", width: "100%", boxSizing: "border-box" }}>
        {/* Step 1: Select type */}
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>Tipo de entidad</Text>
          <Select
            value={selectedType}
            onChange={(val) => {
              setSelectedType(val as EntityType);
              setSearchTriggered(false);
            }}
          >
            <Select.Trigger width="400px" style={{ background: "rgba(13, 71, 161, 0.06)", borderColor: "rgba(13, 71, 161, 0.25)" }} placeholder="Selecciona tipo..." />
            <Select.Content>
              {ALL_SEARCHABLE_TYPES.map((t) => (
                <Select.Option key={t} value={t}>
                  {ENTITY_TYPE_LABELS[t]}
                </Select.Option>
              ))}
            </Select.Content>
          </Select>
        </Flex>

        {/* Step 2: Upload file */}
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>Fichero de IDs (.txt)</Text>
          <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
            Un ID por línea. Formato: TIPO-HEXID (ej: HOST-1234ABCD5678EF90). Máximo {MAX_IDS} entidades.
          </Text>
          <Flex alignItems="center" gap={12} paddingTop={4}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #1976D2",
                color: "#1976D2",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <UploadIcon />
              Seleccionar archivo
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            {fileName && (
              <Text style={{ fontSize: 12 }}>
                {fileName} — {entityIds.length} IDs válidos
              </Text>
            )}
          </Flex>
        </Flex>

        {/* Search button */}
        <Flex alignItems="center" gap={12} paddingTop={4}>
          <Button
            variant="emphasized"
            onClick={handleSearch}
            disabled={!selectedType || entityIds.length === 0}
          >
            <Button.Prefix><MagnifyingGlassIcon /></Button.Prefix>
            Buscar AF ({entityIds.length} entidades)
          </Button>
          {results.length > 0 && (
            <Button variant="default" onClick={handleExport}>
              Exportar CSV
            </Button>
          )}
        </Flex>

        {/* ── Results ── */}
        {isLoading && (
          <Flex padding={16}>
            <Text>Buscando entidades y resolviendo AF...</Text>
          </Flex>
        )}

        {searchTriggered && !isLoading && results.length > 0 && (
          <Flex flexDirection="column" gap={8} paddingTop={8}>
            <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>
              Resultados ({results.length} entidades)
            </Text>
            <div style={{ width: "100%" }}>
              <DataTable
                data={results}
                columns={tableColumns}
                sortable
                resizable
                fullWidth
              >
                <DataTable.Pagination defaultPageSize={25} />
              </DataTable>
            </div>
          </Flex>
        )}

        {searchTriggered && !isLoading && results.length === 0 && (
          <Flex padding={16}>
            <Text>No se encontraron resultados para los IDs proporcionados.</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
