import React, { useState, useMemo, useCallback } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { TextInput } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import type { EntityType } from "../utils/entity-types";
import { buildSearchByName } from "../utils/dql-queries";

type NonK8sEntityType = "host" | "process_group" | "service";

const NON_K8S_TYPE_OPTIONS: { type: NonK8sEntityType; label: string; icon: string; desc: string }[] = [
  { type: "host", label: "Host", icon: "🖥️", desc: "Hosts con tag AF directa" },
  { type: "process_group", label: "Process Group", icon: "⚙️", desc: "PGs (hereda AF del host)" },
  { type: "service", label: "Service", icon: "🌐", desc: "Services (hereda AF del host via PG)" },
];

export const NonKubernetesView = () => {
  const [selectedType, setSelectedType] = useState<NonK8sEntityType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    const timer = setTimeout(() => {
      if (val.trim().length >= 2) setDebouncedTerm(val.trim());
      else setDebouncedTerm("");
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Search query
  const searchQuery = useMemo(() => {
    if (!selectedType || !debouncedTerm) return null;
    return buildSearchByName(selectedType, debouncedTerm, 100);
  }, [selectedType, debouncedTerm]);

  const { data: searchData, isLoading } = useDql(
    searchQuery ? { query: searchQuery } : { query: "" },
    { enabled: !!searchQuery }
  );

  const rows: EntityRow[] = useMemo(() => {
    if (!searchData?.records || !selectedType) return [];
    return searchData.records.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        id: rec.id as string,
        name: (rec["entity.name"] as string) || "",
        type: selectedType as EntityType,
        tags: (rec.tags as string[]) || [],
      };
    });
  }, [searchData, selectedType]);

  return (
    <Flex flexDirection="column" gap={0}>
      {/* ── Hero banner (DQL Cost style - green variant) ── */}
      <Flex
        flexDirection="column"
        gap={16}
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #0a2e1a 40%, #1b5e20 80%, #43a047 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          paddingTop: 28,
          paddingBottom: 28,
          paddingLeft: 36,
          paddingRight: 36,
        }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(67, 160, 71, 0.2)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -25, right: 80, width: 90, height: 90, borderRadius: "50%", background: "rgba(27, 94, 32, 0.25)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 10, right: 180, width: 50, height: 50, borderRadius: "50%", background: "rgba(67, 160, 71, 0.12)", pointerEvents: "none" }} />

        <Flex alignItems="center" gap={12}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
          >
            <Text style={{ fontSize: "22px" }}>🖥️</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Heading level={2} style={{ color: "#fff", margin: 0 }}>
              No-Kubernetes
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Selecciona un tipo de entidad y busca por nombre
            </Text>
          </Flex>
        </Flex>

        {/* Entity type selector inside banner */}
        <Flex gap={8} style={{ flexWrap: "wrap", marginTop: 4 }}>
          {NON_K8S_TYPE_OPTIONS.map((opt) => (
            <Flex
              key={opt.type}
              alignItems="center"
              gap={8}
              onClick={() => { setSelectedType(opt.type); setSearchTerm(""); setDebouncedTerm(""); }}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.15s",
                border: selectedType === opt.type ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.15)",
                background: selectedType === opt.type ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
              }}
            >
              <Text style={{ fontSize: "16px" }}>{opt.icon}</Text>
              <Text style={{ fontSize: "13px", fontWeight: selectedType === opt.type ? 700 : 400, color: "#fff" }}>
                {opt.label}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Flex>

      {/* ── Content area ── */}
      <Flex flexDirection="column" gap={20} style={{ padding: "24px 36px" }}>
        {/* Search bar */}
        {selectedType && (
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={12} style={{ maxWidth: 500 }}>
              <TextInput
                value={searchTerm}
                onChange={(val) => handleSearchChange(val ?? "")}
                placeholder={`Buscar ${NON_K8S_TYPE_OPTIONS.find((o) => o.type === selectedType)?.label || ""} por nombre...`}
              />
            </Flex>
            <Text style={{ fontSize: "12px", opacity: 0.5 }}>
              Escribe al menos 2 caracteres para buscar.
            </Text>
          </Flex>
        )}

        {/* Results table */}
        {selectedType && debouncedTerm && (
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontSize: "13px", fontWeight: 600 }}>
              {rows.length} resultado{rows.length !== 1 ? "s" : ""}
              {isLoading ? " (cargando...)" : ""}
            </Text>
            <EntityTable data={rows} loading={isLoading} showTypeColumn={false} />
          </Flex>
        )}

        {/* Empty state */}
        {!selectedType && (
          <Flex alignItems="center" justifyContent="center" style={{ padding: "48px", opacity: 0.5 }}>
            <Text>Selecciona un tipo de entidad en el panel superior</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
