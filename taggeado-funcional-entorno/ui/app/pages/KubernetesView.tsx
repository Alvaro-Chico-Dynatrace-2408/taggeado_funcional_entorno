import React, { useState, useMemo, useCallback, useRef } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { Select } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import type { EntityType } from "../utils/entity-types";
import { extractAllAFFromTags } from "../utils/entity-types";
import { buildSearchByName } from "../utils/dql-queries";

// --- Cluster AF aggregation query ---
const ALL_NS_AF_QUERY = `fetch dt.entity.cloud_application_namespace, from:now()-7d
| fieldsAdd tags, clustered_by[dt.entity.kubernetes_cluster]
| filter contains(toString(tags), "AppFuncional_DatalakeInfo")
| limit 5000`;

type K8sEntityType = "kubernetes_cluster" | "cloud_application_namespace" | "cloud_application" | "cloud_application_instance";

const K8S_TYPE_OPTIONS: { type: K8sEntityType; label: string }[] = [
  { type: "kubernetes_cluster", label: "Cluster" },
  { type: "cloud_application_namespace", label: "Namespace" },
  { type: "cloud_application", label: "Workload" },
  { type: "cloud_application_instance", label: "Pod" },
];

export const KubernetesView = () => {
  const [selectedType, setSelectedType] = useState<K8sEntityType | null>(null);
  const [filterTerm, setFilterTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Cache entity data so selected entities remain visible after search changes
  const entityCacheRef = useRef<Record<string, EntityRow>>({});

  // Debounce filter input from multi-select
  const handleFilterChange = useCallback((val: string) => {
    setFilterTerm(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(val.trim().length >= 2 ? val.trim() : "");
    }, 400);
  }, []);

  // --- Search query (same for all entity types including cluster) ---
  const searchQuery = useMemo(() => {
    if (!selectedType || !debouncedTerm) return null;
    return buildSearchByName(selectedType, debouncedTerm);
  }, [selectedType, debouncedTerm]);

  const { data: searchData, isLoading } = useDql(
    searchQuery ? { query: searchQuery, maxResultRecords: 5000 } : { query: "" },
    { enabled: !!searchQuery }
  );

  // --- Cluster AF aggregation (fetch all ns AF to build cluster map) ---
  const isCluster = selectedType === "kubernetes_cluster";

  const { data: allNsData } = useDql(
    { query: ALL_NS_AF_QUERY, maxResultRecords: 5000 },
    { enabled: isCluster }
  );

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

  // Build options from search results + cache them
  const searchOptions = useMemo(() => {
    if (!searchData?.records || !selectedType) return [];
    console.log(`[KubernetesView] API returned ${searchData.records.length} records`);
    const uniqueNames: string[] = [];
    for (const r of searchData.records) {
      const rec = r as Record<string, unknown>;
      const id = rec.id as string;
      const name = (rec["entity.name"] as string) || "";
      const tags = (rec.tags as string[]) || [];
      const row: EntityRow = { id, name, type: selectedType as EntityType, tags };
      if (isCluster && clusterAFMap[id]) {
        row.resolvedAF = clusterAFMap[id];
        row.afSource = "aggregated-namespaces";
      }
      entityCacheRef.current[id] = row;
      if (!uniqueNames.includes(name)) uniqueNames.push(name);
    }
    return uniqueNames.map((name) => ({ name }));
  }, [searchData, selectedType, isCluster, clusterAFMap]);

  // Get all entity IDs matching the selected name
  const selectedIds = useMemo<string[]>(() => {
    if (!selectedName) return [];
    return Object.keys(entityCacheRef.current).filter(
      (id) => entityCacheRef.current[id].name === selectedName
    );
  }, [selectedName, searchOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Workload → Namespace AF resolution (per workload, not shared) ---
  const isWorkload = selectedType === "cloud_application";

  // Step 1: Get namespaceName per workload ID (expand to get one row per workload-namespace pair)
  const workloadNsNameQuery = useMemo(() => {
    if (!isWorkload || selectedIds.length === 0) return null;
    const idFilter = selectedIds.length === 1
      ? `id == "${selectedIds[0]}"`
      : `in(id, array(${selectedIds.map((i) => `"${i}"`).join(", ")}))`;
    return `fetch dt.entity.cloud_application, from:now()-7d
| filter ${idFilter}
| fieldsAdd namespaceName
| expand namespaceName
| fields id, namespaceName
| limit 100000`;
  }, [isWorkload, selectedIds]);

  const { data: workloadNsNameData } = useDql(
    workloadNsNameQuery ? { query: workloadNsNameQuery, maxResultRecords: 50000 } : { query: "" },
    { enabled: !!workloadNsNameQuery }
  );

  // Build map: workloadId → namespaceName[], and collect all unique namespace names
  const { workloadToNsMap, allUniqueNsNames } = useMemo(() => {
    const map: Record<string, string[]> = {};
    const allNames: string[] = [];
    if (!workloadNsNameData?.records?.length) return { workloadToNsMap: map, allUniqueNsNames: allNames };
    for (const record of workloadNsNameData.records) {
      const rec = record as Record<string, unknown>;
      const wId = (rec.id as string) || "";
      const nsName = (rec.namespaceName as string) || "";
      if (!wId || !nsName) continue;
      if (!map[wId]) map[wId] = [];
      if (!map[wId].includes(nsName)) map[wId].push(nsName);
      if (!allNames.includes(nsName)) allNames.push(nsName);
    }
    console.log(`[KubernetesView] Step1: ${Object.keys(map).length} workload(s), ${allNames.length} unique namespace(s)`, map);
    return { workloadToNsMap: map, allUniqueNsNames: allNames };
  }, [workloadNsNameData]);

  // Step 2: Fetch ALL unique namespaces and their tags
  const nsTagsQuery = useMemo(() => {
    if (allUniqueNsNames.length === 0) return null;
    const namesList = allUniqueNsNames.map((n) => `"${n}"`).join(", ");
    return `fetch dt.entity.cloud_application_namespace, from:now()-7d
| filter in(entity.name, array(${namesList}))
| fieldsAdd tags
| expand tags
| fields entity.name, tags
| limit 100000`;
  }, [allUniqueNsNames]);

  const { data: nsTagsData } = useDql(
    nsTagsQuery ? { query: nsTagsQuery, maxResultRecords: 50000 } : { query: "" },
    { enabled: !!nsTagsQuery }
  );

  const workloadAFData = nsTagsData; // alias for loading state check

  // Build map: namespaceName → AF values[]
  const nsToAFMap = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    if (!nsTagsData?.records?.length) return map;
    for (const record of nsTagsData.records) {
      const rec = record as Record<string, unknown>;
      const nsName = (rec["entity.name"] as string) || "";
      if (!nsName) continue;
      if (!map[nsName]) map[nsName] = [];
      const tags = rec.tags;
      let tagStrings: string[] = [];
      if (typeof tags === "string") {
        tagStrings = [tags];
      } else if (Array.isArray(tags)) {
        tagStrings = tags.filter((t): t is string => typeof t === "string");
      } else {
        for (const key of Object.keys(rec)) {
          const val = rec[key];
          if (typeof val === "string" && val.includes("AppFuncional")) {
            tagStrings.push(val);
          }
        }
      }
      for (const tagStr of tagStrings) {
        if (!tagStr.includes("AppFuncional")) continue;
        const colonIndex = tagStr.indexOf(":", tagStr.indexOf("AppFuncional_DatalakeInfo"));
        if (colonIndex === -1) continue;
        const value = tagStr.substring(colonIndex + 1).trim();
        if (value && !map[nsName].includes(value)) map[nsName].push(value);
      }
    }
    console.log(`[KubernetesView] Step2 nsToAF map:`, map);
    return map;
  }, [nsTagsData]);

  // Build per-workload AF map: workloadId → AF values[]
  const workloadAFMap = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const [wId, nsNames] of Object.entries(workloadToNsMap)) {
      const afs: string[] = [];
      for (const nsName of nsNames) {
        const nsAFs = nsToAFMap[nsName] || [];
        for (const af of nsAFs) {
          if (!afs.includes(af)) afs.push(af);
        }
      }
      map[wId] = afs;
    }
    console.log(`[KubernetesView] Per-workload AF map:`, map);
    return map;
  }, [workloadToNsMap, nsToAFMap]);

  // Build table rows from all entities matching selected name
  const isResolvingWorkloadAF = isWorkload && selectedIds.length > 0 && !workloadAFData;
  const tableRows: EntityRow[] = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const rows: EntityRow[] = [];
    for (const id of selectedIds) {
      const row = entityCacheRef.current[id];
      if (!row) continue;

      // For workloads: inject per-workload AF from its own namespace(s)
      if (isWorkload && workloadAFMap[id] && workloadAFMap[id].length > 0) {
        row.resolvedAF = workloadAFMap[id];
        row.afSource = "inherited-namespace";
      }

      rows.push(row);
    }
    if (rows.length > 0) {
      console.log(`[KubernetesView] Selected "${selectedName}" - ${rows.length} entities`);
    }
    return rows;
  }, [selectedIds, selectedName, searchOptions, workloadAFMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when entity type changes
  const handleTypeChange = useCallback((val: unknown) => {
    setSelectedType(val as K8sEntityType | null);
    setFilterTerm("");
    setDebouncedTerm("");
    setSelectedName(null);
    entityCacheRef.current = {};
  }, []);

  return (
    <Flex flexDirection="column" gap={0}>
      {/* ── Hero banner ── */}
      <Flex
        flexDirection="column"
        gap={4}
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
      </Flex>

      {/* ── Content area ── */}
      <Flex flexDirection="column" gap={20} style={{ padding: "24px 36px", width: "100%", boxSizing: "border-box" }}>
        {/* Entity type dropdown */}
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>Tipo de entidad</Text>
          <Select value={selectedType} onChange={handleTypeChange}>
            <Select.Trigger width="400px" style={{ background: "rgba(107, 47, 255, 0.06)", borderColor: "rgba(107, 47, 255, 0.25)" }} />
            <Select.Content>
              {K8S_TYPE_OPTIONS.map((opt) => (
                <Select.Option key={opt.type} value={opt.type}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select.Content>
          </Select>
        </Flex>

        {/* Entity multi-select with autocomplete */}
        {selectedType && (
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>
              Buscar y seleccionar entidades
            </Text>
            {!filterTerm && (
              <Text style={{ fontSize: "12px", color: "#e53935", fontWeight: 500 }}>
                Introduce al menos dos letras para buscar
              </Text>
            )}
            {searchOptions.length > 0 && (
              <Text style={{ fontSize: "12px", fontWeight: 600, color: "#6b2fff" }}>
                {searchOptions.length} resultado{searchOptions.length !== 1 ? "s" : ""} encontrado{searchOptions.length !== 1 ? "s" : ""}
              </Text>
            )}
            <div style={{ width: "100%", display: "grid" }}>
              <Select
                value={selectedName}
                onChange={(val) => { setSelectedName(prev => prev === val ? null : (val as string)); }}
              >
                <Select.Trigger width="full" style={{ background: "rgba(107, 47, 255, 0.06)", borderColor: "rgba(107, 47, 255, 0.25)" }} />
                <Select.Filter
                  disableFiltering
                  value={filterTerm}
                  onChange={handleFilterChange}
                />
                <Select.Content>
                  {isLoading && (
                    <Select.Option value="__loading" disabled>
                      Buscando...
                    </Select.Option>
                  )}
                  {!isLoading && debouncedTerm && searchOptions.length === 0 && (
                    <Select.Option value="__empty" disabled>
                      Sin resultados
                    </Select.Option>
                  )}
                  {!debouncedTerm && !isLoading && (
                    <Select.Option value="__hint" disabled>
                      Escribe al menos 2 caracteres...
                    </Select.Option>
                  )}
                  {searchOptions.map((opt) => (
                    <Select.Option key={opt.name} value={opt.name}>
                      {opt.name}
                    </Select.Option>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Text style={{ fontSize: "12px", opacity: 0.5 }}>
              Escribe para buscar y selecciona una entidad.
            </Text>
          </Flex>
        )}

        {/* Results table */}
        {tableRows.length > 0 && (
          <Flex flexDirection="column" gap={8} style={{ width: "100%", overflow: "auto" }}>
            <Text style={{ fontSize: "13px", fontWeight: 600 }}>
              {tableRows.length} entidad{tableRows.length !== 1 ? "es" : ""} con nombre &quot;{selectedName}&quot; — {isResolvingWorkloadAF ? "resolviendo AF..." : (() => {
                const row = tableRows[0];
                const afs = row.resolvedAF || extractAllAFFromTags(row.tags);
                return `${afs.length} tag${afs.length !== 1 ? "s" : ""}`;
              })()}
            </Text>
            <EntityTable data={tableRows} loading={!!isResolvingWorkloadAF} showTypeColumn={false} />
          </Flex>
        )}

        {/* Empty state */}
        {!selectedType && (
          <Flex alignItems="center" justifyContent="center" style={{ padding: "48px", opacity: 0.5 }}>
            <Text>Selecciona un tipo de entidad para empezar</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
