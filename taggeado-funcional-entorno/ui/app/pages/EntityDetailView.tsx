import React from "react";
import { useParams } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text, Paragraph } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { AFBadge } from "../components/AFBadge";
import { BreadcrumbNav } from "../components/BreadcrumbNav";
import { useAFResolver } from "../hooks/useAFResolver";
import { buildEntityQuery } from "../utils/dql-queries";
import { validateEntityId } from "../utils/validators";
import { ENTITY_TYPE_LABELS } from "../utils/entity-types";
import type { EntityType } from "../utils/entity-types";

export const EntityDetailView = () => {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>();

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

  const breadcrumbs = [
    { label: "Inicio", path: "/" },
    { label: ENTITY_TYPE_LABELS[type] || type, path: "/search" },
    { label: entity?.name || entityId! },
  ];

  const dynatraceLink = `https://vct14604.apps.dynatrace.com/ui/entity/${entityId}`;

  return (
    <Flex flexDirection="column" padding={16} gap={16}>
      <BreadcrumbNav items={breadcrumbs} />

      {entityLoading ? (
        <Text>Cargando entidad...</Text>
      ) : entity ? (
        <>
          <Heading level={4}>{entity.name}</Heading>

          <Flex gap={16} alignItems="center">
            <Text style={{ fontWeight: 600 }}>Tipo:</Text>
            <Text>{ENTITY_TYPE_LABELS[type] || type}</Text>
          </Flex>

          <Flex gap={16} alignItems="center">
            <Text style={{ fontWeight: 600 }}>ID:</Text>
            <Text style={{ fontFamily: "monospace", fontSize: "12px" }}>{entityId}</Text>
          </Flex>

          <Flex gap={16} alignItems="center">
            <Text style={{ fontWeight: 600 }}>AF (AppFuncional):</Text>
            <AFBadge
              af={afResolution.af}
              source={afResolution.source}
              sourceEntityName={afResolution.sourceEntityName}
              loading={afResolution.loading}
            />
          </Flex>

          {afResolution.source !== "direct" && afResolution.source !== "none" && (
            <Paragraph>
              Resolución: AF {afResolution.source === "aggregated-namespaces" ? "agregada de" : "heredada de"}{" "}
              {afResolution.source === "inherited-namespace" ? "namespace" : afResolution.source === "inherited-host" ? "host" : ""}{" "}
              <strong>{afResolution.sourceEntityName}</strong>
            </Paragraph>
          )}

          <Flex gap={16} alignItems="center">
            <Text style={{ fontWeight: 600 }}>Deep link:</Text>
            <a href={dynatraceLink} target="_blank" rel="noopener noreferrer">
              Ver en Dynatrace →
            </a>
          </Flex>

          <Flex flexDirection="column" gap={4} style={{ marginTop: 16 }}>
            <Heading level={5}>Tags ({entity.tags.length})</Heading>
            {entity.tags.length === 0 ? (
              <Text>Sin tags</Text>
            ) : (
              <Flex gap={4} style={{ flexWrap: "wrap" }}>
                {entity.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "#f0f0f0",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </Flex>
            )}
          </Flex>
        </>
      ) : (
        <Text>Entidad no encontrada</Text>
      )}
    </Flex>
  );
};
