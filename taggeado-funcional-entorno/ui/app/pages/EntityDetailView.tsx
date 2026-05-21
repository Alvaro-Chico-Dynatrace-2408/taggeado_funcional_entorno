import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { AFBadge } from "../components/AFBadge";
import { useAFResolver } from "../hooks/useAFResolver";
import { buildEntityQuery } from "../utils/dql-queries";
import { validateEntityId } from "../utils/validators";
import { ENTITY_TYPE_LABELS, extractAllAFFromTags, isK8sEntityType } from "../utils/entity-types";
import type { EntityType } from "../utils/entity-types";

export const EntityDetailView = () => {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>();
  const navigate = useNavigate();

  const isValid = entityId && entityType && validateEntityId(entityId);
  const type = entityType as EntityType;

  const query = isValid ? buildEntityQuery(type, entityId!) : null;
  const { data, isLoading: entityLoading } = useDql(
    query ? { query } : { query: "" },
    { enabled: !!query }
  );

  const afResolution = useAFResolver(entityId || null, type || null);

  const entity = React.useMemo(() => {
    if (!data?.records?.length) return null;
    const rec = data.records[0] as Record<string, unknown>;
    return {
      id: rec.id as string,
      name: (rec["entity.name"] as string) || "",
      tags: (rec.tags as string[]) || [],
    };
  }, [data]);

  if (!isValid) {
    return (
      <Flex padding={16}>
        <Text>Entidad no válida</Text>
      </Flex>
    );
  }

  const isK8s = isK8sEntityType(type);
  const backPath = isK8s ? "/kubernetes" : "/non-kubernetes";

  // Build correct deep link based on entity type
  const buildDynatraceLink = () => {
    const base = "https://vct14604.apps.dynatrace.com/ui/apps/dynatrace.kubernetes/explorer";
    if (type === "kubernetes_cluster") {
      return `${base}/cluster?perspective=Health&sort=healthIndicators%3Adescending&detailsId=${entityId}&sidebarOpen=false`;
    }
    if (type === "cloud_application_namespace") {
      const nsName = entity?.name || "";
      return `${base}/namespace?perspective=Health&sort=healthIndicators%3Adescending&detailsId=${entityId}&sidebarOpen=false#filtering=Namespace+%3D+${encodeURIComponent(nsName)}`;
    }
    return `https://vct14604.apps.dynatrace.com/ui/entity/${entityId}`;
  };
  const dynatraceLink = buildDynatraceLink();

  // Compute direct AF from entity's own tags
  const directAF = entity ? extractAllAFFromTags(entity.tags) : [];

  // Inherited AF (from resolution, only if source is not "direct" and not "none")
  const hasInherited = afResolution.source !== "direct" && afResolution.source !== "none" && !afResolution.loading;
  const inheritedAF = hasInherited && afResolution.af ? afResolution.af : [];
  const inheritedSource = afResolution.sourceEntityName || "";

  const totalAFCount = directAF.length + inheritedAF.length;

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

        <Flex alignItems="center" gap={12}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
          >
            <Text style={{ fontSize: "22px" }}>{isK8s ? "☸️" : "🖥️"}</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Heading level={2} style={{ color: "#fff", margin: 0 }}>
              {entityLoading ? "Cargando..." : entity?.name || "Entidad no encontrada"}
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              {ENTITY_TYPE_LABELS[type] || type}
            </Text>
          </Flex>
        </Flex>
      </Flex>

      {/* ── Content area ── */}
      {entity && (
        <Flex flexDirection="column" gap={24} style={{ padding: "24px 36px" }}>
          {/* Back button */}
          <Flex>
            <Button onClick={() => navigate(-1)} variant="accent">
              ← Volver
            </Button>
          </Flex>

          {/* Entity info */}
          <Flex flexDirection="column" gap={8}>
            <Flex gap={16} alignItems="center">
              <Text style={{ fontWeight: 600, fontSize: 12, opacity: 0.7 }}>ID:</Text>
              <Text style={{ fontFamily: "monospace", fontSize: "12px", background: "rgba(107, 47, 255, 0.06)", padding: "2px 8px", borderRadius: 4 }}>{entityId}</Text>
            </Flex>
            <Flex gap={16} alignItems="center">
              <Text style={{ fontWeight: 600, fontSize: 12, opacity: 0.7 }}>Deep link:</Text>
              <a href={dynatraceLink} target="_blank" rel="noopener noreferrer" style={{ color: "#6b2fff", fontWeight: 500, fontSize: 13 }}>
                Ver en Dynatrace →
              </a>
            </Flex>
          </Flex>

          {/* Total AF count */}
          <Flex flexDirection="column" gap={4}>
            <Heading level={4} style={{ margin: 0 }}>
              Tags AF totales: {afResolution.loading ? "..." : totalAFCount}
            </Heading>
          </Flex>

          {/* ── Section: Tags directas ── */}
          <Flex flexDirection="column" gap={8} style={{ padding: 16, borderRadius: 8, background: "rgba(107, 47, 255, 0.04)", border: "1px solid rgba(107, 47, 255, 0.15)" }}>
            <Flex alignItems="center" gap={8}>
              <Heading level={5} style={{ margin: 0 }}>Tags directas</Heading>
              <Text style={{ fontSize: 12, fontWeight: 600, color: "#6b2fff", background: "rgba(107, 47, 255, 0.1)", padding: "1px 8px", borderRadius: 10 }}>
                {directAF.length}
              </Text>
            </Flex>
            {directAF.length === 0 ? (
              <Text style={{ opacity: 0.5, fontSize: 13 }}>Esta entidad no tiene tags AF directas</Text>
            ) : (
              <AFBadge af={directAF} source="direct" />
            )}
          </Flex>

          {/* ── Section: Tags heredadas ── */}
          <Flex flexDirection="column" gap={8} style={{ padding: 16, borderRadius: 8, background: "rgba(107, 47, 255, 0.04)", border: "1px solid rgba(107, 47, 255, 0.15)" }}>
            <Flex alignItems="center" gap={8}>
              <Heading level={5} style={{ margin: 0 }}>Tags heredadas</Heading>
              <Text style={{ fontSize: 12, fontWeight: 600, color: "#6b2fff", background: "rgba(107, 47, 255, 0.1)", padding: "1px 8px", borderRadius: 10 }}>
                {afResolution.loading ? "..." : inheritedAF.length}
              </Text>
            </Flex>
            {afResolution.loading ? (
              <Text style={{ opacity: 0.5, fontSize: 13 }}>Resolviendo herencia...</Text>
            ) : inheritedAF.length === 0 ? (
              <Text style={{ opacity: 0.5, fontSize: 13 }}>No se encontraron tags AF heredadas</Text>
            ) : (
              <Flex flexDirection="column" gap={8}>
                <Text style={{ fontSize: 12, opacity: 0.7 }}>
                  {afResolution.source === "aggregated-namespaces"
                    ? `Agregadas de ${inheritedSource}`
                    : `Heredadas de ${inheritedSource}`}
                </Text>
                <AFBadge af={inheritedAF} source={afResolution.source} />
              </Flex>
            )}
          </Flex>

          {/* ── All raw tags ── */}
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={8}>
              <Heading level={5} style={{ margin: 0 }}>Todas las tags raw</Heading>
              <Text style={{ fontSize: 12, fontWeight: 600, opacity: 0.5 }}>
                ({entity.tags.length})
              </Text>
            </Flex>
            {entity.tags.length === 0 ? (
              <Text style={{ opacity: 0.5, fontSize: 13 }}>Sin tags</Text>
            ) : (
              <Flex gap={4} style={{ flexWrap: "wrap" }}>
                {entity.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(107, 47, 255, 0.06)",
                      border: "1px solid rgba(107, 47, 255, 0.15)",
                      fontSize: "11px",
                      fontFamily: "monospace",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </Flex>
            )}
          </Flex>
        </Flex>
      )}

      {!entityLoading && !entity && (
        <Flex alignItems="center" justifyContent="center" style={{ padding: 48 }}>
          <Text>Entidad no encontrada</Text>
        </Flex>
      )}
    </Flex>
  );
};
