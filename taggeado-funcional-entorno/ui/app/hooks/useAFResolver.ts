import { useState, useEffect, useCallback } from "react";
import { useDql } from "@dynatrace-sdk/react-hooks";
import type { EntityType, AFResolution } from "../utils/entity-types";
import { extractAFFromTags, extractAllAFFromTags, isK8sEntityType } from "../utils/entity-types";
import {
  buildEntityQuery,
  buildNamespaceFromWorkload,
  buildWorkloadFromPod,
  buildHostFromProcessGroup,
  buildProcessGroupFromService,
  buildNamespacesWithAFFromCluster,
} from "../utils/dql-queries";
import { validateEntityId } from "../utils/validators";

type ResolverStep = "entity" | "parent" | "grandparent" | "children" | "done";

/**
 * Hook that resolves the AF (AppFuncional_DatalakeInfo) tag for any entity.
 * Traverses relationships if the entity doesn't have the tag directly.
 *
 * Resolution chains:
 * - K8s Cluster: aggregates ALL AF tags from ALL its namespaces
 * - K8s Workload → Namespace (AF tag)
 * - K8s Pod → Workload → Namespace (AF tag)
 * - Non-K8s Service → ProcessGroup → Host (AF tag)
 * - Non-K8s ProcessGroup → Host (AF tag)
 * - Host/Namespace: direct tag
 */
