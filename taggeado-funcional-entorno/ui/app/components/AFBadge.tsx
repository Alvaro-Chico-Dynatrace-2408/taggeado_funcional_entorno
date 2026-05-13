import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type { AFSource } from "../utils/entity-types";

interface AFBadgeProps {
  af: string | string[] | null;
  source: AFSource;
  sourceEntityName?: string;
  loading?: boolean;
}

export const AFBadge = ({ af, source, sourceEntityName, loading }: AFBadgeProps) => {
  if (loading) {
    return (
      <Flex
        alignItems="center"
        justifyContent="center"
        style={{
          padding: "2px 8px",
          borderRadius: "4px",
          background: Colors.Background.Field.Neutral.Emphasized,
        }}
      >
        <Text>Cargando...</Text>
      </Flex>
    );
  }

  if (!af || (Array.isArray(af) && af.length === 0)) {
    return (
      <Flex
        alignItems="center"
        justifyContent="center"
        style={{
          padding: "2px 8px",
          borderRadius: "4px",
          background: Colors.Background.Field.Neutral.Emphasized,
        }}
      >
        <Text>Sin AF</Text>
      </Flex>
    );
  }

  const afValues = Array.isArray(af) ? af : [af];

  const tooltipText =
    source === "direct"
      ? "Tag directa en la entidad"
      : source === "inherited-namespace"
        ? `Heredada del namespace: ${sourceEntityName || "desconocido"}`
        : source === "inherited-host"
          ? `Heredada del host: ${sourceEntityName || "desconocido"}`
          : source === "aggregated-namespaces"
            ? `Agregada de ${sourceEntityName || "namespaces"}`
            : "";

  const sourceLabel =
    source === "inherited-namespace" ? "NS"
    : source === "inherited-host" ? "Host"
    : source === "aggregated-namespaces" ? "Agg"
    : null;

  return (
    <Flex alignItems="center" gap={4} style={{ flexWrap: "wrap" }} title={tooltipText}>
      {afValues.map((value, i) => (
        <Flex
          key={i}
          alignItems="center"
          gap={2}
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            background: Colors.Background.Field.Success.Emphasized,
          }}
        >
          <Text style={{ fontWeight: 600, fontSize: "12px" }}>{value}</Text>
        </Flex>
      ))}
      {sourceLabel && (
        <Text style={{ fontSize: "11px", opacity: 0.7 }}>({sourceLabel})</Text>
      )}
    </Flex>
  );
};
