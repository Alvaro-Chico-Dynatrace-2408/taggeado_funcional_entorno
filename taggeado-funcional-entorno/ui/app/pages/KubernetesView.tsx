import React, { useState, useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import { BreadcrumbNav, type Breadcrumb } from "../components/BreadcrumbNav";
import { extractAllAFFromTags } from "../utils/entity-types";
import {
  buildNamespacesFromCluster,
  buildWorkloadsFromNamespace,
  buildPodsFromWorkload,
} from "../utils/dql-queries";

type DrillLevel = "clusters" | "namespaces" | "workloads" | "pods";

interface Selection {
  clusterId?: string;
  clusterName?: string;
  namespaceId?: string;
  namespaceName?: string;
  namespaceAF?: string[];
  workloadId?: string;
  workloadName?: string;
}

// Query 1: Fetch clusters for display
const CLUSTERS_QUERY = `fetch dt.entity.kubernetes_cluster, from:now()-7d
| fieldsAdd entity.name, tags`;

// Query 2: Fetch namespaces with AF tags expanded + cluster reference
// fieldsAdd materializes clustered_by BEFORE expand so it survives
// Same approach as user's proven Notebooks DQL
const NS_AF_WITH_CLUSTER_QUERY = `fetch dt.entity.cloud_application_namespace, from:now()-7d
| fieldsAdd tags, clustered_by[dt.entity.kubernetes_cluster]
| expand tags
| filter contains(tags, "AppFuncional_DatalakeInfo")
| fields tags, clustered_by[dt.entity.kubernetes_cluster]
| limit 10000`;

export const KubernetesView = () => {
  const [level, setLevel] = useState<DrillLevel>("clusters");
  const [selection, setSelection] = useState<Selection>({});

  // Main query for non-cluster levels
  const drillQuery = useMemo(() => {
    switch (level) {
      case "namespaces":
        return selection.clusterId ? buildNamespacesFromCluster(selection.clusterId) : null;
      case "workloads":
        return selection.namespaceId ? buildWorkloadsFromNamespace(selection.namespaceId) : null;
      case "pods":
        return selection.workloadId ? buildPodsFromWorkload(selection.workloadId) : null;
      default:
        return null;
    }
  }, [level, selection]);

  const { data: drillData, isLoading: drillLoading } = useDql(
    drillQuery ? { query: drillQuery } : { query: "" },
    { enabled: !!drillQuery && level !== "clusters" }
  );

  // Query 1: Fetch clusters for display in table
  const { data: clustersData, isLoading: clustersLoading } = useDql(
    { query: CLUSTERS_QUERY },
    { enabled: level === "clusters" }
  );

  // Query 2: Fetch namespaces with AF tags + their cluster reference
  const { data: nsAfData } = useDql(
    { query: NS_AF_WITH_CLUSTER_QUERY },
    { enabled: level === "clusters" }
  );

  // Build map: clusterId → aggregated AF values from its namespaces
  // Each record has ONE expanded tag (string) and the cluster ID from clustered_by field
  const clusterAFMap = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    if (!nsAfData?.records) return map;

    for (const record of nsAfData.records) {
      const rec = record as Record<string, unknown>;
      const tag = rec.tags as string; // single string after expand
      // clustered_by field - may be string ID, EntityRef, or array
      const clusterField = rec["clustered_by[dt.entity.kubernetes_cluster]"];
      let clusterId: string | null = null;
      if (typeof clusterField === "string") {
        clusterId = clusterField;
      } else if (Array.isArray(clusterField) && clusterField.length > 0) {
        // Could be array of IDs or EntityRefs
        const first = clusterField[0];
        if (typeof first === "string") clusterId = first;
        else if (first && typeof first === "object") clusterId = (first as Record<string, unknown>).id as string;
      } else if (clusterField && typeof clusterField === "object") {
        const obj = clusterField as Record<string, unknown>;
        if (typeof obj.id === "string") clusterId = obj.id;
      }

      if (!clusterId || !tag) continue;

      // Extract AF value from the single tag string
      // Format: "AppFuncional_DatalakeInfo:value" or "[context]AppFuncional_DatalakeInfo:value"
      const afKeyIdx = tag.indexOf("AppFuncional_DatalakeInfo");
      if (afKeyIdx === -1) continue;
      const colonIndex = tag.indexOf(":", afKeyIdx + "AppFuncional_DatalakeInfo".length);
      if (colonIndex === -1) continue;
      const afValue = tag.substring(colonIndex + 1).trim();
      if (!afValue) continue;

      if (!map[clusterId]) map[clusterId] = [];
      if (!map[clusterId].includes(afValue)) {
        map[clusterId].push(afValue);
      }
    }
    return map;
  }, [nsAfData]);

  const entityType = useMemo(() => {
    switch (level) {
      case "clusters": return "kubernetes_cluster" as const;
      case "namespaces": return "cloud_application_namespace" as const;
      case "workloads": return "cloud_application" as const;
      case "pods": return "cloud_application_instance" as const;
    }
  }, [level]);

  const isLoading = level === "clusters" ? clustersLoading : drillLoading;
  const activeData = level === "clusters" ? clustersData : drillData;

  const rows: EntityRow[] = useMemo(() => {
    if (!activeData?.records) return [];
    return activeData.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const id = rec.id as string;
      const row: EntityRow = {
        id,
        name: (rec["entity.name"] as string) || "",
        type: entityType,
        tags: (rec.tags as string[]) || [],
      };

      // For clusters: inject aggregated AF from namespaces
      if (level === "clusters" && clusterAFMap[id]) {
        row.resolvedAF = clusterAFMap[id];
        row.afSource = "aggregated-namespaces";
      }

      // For workloads/pods: inherit AF from the selected namespace
      if ((level === "workloads" || level === "pods") && selection.namespaceAF && selection.namespaceAF.length > 0) {
        const directAF = extractAllAFFromTags(row.tags);
        if (directAF.length === 0) {
          row.resolvedAF = selection.namespaceAF;
          row.afSource = "inherited-namespace";
        }
      }

      return row;
    });
  }, [activeData, entityType, level, clusterAFMap, selection.namespaceAF]);

  const breadcrumbs: Breadcrumb[] = useMemo(() => {
    const items: Breadcrumb[] = [{ label: "Clusters", path: undefined }];

    if (level === "clusters") {
      items[0] = { label: "Clusters" };
      return items;
    }
    items[0] = { label: "Clusters", path: "/kubernetes" };

    if (level === "namespaces" || level === "workloads" || level === "pods") {
      items.push({
        label: selection.clusterName || "Namespaces",
        path: level === "namespaces" ? undefined : "/kubernetes",
      });
    }
    if (level === "workloads" || level === "pods") {
      items.push({
        label: selection.namespaceName || "Workloads",
      });
    }
    if (level === "pods") {
      items.push({
        label: selection.workloadName || "Pods",
      });
    }
    return items;
  }, [level, selection]);

  const handleRowClick = (entity: EntityRow) => {
    switch (level) {
      case "clusters":
        setSelection({ clusterId: entity.id, clusterName: entity.name });
        setLevel("namespaces");
        break;
      case "namespaces": {
        const nsAF = extractAllAFFromTags(entity.tags);
        setSelection((prev) => ({
          ...prev,
          namespaceId: entity.id,
          namespaceName: entity.name,
          namespaceAF: nsAF,
        }));
        setLevel("workloads");
        break;
      }
      case "workloads":
        setSelection((prev) => ({ ...prev, workloadId: entity.id, workloadName: entity.name }));
        setLevel("pods");
        break;
    }
  };

  const handleBreadcrumbReset = () => {
    setLevel("clusters");
    setSelection({});
  };

  return (
    <Flex flexDirection="column" padding={16} gap={16}>
      <Heading level={4}>Infraestructura Kubernetes</Heading>
      <BreadcrumbNav items={breadcrumbs} />

      {level !== "clusters" && (
        <button
          onClick={handleBreadcrumbReset}
          style={{
            alignSelf: "flex-start",
            padding: "4px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          ← Volver a Clusters
        </button>
      )}

      <Text>
        {level === "clusters" && "Selecciona un cluster para ver sus namespaces"}
        {level === "namespaces" && `Namespaces del cluster: ${selection.clusterName}`}
        {level === "workloads" && `Workloads del namespace: ${selection.namespaceName}`}
        {level === "pods" && `Pods del workload: ${selection.workloadName}`}
      </Text>

      <div onClick={(e) => {
        // Capture row clicks from the table links
        const target = e.target as HTMLElement;
        const link = target.closest("a");
        if (link && level !== "pods") {
          e.preventDefault();
          const row = rows.find((r) => link.href?.includes(r.id));
          if (row) handleRowClick(row);
        }
      }}>
        <EntityTable data={rows} loading={isLoading} showTypeColumn={false} />
      </div>
    </Flex>
  );
};
