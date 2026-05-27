import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";
import type { AFSource } from "../utils/entity-types";

interface AFBadgeProps {
  af: string | string[] | null;
  source: AFSource;
  sourceEntityName?: string;
  loading?: boolean;
  tone?: "k8s" | "non-k8s";
}

export const AFBadge = ({ af, source, sourceEntityName, loading, tone = "k8s" }: AFBadgeProps) => {
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

  // Keep K8s chips purple and Non-K8s chips green.
  const isInherited = source === "inherited-namespace" || source === "inherited-host";
  const chipBg = tone === "k8s" ? "rgba(107, 47, 255, 0.06)" : "rgba(27, 94, 32, 0.06)";
  const chipBorder = tone === "k8s" ? "rgba(107, 47, 255, 0.2)" : "rgba(27, 94, 32, 0.2)";
  const chipColor = tone === "k8s" ? "rgba(107, 47, 255, 0.85)" : "rgba(27, 94, 32, 0.9)";

  const sourceLabel = isInherited
    ? source === "inherited-namespace" ? "NS" : "Host"
    : source === "aggregated-namespaces" ? "NS" : null;

  return (
    <Flex alignItems="center" gap={4} style={{ flexWrap: "wrap" }} title={tooltipText}>
      {afValues.map((value, i) => (
        <Flex
          key={i}
          alignItems="center"
          gap={4}
          style={{
            padding: "2px 10px",
            borderRadius: "12px",
            background: chipBg,
            border: `1px solid ${chipBorder}`,
          }}
        >
          <Text style={{ fontWeight: 600, fontSize: "11px", color: chipColor }}>{value}</Text>
          {sourceLabel && (
            <Text style={{ fontSize: "9px", fontWeight: 500, opacity: 0.55, color: chipColor }}>↑{sourceLabel}</Text>
          )}
        </Flex>
      ))}
    </Flex>
  );
};
