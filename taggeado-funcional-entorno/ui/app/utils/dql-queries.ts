import { validateEntityId, sanitizeSearchTerm } from "./validators";
import type { EntityType } from "./entity-types";

/**
 * Builds a DQL query to fetch a single entity by ID with its tags and relationship fields.
 */
export function buildEntityQuery(entityType: EntityType, entityId: string): string {
  if (!validateEntityId(entityId)) {
    throw new Error(`Invalid entity ID format: ${entityId}`);
  }
  // Include relationship fields based on entity type for fast traversal
  let extraFields = "";
  if (entityType === "cloud_application") {
    extraFields = ", namespaceName";
  } else if (entityType === "cloud_application_instance") {
    extraFields = ", belongs_to[dt.entity.cloud_application]";
  } else if (entityType === "process_group") {
    extraFields = ", runs_on[dt.entity.host]";
  } else if (entityType === "service") {
    extraFields = ", runs_on[dt.entity.process_group]";
  }
  return `fetch dt.entity.${entityType}, from:now()-7d
| filter id == "${entityId}"
| fieldsAdd tags, entity.name${extraFields}`;
}

/**
 * Builds a DQL query to get a namespace by name and its tags (for workload AF resolution).
 */
export function buildNamespaceByName(namespaceName: string): string {
  const sanitized = sanitizeSearchTerm(namespaceName);
  if (!sanitized) {
    throw new Error("Namespace name cannot be empty");
  }
  return `fetch dt.entity.cloud_application_namespace, from:now()-7d
| filter entity.name == "${sanitized}"
| fieldsAdd tags, entity.name
| limit 10`;
}

/**
 * Builds a DQL query to get a workload by ID (with namespaceName for further traversal).
 */
export function buildWorkloadById(workloadId: string): string {
  if (!validateEntityId(workloadId)) {
    throw new Error(`Invalid entity ID format: ${workloadId}`);
  }
  return `fetch dt.entity.cloud_application, from:now()-7d
| filter id == "${workloadId}"
| fieldsAdd tags, entity.name, namespaceName`;
}

/**
 * Builds a DQL query to get a host by ID (with tags).
 */
export function buildHostById(hostId: string): string {
  if (!validateEntityId(hostId)) {
    throw new Error(`Invalid entity ID format: ${hostId}`);
  }
  return `fetch dt.entity.host, from:now()-7d
| filter id == "${hostId}"
| fieldsAdd tags, entity.name`;
}

/**
 * Builds a DQL query to get a process group by ID (with runs_on host for further traversal).
 */
export function buildProcessGroupById(pgId: string): string {
  if (!validateEntityId(pgId)) {
    throw new Error(`Invalid entity ID format: ${pgId}`);
  }
  return `fetch dt.entity.process_group, from:now()-7d
| filter id == "${pgId}"
| fieldsAdd tags, entity.name, runs_on[dt.entity.host]`;
}

/**
 * Builds a DQL query to fetch all entities of a given type (with optional limit).
 */
export function buildFetchAllByType(entityType: EntityType, limit = 200): string {
  return `fetch dt.entity.${entityType}, from:now()-7d
| fieldsAdd tags, entity.name
| sort entity.name asc
| limit ${limit}`;
}

/**
 * Builds a DQL query to fetch namespaces belonging to a cluster.
 */
export function buildNamespacesFromCluster(clusterId: string): string {
  if (!validateEntityId(clusterId)) {
    throw new Error(`Invalid entity ID format: ${clusterId}`);
  }
  return `fetch dt.entity.cloud_application_namespace, from:now()-7d
| filter in(id, classicEntitySelector("type(CLOUD_APPLICATION_NAMESPACE),toRelationships.isClusterOfNamespace(type(KUBERNETES_CLUSTER),entityId(${clusterId}))"))
| fieldsAdd tags, entity.name
| sort entity.name asc`;
}

/**
 * Builds a DQL query to fetch workloads belonging to a namespace.
 */
export function buildWorkloadsFromNamespace(namespaceId: string): string {
  if (!validateEntityId(namespaceId)) {
    throw new Error(`Invalid entity ID format: ${namespaceId}`);
  }
  return `fetch dt.entity.cloud_application, from:now()-7d
| filter in(id, classicEntitySelector("type(CLOUD_APPLICATION),toRelationships.isNamespaceOfCa(type(CLOUD_APPLICATION_NAMESPACE),entityId(${namespaceId}))"))
| fieldsAdd tags, entity.name
| sort entity.name asc`;
}

