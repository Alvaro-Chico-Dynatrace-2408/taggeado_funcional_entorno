import { useMemo } from "react";
import { useDql } from "@dynatrace-sdk/react-hooks";
import type { EntityType } from "../utils/entity-types";
import { extractAFFromTags } from "../utils/entity-types";

export interface BatchAFResult {
  [entityId: string]: {
    af: string | null;
    source: "direct" | "none";
  };
}

/**
 * Batch-resolves AF tags for a list of entities of the same type.
 * Only resolves direct AF tags (for inherited resolution, use useAFResolver per entity).
 * Designed for table views where we show many entities at once.
 */
export function useAFBatchResolver(
  entityType: EntityType | null,
  entityIds: string[]
): { results: BatchAFResult; loading: boolean } {
  const query = useMemo(() => {
    if (!entityType || entityIds.length === 0) return null;
    // Fetch all entities of the given type that are in our ID list
    const idList = entityIds.map((id) => `"${id}"`).join(", ");
    return `fetch dt.entity.${entityType}, from:now()-7d
| filter in(id, array(${idList}))
| fieldsAdd tags, entity.name`;
  }, [entityType, entityIds]);

  const { data, isLoading } = useDql(
    query ? { query } : { query: "" },
    { enabled: !!query }
  );

  const results = useMemo<BatchAFResult>(() => {
    const map: BatchAFResult = {};
    // Initialize all as "none"
    for (const id of entityIds) {
      map[id] = { af: null, source: "none" };
    }
    if (!data?.records) return map;

    for (const record of data.records) {
      const rec = record as Record<string, unknown>;
      const id = rec.id as string;
      const tags = (rec.tags as string[]) || [];
      const af = extractAFFromTags(tags);
      if (id && map[id] !== undefined) {
        map[id] = { af, source: af ? "direct" : "none" };
      }
    }
    return map;
  }, [data, entityIds]);

  return { results, loading: isLoading };
}
