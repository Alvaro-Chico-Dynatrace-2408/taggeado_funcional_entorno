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
    extraFields = ", belongs_to[dt.entity.cloud_application], namespaceName";
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
 * Builds a DQL query to search K8s nodes by name.
 */
export function buildNodeSearchByName(searchTerm: string): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) {
    throw new Error("Search term cannot be empty");
  }
  return `fetch dt.entity.kubernetes_node, from:now()-7d
| filter contains(entity.name, "${sanitized}")
| fieldsAdd entity.name, tags
| limit 5000`;
}

/**
 * Builds a DQL query to search K8s nodes by ID.
 */
export function buildNodeSearchById(searchTerm: string): string {
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) {
    throw new Error("Search term cannot be empty");
  }
  return `fetch dt.entity.kubernetes_node, from:now()-7d
| filter id == "${sanitized}"
| fieldsAdd entity.name, tags
| limit 5000`;
}

/**
 * Builds a DQL query that resolves AF tags for a node by name.
 * Chain: pods → namespaces with AF (lookup) → kubernetes_node runs pods (lookup) → filter by node name.
 */
export function buildNodeAFByName(nodeName: string): string {
  const sanitized = sanitizeSearchTerm(nodeName);
  if (!sanitized) {
    throw new Error("Node name cannot be empty");
  }
  return `fetch dt.entity.cloud_application_instance, from:now()-7d
| fields id, namespaceName
| lookup [fetch dt.entity.cloud_application_namespace, from:now()-7d | expand tags | filter contains(tags,"AppFuncional") | fieldsAdd ff=1], sourceField:namespaceName, lookupField:entity.name, fields:{ff,tags}
| filterOut isNull(ff)
| lookup [fetch dt.entity.kubernetes_node, from:now()-7d | expand runs[dt.entity.cloud_application_instance] | fieldsAdd NodeName=entity.name], lookupField:\`runs[dt.entity.cloud_application_instance]\`, sourceField:id, fields:{NodeName}
| filterOut isNull(NodeName)
| fields NodeName, tags
| filter NodeName == "${sanitized}"
| dedup tags`;
}

/**
 * Builds a DQL query that resolves AF tags for pods by name.
 * Chain: pod → namespaceName → namespace with AF tags (lookup).
 */
export function buildPodAFByName(podName: string): string {
  const sanitized = sanitizeSearchTerm(podName);
  if (!sanitized) {
    throw new Error("Pod name cannot be empty");
  }
  return `fetch dt.entity.cloud_application_instance, from:now()-7d
| fields id, podName=entity.name, namespaceName
| lookup [fetch dt.entity.cloud_application_namespace, from:now()-7d | expand tags | filter contains(tags,"AppFuncional") | fieldsAdd ff=1], sourceField:namespaceName, lookupField:entity.name, fields:{ff,tags}
| filterOut isNull(ff)
| filter podName == "${sanitized}"
| dedup id, tags
| fields podName, id, tags`;
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

/**
 * Builds a DQL query to fetch AF tags inherited from services called by an application.
 * Always filters by the application entity ID using the typed called_by relationship.
 * Works for application, device_application, and custom_application entity types.
 */
export function buildServicesCalledByApp(appId: string, appEntityType: EntityType): string {
  if (!validateEntityId(appId)) {
    throw new Error(`Invalid entity ID format: ${appId}`);
  }
  // Web apps: field MUST be named "dt.entity.application" for entityName() to work.
  // Filter MUST come BEFORE "fields tags" to avoid FIELD_DOES_NOT_EXIST.
  if (appEntityType === "application") {
    // ID-based: no need for entityName, just compare toString of the entity reference
    return `fetch dt.entity.service
| expand tags
| filter contains(tags,"AppFuncional")
| fieldsAdd called_by
| filter isNotNull(called_by[dt.entity.application])
| expand called_by[dt.entity.application]
| fieldsAdd dt.entity.application = \`called_by[dt.entity.application]\`
| filter toString(dt.entity.application) == "${appId}"
| fields tags
| dedup tags`;
  }

  // Mobile apps
  if (appEntityType === "device_application") {
    return `fetch dt.entity.service
| expand tags
| filter contains(tags,"AppFuncional")
| fieldsAdd called_by
| filter isNotNull(called_by[dt.entity.device_application])
| expand called_by[dt.entity.device_application]
| fieldsAdd dt.entity.device_application = \`called_by[dt.entity.device_application]\`
| filter toString(dt.entity.device_application) == "${appId}"
| fields tags
| dedup tags`;
  }

  // Custom apps
  if (appEntityType === "custom_application") {
    return `fetch dt.entity.service
| expand tags
| filter contains(tags,"AppFuncional")
| fieldsAdd called_by
| filter isNotNull(called_by[dt.entity.custom_application])
| expand called_by[dt.entity.custom_application]
| fieldsAdd dt.entity.custom_application = \`called_by[dt.entity.custom_application]\`
| filter toString(dt.entity.custom_application) == "${appId}"
| fields tags
| dedup tags`;
  }

  return `fetch dt.entity.service
| fields tags
| limit 0`;
}
