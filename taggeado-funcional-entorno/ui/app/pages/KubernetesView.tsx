import React, { useState, useMemo, useCallback } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { TextInput } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import { extractAllAFFromTags } from "../utils/entity-types";
import type { EntityType } from "../utils/entity-types";
import { buildSearchByName } from "../utils/dql-queries";

// --- Cluster AF aggregation queries (proven working) ---
const CLUSTERS_QUERY = `fetch dt.entity.kubernetes_cluster, from:now()-7d
| fieldsAdd entity.name, tags`;

const ALL_NS_AF_QUERY = `fetch dt.entity.cloud_application_namespace, from:now()-7d
| fieldsAdd tags, clustered_by[dt.entity.kubernetes_cluster]
| filter contains(toString(tags), "AppFuncional_DatalakeInfo")
| limit 5000`;

type K8sEntityType = "kubernetes_cluster" | "cloud_application_namespace" | "cloud_application" | "cloud_application_instance";

const K8S_TYPE_OPTIONS: { type: K8sEntityType; label: string; icon: string; desc: string }[] = [
  { type: "kubernetes_cluster", label: "Cluster", icon: "☸️", desc: "Clusters con AF agregada de namespaces" },
  { type: "cloud_application_namespace", label: "Namespace", icon: "📦", desc: "Namespaces con tag AF directa" },
  { type: "cloud_application", label: "Workload", icon: "⚙️", desc: "Workloads (hereda AF del namespace)" },
  { type: "cloud_application_instance", label: "Pod", icon: "🔹", desc: "Pods (hereda AF del namespace)" },
];