/**
 * Builds a DQL query to fetch pods belonging to a workload.
 */
export function buildPodsFromWorkload(workloadId: string): string {
  if (!validateEntityId(workloadId)) {
    throw new Error(`Invalid entity ID format: ${workloadId}`);
  }
  return `fetch dt.entity.cloud_application_instance, from:now()-7d
| filter in(id, classicEntitySelector("type(CLOUD_APPLICATION_INSTANCE),toRelationships.isCgiOfCa(type(CLOUD_APPLICATION),entityId(${workloadId}))"))
| fieldsAdd tags, entity.name
| sort entity.name asc`;
}

/**
 * Builds a DQL query to fetch process groups belonging to a host.
 */
export function buildProcessGroupsFromHost(hostId: string): string {
  if (!validateEntityId(hostId)) {
    throw new Error(`Invalid entity ID format: ${hostId}`);
  }
  return `fetch dt.entity.process_group, from:now()-7d
| filter in(id, classicEntitySelector("type(PROCESS_GROUP),toRelationships.isProcessOf(type(HOST),entityId(${hostId}))"))
| fieldsAdd tags, entity.name
| sort entity.name asc`;
}

/**
 * Builds a DQL query to fetch services belonging to a process group.
 */
export function buildServicesFromProcessGroup(pgId: string): string {
  if (!validateEntityId(pgId)) {
    throw new Error(`Invalid entity ID format: ${pgId}`);
  }
  return `fetch dt.entity.service, from:now()-7d
| filter in(id, classicEntitySelector("type(SERVICE),toRelationships.isServiceOfProcessGroup(type(PROCESS_GROUP),entityId(${pgId}))"))
| fieldsAdd tags, entity.name
| sort entity.name asc`;
}

/**
 * Builds a DQL query to search entities by name across a given type.
 */
export function buildSearchByName(entityType: EntityType, searchTerm: string): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) {
    throw new Error("Search term cannot be empty");
  }
  return `fetch dt.entity.${entityType}, from:now()-7d
| filter contains(entity.name, "${sanitized}")
| fieldsAdd tags, entity.name
| sort entity.name asc
| limit 5000`;
}

export function buildSearchById(entityType: EntityType, searchTerm: string): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) {
    throw new Error("Search term cannot be empty");
  }
  // Use exact match on id, then fetch by name as fallback — both are fast indexed queries
  return `fetch dt.entity.${entityType}, from:now()-7d
| filter id == "${sanitized}"
| fieldsAdd tags, entity.name
| limit 5000`;
}

/**
 * Builds a DQL query that fetches clusters, expands their namespace relationships,
 * and lookups namespace tags. This lets us aggregate AF per cluster.
 * Result: one row per cluster-namespace pair with lookup.tags containing namespace tags.
 */
export function buildClustersWithNamespaceTags(): string {
  return `fetch dt.entity.kubernetes_cluster, from:now()-7d
| fieldsAdd entity.name, cluster_of[dt.entity.cloud_application_namespace]
| expand cluster_of[dt.entity.cloud_application_namespace]
| lookup sourceField:\`cluster_of[dt.entity.cloud_application_namespace]\`, lookupField:id, [fetch dt.entity.cloud_application_namespace, from:now()-7d | fieldsAdd tags, entity.name]`;
}

/**
 * Builds a DQL query to fetch namespaces of a cluster that have AF tags.
 */
export function buildNamespacesWithAFFromCluster(clusterId: string): string {
  if (!validateEntityId(clusterId)) {
    throw new Error(`Invalid entity ID format: ${clusterId}`);
  }
  return `fetch dt.entity.cloud_application_namespace, from:now()-7d
| fieldsAdd tags, entity.name, clustered_by[dt.entity.kubernetes_cluster]
| filter contains(toString(clustered_by[dt.entity.kubernetes_cluster]), "${clusterId}")
| filter contains(toString(tags), "AppFuncional_DatalakeInfo")
| limit 100000`;
}
