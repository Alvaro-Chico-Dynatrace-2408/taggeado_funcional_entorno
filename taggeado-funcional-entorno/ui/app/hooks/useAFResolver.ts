import { useState, useEffect, useMemo } from "react";
import { useDql } from "@dynatrace-sdk/react-hooks";
import type { EntityType, AFResolution } from "../utils/entity-types";
import { extractAllAFFromTags, isK8sEntityType } from "../utils/entity-types";
import {
  buildEntityQuery,
  buildNamespaceByName,
  buildWorkloadById,
  buildHostById,
  buildProcessGroupById,
} from "../utils/dql-queries";
import { validateEntityId } from "../utils/validators";

// Same query as KubernetesView main tab — fetch ALL namespaces with AF + their cluster
const ALL_NS_AF_QUERY = `fetch dt.entity.cloud_application_namespace, from:now()-7d
| fieldsAdd tags, clustered_by[dt.entity.kubernetes_cluster]
| filter contains(toString(tags), "AppFuncional_DatalakeInfo")
| limit 5000`;

type ResolverStep = "entity" | "parent" | "grandparent" | "done";

/**
 * Hook that resolves the AF (AppFuncional_DatalakeInfo) tag for any entity.
 * Uses fast relationship field traversal (same approach as KubernetesView).
 *
 * Resolution chains:
 * - K8s Cluster: aggregates AF from namespaces via clustered_by field
 * - K8s Workload → namespaceName field → fetch namespace by name
 * - K8s Pod → belongs_to workload → namespaceName → namespace
 * - Non-K8s ProcessGroup → runs_on host → direct tags
 * - Non-K8s Service → runs_on PG → runs_on host → tags
 * - Host/Namespace: direct tag
 */