export const KubernetesView = () => {
  const [selectedType, setSelectedType] = useState<K8sEntityType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // Debounce search
  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    const timer = setTimeout(() => {
      if (val.trim().length >= 2) setDebouncedTerm(val.trim());
      else setDebouncedTerm("");
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // --- Search query (for namespace/workload/pod) ---
  const searchQuery = useMemo(() => {
    if (!selectedType || selectedType === "kubernetes_cluster" || !debouncedTerm) return null;
    return buildSearchByName(selectedType, debouncedTerm, 100);
  }, [selectedType, debouncedTerm]);

  const { data: searchData, isLoading: searchLoading } = useDql(
    searchQuery ? { query: searchQuery } : { query: "" },
    { enabled: !!searchQuery }
  );

  // --- Cluster queries (special: fetch all + aggregate AF) ---
  const showClusters = selectedType === "kubernetes_cluster";

  const { data: clustersData, isLoading: clustersLoading } = useDql(
    { query: CLUSTERS_QUERY },
    { enabled: showClusters }
  );

  const { data: allNsData } = useDql(
    { query: ALL_NS_AF_QUERY, maxResultRecords: 5000 },
    { enabled: showClusters }
  );

  // Build cluster → AF map
  const clusterAFMap = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    if (!allNsData?.records) return map;

    for (const record of allNsData.records) {
      const rec = record as Record<string, unknown>;
      const tags = rec.tags;
      let clusterField: unknown = rec["clustered_by[dt.entity.kubernetes_cluster]"];
      if (clusterField === undefined || clusterField === null) {
        for (const key of Object.keys(rec)) {
          if (key.toLowerCase().includes("cluster")) {
            clusterField = rec[key];
            if (clusterField !== undefined && clusterField !== null) break;
          }
        }
      }

      let clusterId: string | null = null;
      if (typeof clusterField === "string") clusterId = clusterField;
      else if (Array.isArray(clusterField) && clusterField.length > 0) {
        const first = clusterField[0];
        if (typeof first === "string") clusterId = first;
        else if (first && typeof first === "object") clusterId = (first as Record<string, unknown>).id as string;
      } else if (clusterField && typeof clusterField === "object") {
        const obj = clusterField as Record<string, unknown>;
        if (typeof obj.id === "string") clusterId = obj.id;
      }
      if (!clusterId) continue;

      const tagsArray: string[] = Array.isArray(tags) ? tags as string[] : [];
      for (const tag of tagsArray) {
        if (typeof tag !== "string") continue;
        const afKeyIdx = tag.indexOf("AppFuncional_DatalakeInfo");
        if (afKeyIdx === -1) continue;
        const colonIndex = tag.indexOf(":", afKeyIdx + "AppFuncional_DatalakeInfo".length);
        if (colonIndex === -1) continue;
        const afValue = tag.substring(colonIndex + 1).trim();
        if (!afValue) continue;
        if (!map[clusterId]) map[clusterId] = [];
        if (!map[clusterId].includes(afValue)) map[clusterId].push(afValue);
      }
    }
    return map;
  }, [allNsData]);

  // Filter clusters by search term (client-side filter)
  const clusterRows: EntityRow[] = useMemo(() => {
    if (!clustersData?.records) return [];
    return clustersData.records
      .map((r) => {
        const rec = r as Record<string, unknown>;
        const id = rec.id as string;
        const name = (rec["entity.name"] as string) || "";
        const row: EntityRow = {
          id,
          name,
          type: "kubernetes_cluster",
          tags: (rec.tags as string[]) || [],
        };
        if (clusterAFMap[id]) {
          row.resolvedAF = clusterAFMap[id];
          row.afSource = "direct";
        }
        return row;
      })
      .filter((row) => !debouncedTerm || row.name.toLowerCase().includes(debouncedTerm.toLowerCase()));
  }, [clustersData, clusterAFMap, debouncedTerm]);

  // Search results rows
  const searchRows: EntityRow[] = useMemo(() => {
    if (!searchData?.records || !selectedType) return [];
    return searchData.records.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        id: rec.id as string,
        name: (rec["entity.name"] as string) || "",
        type: selectedType as EntityType,
        tags: (rec.tags as string[]) || [],
      };
    });
  }, [searchData, selectedType]);

  const rows = showClusters ? clusterRows : searchRows;
  const isLoading = showClusters ? clustersLoading : searchLoading;

  return (
    <Flex flexDirection="column" gap={0}>
      {/* ── Hero banner (DQL Cost style) ── */}
      <Flex
        flexDirection="column"
        gap={16}
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #1a0a3e 40%, #6b2fff 80%, #9c6bff 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          paddingTop: 28,
          paddingBottom: 28,
          paddingLeft: 36,
          paddingRight: 36,
        }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(156, 107, 255, 0.2)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -25, right: 80, width: 90, height: 90, borderRadius: "50%", background: "rgba(107, 47, 255, 0.25)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 10, right: 180, width: 50, height: 50, borderRadius: "50%", background: "rgba(156, 107, 255, 0.12)", pointerEvents: "none" }} />

        <Flex alignItems="center" gap={12}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
          >
            <Text style={{ fontSize: "22px" }}>☸️</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Heading level={2} style={{ color: "#fff", margin: 0 }}>
              Kubernetes
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Selecciona un tipo de entidad y busca por nombre
            </Text>
          </Flex>
        </Flex>

        {/* Entity type selector inside banner */}
        <Flex gap={8} style={{ flexWrap: "wrap", marginTop: 4 }}>
          {K8S_TYPE_OPTIONS.map((opt) => (
            <Flex
              key={opt.type}
              alignItems="center"
              gap={8}
              onClick={() => { setSelectedType(opt.type); setSearchTerm(""); setDebouncedTerm(""); }}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.15s",
                border: selectedType === opt.type ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)",
                background: selectedType === opt.type ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
              }}
            >
              <Text style={{ fontSize: "16px" }}>{opt.icon}</Text>
              <Text style={{ fontSize: "13px", fontWeight: selectedType === opt.type ? 700 : 400, color: "#fff" }}>
                {opt.label}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Flex>

      {/* ── Content area ── */}
      <Flex flexDirection="column" gap={20} style={{ padding: "24px 36px" }}>
        {/* Search bar */}
        {selectedType && (
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={12} style={{ maxWidth: 500 }}>
              <TextInput
                value={searchTerm}
                onChange={(val) => handleSearchChange(val ?? "")}
                placeholder={`Buscar ${K8S_TYPE_OPTIONS.find((o) => o.type === selectedType)?.label || ""} por nombre...`}
              />
            </Flex>
            <Text style={{ fontSize: "12px", opacity: 0.5 }}>
              {showClusters
                ? "Se muestran todos los clusters. Filtra por nombre si lo deseas."
                : "Escribe al menos 2 caracteres para buscar."}
            </Text>
          </Flex>
        )}

        {/* Results table */}
        {selectedType && (showClusters || debouncedTerm) && (
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontSize: "13px", fontWeight: 600 }}>
              {rows.length} resultado{rows.length !== 1 ? "s" : ""}
              {isLoading ? " (cargando...)" : ""}
            </Text>
            <EntityTable data={rows} loading={isLoading} showTypeColumn={false} />
          </Flex>
        )}

        {/* Empty state */}
        {!selectedType && (
          <Flex alignItems="center" justifyContent="center" style={{ padding: "48px", opacity: 0.5 }}>
            <Text>Selecciona un tipo de entidad en el panel superior</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
