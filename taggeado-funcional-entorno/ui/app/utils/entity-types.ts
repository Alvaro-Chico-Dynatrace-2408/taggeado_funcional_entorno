export type EntityType =
  | "host"
  | "process_group"
  | "service"
  | "kubernetes_cluster"
  | "cloud_application_namespace"
  | "cloud_application"
  | "cloud_application_instance";

export type AFSource = "direct" | "inherited-namespace" | "inherited-host" | "aggregated-namespaces" | "none";

export interface AFResolution {
  af: string[] | null;
  loading: boolean;
  error: Error | null;
  source: AFSource;
  sourceEntityName?: string;
}

export interface EntityRecord {
  id: string;
  name: string;
  type: EntityType;
  tags: string[];
}

export const K8S_ENTITY_TYPES: EntityType[] = [
  "kubernetes_cluster",
  "cloud_application_namespace",
  "cloud_application",
  "cloud_application_instance",
];

export const NON_K8S_ENTITY_TYPES: EntityType[] = [
  "host",
  "process_group",
  "service",
];

export const ALL_SEARCHABLE_TYPES: EntityType[] = [
  ...K8S_ENTITY_TYPES,
  ...NON_K8S_ENTITY_TYPES,
];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  host: "Host",
  process_group: "Process Group",
  service: "Service",
  kubernetes_cluster: "Kubernetes Cluster",
  cloud_application_namespace: "Namespace",
  cloud_application: "Workload",
  cloud_application_instance: "Pod",
};

export const AF_TAG_KEY = "AppFuncional_DatalakeInfo";

/**
 * Extracts the first AF tag value from a tags array.
 * Matches both "AppFuncional_DatalakeInfo:value" and "nº_AppFuncional_DatalakeInfo:value"
 */
export function extractAFFromTags(tags: string[]): string | null {
  if (!tags || !Array.isArray(tags)) return null;
  for (const tag of tags) {
    if (tag.includes(AF_TAG_KEY)) {
      const colonIndex = tag.indexOf(":", tag.indexOf(AF_TAG_KEY));
      if (colonIndex !== -1) {
        return tag.substring(colonIndex + 1);
      }
    }
  }
  return null;
}

/**
 * Extracts ALL AF tag values from a tags array (for entities with multiple AF tags).
 */
export function extractAllAFFromTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const results: string[] = [];
  for (const tag of tags) {
    if (tag.includes(AF_TAG_KEY)) {
      const colonIndex = tag.indexOf(":", tag.indexOf(AF_TAG_KEY));
      if (colonIndex !== -1) {
        const value = tag.substring(colonIndex + 1);
        if (value && !results.includes(value)) {
          results.push(value);
        }
      }
    }
  }
  return results;
}

export function isK8sEntityType(type: EntityType): boolean {
  return K8S_ENTITY_TYPES.includes(type);
}