export function useAFResolver(entityId: string | null, entityType: EntityType | null): AFResolution {
  const [step, setStep] = useState<ResolverStep>("entity");
  const [parentQuery, setParentQuery] = useState<string | null>(null);
  const [grandparentQuery, setGrandparentQuery] = useState<string | null>(null);
  const [childrenQuery, setChildrenQuery] = useState<string | null>(null);
  const [result, setResult] = useState<AFResolution>({
    af: null,
    loading: true,
    error: null,
    source: "none",
  });

  const isValid = entityId && entityType && validateEntityId(entityId);

  // Step 1: Fetch the entity itself
  const entityQuery = isValid ? buildEntityQuery(entityType, entityId) : null;
  const { data: entityData, error: entityError } = useDql(
    entityQuery ? { query: entityQuery } : { query: "" },
    { enabled: !!entityQuery && step === "entity" }
  );

  // Step 2: Fetch parent if needed (workload→ns, pod→wl, pg→host, service→pg)
  const { data: parentData, error: parentError } = useDql(
    parentQuery ? { query: parentQuery } : { query: "" },
    { enabled: !!parentQuery && step === "parent" }
  );

  // Step 3: Fetch grandparent if needed (pod → workload → namespace, service → pg → host)
  const { data: grandparentData, error: grandparentError } = useDql(
    grandparentQuery ? { query: grandparentQuery } : { query: "" },
    { enabled: !!grandparentQuery && step === "grandparent" }
  );

  // Step 4: Fetch children for aggregation (cluster → namespaces)
  const { data: childrenData, error: childrenError } = useDql(
    childrenQuery ? { query: childrenQuery } : { query: "" },
    { enabled: !!childrenQuery && step === "children" }
  );

  // Process entity data
  useEffect(() => {
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

    // No direct tag — determine traversal strategy
    if (entityType === "kubernetes_cluster") {
      // Cluster: aggregate AF from ALL namespaces
      setChildrenQuery(buildNamespacesWithAFFromCluster(entityId));
      setStep("children");
    } else if (entityType === "cloud_application") {
      setParentQuery(buildNamespaceFromWorkload(entityId));
      setStep("parent");
    } else if (entityType === "cloud_application_instance") {
      setParentQuery(buildWorkloadFromPod(entityId));
      setStep("parent");
    } else if (entityType === "process_group") {
      setParentQuery(buildHostFromProcessGroup(entityId));
      setStep("parent");
    } else if (entityType === "service") {
      setParentQuery(buildProcessGroupFromService(entityId));
      setStep("parent");
    } else {
      // namespace or host without direct tag
      setResult({ af: null, loading: false, error: null, source: "none" });
      setStep("done");
    }
  }, [entityData, entityError, entityId, entityType, isValid]);

  // Process children data (cluster → namespaces aggregation)
  useEffect(() => {
    if (step !== "children") return;
    if (childrenError) {
      setResult({ af: null, loading: false, error: childrenError as Error, source: "none" });
      setStep("done");
      return;
    }
    if (!childrenData?.records) return;

    // Aggregate all unique AF values from all namespaces
    const allAFs: string[] = [];
    for (const record of childrenData.records) {
      const rec = record as Record<string, unknown>;
      const tags = (rec.tags as string[]) || [];
      const nsAFs = extractAllAFFromTags(tags);
      for (const af of nsAFs) {
        if (!allAFs.includes(af)) {
          allAFs.push(af);
        }
      }
    }

    if (allAFs.length > 0) {
      setResult({
        af: allAFs,
        loading: false,
        error: null,
        source: "aggregated-namespaces",
        sourceEntityName: `${childrenData.records.length} namespaces`,
      });
    } else {
      setResult({ af: null, loading: false, error: null, source: "none" });
    }
    setStep("done");
  }, [childrenData, childrenError, step]);

  // Process parent data
  useEffect(() => {
    if (step !== "parent" || !parentData?.records?.length) return;

    const record = parentData.records[0] as Record<string, unknown>;
    // Support both direct fields and lookup fields (from DQL lookup queries)
    const tags = (record["lookup.tags"] as string[]) || (record.tags as string[]) || [];
    const parentName = (record["lookup.entity.name"] as string) || (record["entity.name"] as string) || "";
    const allAF = extractAllAFFromTags(tags);

    if (allAF.length > 0) {
      const source = isK8sEntityType(entityType!) ? "inherited-namespace" : "inherited-host";
      setResult({ af: allAF, loading: false, error: null, source, sourceEntityName: parentName });
      setStep("done");
      return;
    }

    // Pod case: parent is workload without AF → need to go to namespace (grandparent)
    if (entityType === "cloud_application_instance") {
      const workloadId = (record.id as string) || "";
      if (workloadId && validateEntityId(workloadId)) {
        setGrandparentQuery(buildNamespaceFromWorkload(workloadId));
        setStep("grandparent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
      return;
    }

    // Service case: parent is PG without AF → need to go to host (grandparent)
    if (entityType === "service") {
      const pgId = (record.id as string) || "";
      if (pgId && validateEntityId(pgId)) {
        setGrandparentQuery(buildHostFromProcessGroup(pgId));
        setStep("grandparent");
      } else {
        setResult({ af: null, loading: false, error: null, source: "none" });
        setStep("done");
      }
      return;
    }

    // PG without host tag → no AF
    setResult({ af: null, loading: false, error: null, source: "none" });
    setStep("done");
  }, [parentData, parentError, step, entityType]);

  // Process grandparent data
  useEffect(() => {
    if (step !== "grandparent" || !grandparentData?.records?.length) return;

    const record = grandparentData.records[0] as Record<string, unknown>;
    // Support both direct fields and lookup fields (from DQL lookup queries)
    const tags = (record["lookup.tags"] as string[]) || (record.tags as string[]) || [];
    const grandparentName = (record["lookup.entity.name"] as string) || (record["entity.name"] as string) || "";
    const allAF = extractAllAFFromTags(tags);

    if (allAF.length > 0) {
      const source = isK8sEntityType(entityType!) ? "inherited-namespace" : "inherited-host";
      setResult({ af: allAF, loading: false, error: null, source, sourceEntityName: grandparentName });
    } else {
      setResult({ af: null, loading: false, error: null, source: "none" });
    }
    setStep("done");
  }, [grandparentData, grandparentError, step, entityType]);

  // Handle parent/grandparent/children errors
  useEffect(() => {
    if (parentError && step === "parent") {
      setResult({ af: null, loading: false, error: parentError as Error, source: "none" });
      setStep("done");
    }
    if (grandparentError && step === "grandparent") {
      setResult({ af: null, loading: false, error: grandparentError as Error, source: "none" });
      setStep("done");
    }
  }, [parentError, grandparentError, step]);

  // Reset when entityId changes
  useEffect(() => {
    setStep("entity");
    setParentQuery(null);
    setGrandparentQuery(null);
    setChildrenQuery(null);
    setResult({ af: null, loading: true, error: null, source: "none" });
  }, [entityId, entityType]);

  return result;
}
