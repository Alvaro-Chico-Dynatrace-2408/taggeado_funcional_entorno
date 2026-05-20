import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
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
      <Flex alignItems="center" style={{ padding: "3px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)" }}>
        <Text style={{ fontSize: "12px", opacity: 0.6 }}>Cargando...</Text>
      </Flex>
    );
  }

  if (!af || (Array.isArray(af) && af.length === 0)) {
    return (
      <Flex alignItems="center" style={{ padding: "3px 10px", borderRadius: "6px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)" }}>
        <Text style={{ fontSize: "12px", color: "rgba(255,100,100,0.9)" }}>Sin AF</Text>
      </Flex>
    );
  }

  const afValues = Array.isArray(af) ? af : [af];

  const tooltipText =
    source === "direct" ? "Tag directa en la entidad"
    : source === "inherited-namespace" ? `Heredada del namespace: ${sourceEntityName || ""}`
    : source === "inherited-host" ? `Heredada del host: ${sourceEntityName || ""}`
    : source === "aggregated-namespaces" ? `Agregada de namespaces`
    : "";

  // Color scheme based on source
  const isInherited = source === "inherited-namespace" || source === "inherited-host";
  const chipBg = isInherited ? "rgba(107,47,255,0.12)" : "rgba(76,175,80,0.12)";
  const chipBorder = isInherited ? "rgba(107,47,255,0.3)" : "rgba(76,175,80,0.3)";
  const chipColor = isInherited ? "rgba(180,140,255,1)" : "rgba(130,220,130,1)";

  return (
    <Flex alignItems="center" gap={4} style={{ flexWrap: "wrap" }} title={tooltipText}>
      {afValues.map((value, i) => (
        <Flex
          key={i}
          alignItems="center"
          style={{
            padding: "2px 10px",
            borderRadius: "12px",
            background: chipBg,
            border: `1px solid ${chipBorder}`,
          }}
        >
          <Text style={{ fontWeight: 600, fontSize: "11px", color: chipColor }}>{value}</Text>
        </Flex>
      ))}
      {isInherited && (
        <Text style={{ fontSize: "10px", opacity: 0.5 }}>
          {source === "inherited-namespace" ? "↑NS" : "↑Host"}
        </Text>
      )}
    </Flex>
  );
};