export function useAFResolver(entityId: string | null, entityType: EntityType | null): AFResolution {
  const [step, setStep] = useState<ResolverStep>("entity");
  const [parentQuery, setParentQuery] = useState<string | null>(null);
  const [grandparentQuery, setGrandparentQuery] = useState<string | null>(null);
  const [result, setResult] = useState<AFResolution>({
    af: null,
    loading: true,
    error: null,
    source: "none",
  });

  const isValid = entityId && entityType && validateEntityId(entityId);
  const isCluster = entityType === "kubernetes_cluster";

  // For clusters: fire the SAME query as main tab immediately (no sequential wait)
  const { data: allNsData, error: allNsError } = useDql(
    { query: ALL_NS_AF_QUERY, maxResultRecords: 5000 },
    { enabled: !!isValid && isCluster }
  );

  // Step 1: Fetch the entity itself (includes relationship fields per type) — NOT for clusters
  const entityQuery = isValid && !isCluster ? buildEntityQuery(entityType, entityId) : null;
  const { data: entityData, error: entityError } = useDql(
    entityQuery ? { query: entityQuery } : { query: "" },
    { enabled: !!entityQuery && step === "entity" }
  );

  // Step 2: Fetch parent (namespace by name, workload by ID, host by ID, PG by ID)
  const { data: parentData, error: parentError } = useDql(
    parentQuery ? { query: parentQuery } : { query: "" },
    { enabled: !!parentQuery && step === "parent" }
  );

  // Step 3: Fetch grandparent (namespace by name from workload's namespaceName, or host from PG)
  const { data: grandparentData, error: grandparentError } = useDql(
    grandparentQuery ? { query: grandparentQuery } : { query: "" },
    { enabled: !!grandparentQuery && step === "grandparent" }
  );

  // Helper: extract first entity ID from a relationship field value
  const extractRelId = (field: unknown): string | null => {
    if (typeof field === "string" && validateEntityId(field)) return field;
    if (Array.isArray(field)) {
      for (const item of field) {
        if (typeof item === "string" && validateEntityId(item)) return item;
        if (item && typeof item === "object") {
          const id = (item as Record<string, unknown>).id;
          if (typeof id === "string" && validateEntityId(id)) return id;
        }
      }
    }
    if (field && typeof field === "object" && !Array.isArray(field)) {
      const id = (field as Record<string, unknown>).id;
      if (typeof id === "string" && validateEntityId(id)) return id;
    }
    return null;
  };

  // --- Cluster AF: process allNsData exactly like KubernetesView does (filter by cluster in JS) ---
  const clusterAF = useMemo<string[] | null>(() => {
    if (!isCluster || !allNsData?.records) return null;
    const afs: string[] = [];
    for (const record of allNsData.records) {
      const rec = record as Record<string, unknown>;
      // Extract cluster ID from the clustered_by field (same logic as KubernetesView)
      let clusterField: unknown = rec["clustered_by[dt.entity.kubernetes_cluster]"];
      if (clusterField === undefined || clusterField === null) {
        for (const key of Object.keys(rec)) {
          if (key.toLowerCase().includes("cluster")) {
            clusterField = rec[key];
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
      if (nsClusterId !== entityId) continue;

      // This namespace belongs to our cluster — extract AF values
      const tags = (rec.tags as string[]) || [];
      const nsAFs = extractAllAFFromTags(tags);
      for (const af of nsAFs) {
        if (!afs.includes(af)) afs.push(af);
      }
    }
    return afs;
  }, [allNsData, isCluster, entityId]);

  // Set cluster result when data arrives
  useEffect(() => {
    if (!isCluster) return;
    if (allNsError) {
      setResult({ af: null, loading: false, error: allNsError as Error, source: "none" });
      return;
    }
    if (clusterAF === null) return; // still loading
    if (clusterAF.length > 0) {
      const nsCount = allNsData?.records?.length || 0;
      setResult({
        af: clusterAF,
        loading: false,
        error: null,
        source: "aggregated-namespaces",
        sourceEntityName: `${nsCount} namespaces`,
      });
    } else {
      setResult({ af: null, loading: false, error: null, source: "none" });
    }
  }, [clusterAF, allNsError, isCluster, allNsData]);

  // Process entity data — extract relationship fields and route to next step (non-cluster)
  useEffect(() => {
    if (isCluster) return; // clusters handled above
    if (!isValid) {
      setResult({ af: null, loading: false, error: new Error("Invalid entity"), source: "none" });
      return;
    }
    if (entityError) {
      setResult({ af: null, loading: false, error: entityError as Error, source: "none" });
      return;
    }
    if (!entityData?.records?.length) return;

    const record = entityData.records[0] as Record<string, unknown>;
    const tags = (record.tags as string[]) || [];
    const allAF = extractAllAFFromTags(tags);

    if (allAF.length > 0) {
      setResult({ af: allAF, loading: false, error: null, source: "direct" });
      setStep("done");
      return;
    }

    // No direct tag — use relationship fields to traverse
    if (entityType === "cloud_application") {
      // Workload: use namespaceName field to fetch namespace by name
      const nsName = record.namespaceName;
      const nsNameStr = Array.isArray(nsName) ? (nsName[0] as string) : (nsName as string);
      if (nsNameStr) {
        setParentQuery(buildNamespaceByName(nsNameStr));
        setStep("parent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
    } else if (entityType === "cloud_application_instance") {
      // Pod: use belongs_to field to get workload ID, then fetch workload (which has namespaceName)
      const wlField = record["belongs_to[dt.entity.cloud_application]"];
      const wlId = extractRelId(wlField);
      if (wlId) {
        setParentQuery(buildWorkloadById(wlId));
        setStep("parent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
    } else if (entityType === "process_group") {
      // PG: use runs_on field to get host ID
      const hostField = record["runs_on[dt.entity.host]"];
      const hostId = extractRelId(hostField);
      if (hostId) {
        setParentQuery(buildHostById(hostId));
        setStep("parent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
    } else if (entityType === "service") {
      // Service: use runs_on field to get PG ID
      const pgField = record["runs_on[dt.entity.process_group]"];
      const pgId = extractRelId(pgField);
      if (pgId) {
        setParentQuery(buildProcessGroupById(pgId));
        setStep("parent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
    } else {
      setResult({ af: null, loading: false, error: null, source: "none" });
      setStep("done");
    }
  }, [entityData, entityError, entityId, entityType, isValid, isCluster]);

  // Process parent data
  useEffect(() => {
    if (step !== "parent") return;
    if (parentError) {
      setResult({ af: null, loading: false, error: parentError as Error, source: "none" });
      setStep("done");
      return;
    }
    if (!parentData?.records?.length) return;

    const record = parentData.records[0] as Record<string, unknown>;
    const tags = (record.tags as string[]) || [];
    const parentName = (record["entity.name"] as string) || "";
    const allAF = extractAllAFFromTags(tags);

    if (allAF.length > 0) {
      const source = isK8sEntityType(entityType!) ? "inherited-namespace" : "inherited-host";
      setResult({ af: allAF, loading: false, error: null, source, sourceEntityName: parentName });
      setStep("done");
      return;
    }

    // Pod case: parent is workload without AF → use its namespaceName to go to namespace
    if (entityType === "cloud_application_instance") {
      const nsName = record.namespaceName;
      const nsNameStr = Array.isArray(nsName) ? (nsName[0] as string) : (nsName as string);
      if (nsNameStr) {
        setGrandparentQuery(buildNamespaceByName(nsNameStr));
        setStep("grandparent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
      return;
    }

    // Service case: parent is PG without AF → use its runs_on to go to host
    if (entityType === "service") {
      const hostField = record["runs_on[dt.entity.host]"];
      const hostId = extractRelId(hostField);
      if (hostId) {
        setGrandparentQuery(buildHostById(hostId));
        setStep("grandparent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
      return;
    }

    // PG/workload without parent tag → no AF
    setResult({ af: null, loading: false, error: null, source: "none" });
    setStep("done");
  }, [parentData, parentError, step, entityType]);

  // Process grandparent data (namespace for pod, host for service)
  useEffect(() => {
    if (step !== "grandparent") return;
    if (grandparentError) {
      setResult({ af: null, loading: false, error: grandparentError as Error, source: "none" });
      setStep("done");
      return;
    }
    if (!grandparentData?.records?.length) return;

    const record = grandparentData.records[0] as Record<string, unknown>;
    const tags = (record.tags as string[]) || [];
    const grandparentName = (record["entity.name"] as string) || "";
    const allAF = extractAllAFFromTags(tags);

    if (allAF.length > 0) {
      const source = isK8sEntityType(entityType!) ? "inherited-namespace" : "inherited-host";
      setResult({ af: allAF, loading: false, error: null, source, sourceEntityName: grandparentName });
    } else {
      setResult({ af: null, loading: false, error: null, source: "none" });
    }
    setStep("done");
  }, [grandparentData, grandparentError, step, entityType]);

  // Reset when entityId changes
  useEffect(() => {
    setStep("entity");
    setParentQuery(null);
    setGrandparentQuery(null);
    setResult({ af: null, loading: true, error: null, source: "none" });
  }, [entityId, entityType]);

  return result;
}
