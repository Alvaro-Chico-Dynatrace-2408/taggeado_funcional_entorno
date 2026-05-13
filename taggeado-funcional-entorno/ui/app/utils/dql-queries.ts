import { validateEntityId, sanitizeSearchTerm } from "./validators";
import type { EntityType } from "./entity-types";

/**
 * Builds a DQL query to fetch a single entity by ID with its tags.
 */
export function buildEntityQuery(entityType: EntityType, entityId: string): string {
  if (!validateEntityId(entityId)) {
    throw new Error(`Invalid entity ID format: ${entityId}`);
  }
  return `fetch dt.entity.${entityType}, from:now()-7d
| filter id == "${entityId}"
| fieldsAdd tags, entity.name`;
}

/**
 * Builds a DQL query to get the namespace of a workload (CLOUD_APPLICATION) via classicEntitySelector.
 */
export function buildNamespaceFromWorkload(workloadId: string): string {
  if (!validateEntityId(workloadId)) {
    throw new Error(`Invalid entity ID format: ${workloadId}`);
  }
  return `fetch dt.entity.cloud_application_namespace, from:now()-7d
| filter in(id, classicEntitySelector("type(CLOUD_APPLICATION_NAMESPACE),toRelationships.isNamespaceOfCa(type(CLOUD_APPLICATION),entityId(${workloadId}))"))
| fieldsAdd tags, entity.name`;
}

/**
 * Builds a DQL query to get the workload (CLOUD_APPLICATION) of a pod (CLOUD_APPLICATION_INSTANCE).
 */
export function buildWorkloadFromPod(podId: string): string {
  if (!validateEntityId(podId)) {
    throw new Error(`Invalid entity ID format: ${podId}`);
  }
  return `fetch dt.entity.cloud_application, from:now()-7d
| filter in(id, classicEntitySelector("type(CLOUD_APPLICATION),toRelationships.isCgiOfCa(type(CLOUD_APPLICATION_INSTANCE),entityId(${podId}))"))
| fieldsAdd tags, entity.name`;
}

/**
 * Builds a DQL query to get the host of a process group.
 */
export function buildHostFromProcessGroup(pgId: string): string {
  if (!validateEntityId(pgId)) {
    throw new Error(`Invalid entity ID format: ${pgId}`);
  }
  return `fetch dt.entity.host, from:now()-7d
| filter in(id, classicEntitySelector("type(HOST),toRelationships.isProcessOf(type(PROCESS_GROUP),entityId(${pgId}))"))
| fieldsAdd tags, entity.name`;
}

/**
 * Builds a DQL query to get the process group of a service.
 */
export function buildProcessGroupFromService(serviceId: string): string {
  if (!validateEntityId(serviceId)) {
    throw new Error(`Invalid entity ID format: ${serviceId}`);
  }
  return `fetch dt.entity.process_group, from:now()-7d
| filter in(id, classicEntitySelector("type(PROCESS_GROUP),toRelationships.isServiceOfProcessGroup(type(SERVICE),entityId(${serviceId}))"))
| fieldsAdd tags, entity.name`;
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
export function buildSearchByName(entityType: EntityType, searchTerm: string, limit = 50): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) {
    throw new Error("Search term cannot be empty");
  }
  return `fetch dt.entity.${entityType}, from:now()-7d
| filter contains(entity.name, "${sanitized}")
| fieldsAdd tags, entity.name
| sort entity.name asc
| limit ${limit}`;
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
| filter in(id, classicEntitySelector("type(CLOUD_APPLICATION_NAMESPACE),toRelationships.isClusterOfNamespace(type(KUBERNETES_CLUSTER),entityId(${clusterId}))"))
| fieldsAdd tags, entity.name`;
}
