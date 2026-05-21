import React, { useState, useMemo, useCallback, useRef } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { Select } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import type { EntityType } from "../utils/entity-types";
import { extractAllAFFromTags } from "../utils/entity-types";
import { buildSearchByName } from "../utils/dql-queries";

type NonK8sEntityType = "host" | "process_group" | "service";

const NON_K8S_TYPE_OPTIONS: { type: NonK8sEntityType; label: string }[] = [
  { type: "host", label: "Host" },
  { type: "process_group", label: "Process Group" },
  { type: "service", label: "Service" },
];

export const NonKubernetesView = () => {
  const [selectedType, setSelectedType] = useState<NonK8sEntityType | null>(null);
  const [filterTerm, setFilterTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Cache entity data so selected entities remain visible after search changes
  const entityCacheRef = useRef<Record<string, EntityRow>>({});

  // Debounce filter input from multi-select
  const handleFilterChange = useCallback((val: string) => {
    setFilterTerm(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(val.trim().length >= 2 ? val.trim() : "");
    }, 400);
  }, []);

  // --- Search query ---
  const searchQuery = useMemo(() => {
    if (!selectedType || !debouncedTerm) return null;
    return buildSearchByName(selectedType, debouncedTerm);
  }, [selectedType, debouncedTerm]);

  const { data: searchData, isLoading } = useDql(
    searchQuery ? { query: searchQuery, maxResultRecords: 5000 } : { query: "" },
    { enabled: !!searchQuery }
  );

  // Build options from search results + cache them
  const searchOptions = useMemo(() => {
    if (!searchData?.records || !selectedType) return [];
    return searchData.records.map((r) => {
      const rec = r as Record<string, unknown>;
      const id = rec.id as string;
      const name = (rec["entity.name"] as string) || "";
      const tags = (rec.tags as string[]) || [];
      const row: EntityRow = { id, name, type: selectedType as EntityType, tags };
      entityCacheRef.current[id] = row;
      return { id, name };
    });
  }, [searchData, selectedType]);

  // Build table rows from selected entity
  const tableRows: EntityRow[] = useMemo(() => {
    if (!selectedId) return [];
    const row = entityCacheRef.current[selectedId];
    return row ? [row] : [];
  }, [selectedId, searchOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when entity type changes
  const handleTypeChange = useCallback((val: unknown) => {
    setSelectedType(val as NonK8sEntityType | null);
    setFilterTerm("");
    setDebouncedTerm("");
    setSelectedId(null);
    entityCacheRef.current = {};
  }, []);

  return (
    <Flex flexDirection="column" gap={0}>
      {/* ── Hero banner ── */}
      <Flex
        flexDirection="column"
        gap={4}
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
      </Flex>

      {/* ── Content area ── */}
      <Flex flexDirection="column" gap={20} style={{ padding: "24px 36px" }}>
        {/* Entity type dropdown */}
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>Tipo de entidad</Text>
          <Select value={selectedType} onChange={handleTypeChange}>
            <Select.Trigger width="400px" style={{ background: "rgba(27, 94, 32, 0.06)", borderColor: "rgba(27, 94, 32, 0.25)" }} />
            <Select.Content>
              {NON_K8S_TYPE_OPTIONS.map((opt) => (
                <Select.Option key={opt.type} value={opt.type}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select.Content>
          </Select>
        </Flex>

        {/* Entity multi-select with autocomplete */}
        {selectedType && (
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>
              Buscar y seleccionar entidades
            </Text>
            {!filterTerm && (
              <Text style={{ fontSize: "12px", color: "#e53935", fontWeight: 500 }}>
                Introduce al menos dos letras para buscar
              </Text>
            )}
            {searchOptions.length > 0 && (
              <Text style={{ fontSize: "12px", fontWeight: 600, color: "#1b5e20" }}>
                {searchOptions.length} resultado{searchOptions.length !== 1 ? "s" : ""} encontrado{searchOptions.length !== 1 ? "s" : ""}
              </Text>
            )}
            <div style={{ width: "100%", display: "grid" }}>
              <Select
                value={selectedId}
                onChange={(val) => { setSelectedId(prev => prev === val ? null : (val as string)); }}
              >
                <Select.Trigger width="full" style={{ background: "rgba(27, 94, 32, 0.06)", borderColor: "rgba(27, 94, 32, 0.25)" }} />
                <Select.Filter
                  disableFiltering
                  value={filterTerm}
                  onChange={handleFilterChange}
                />
                <Select.Content>
                  {isLoading && (
                    <Select.Option value="__loading" disabled>
                      Buscando...
                    </Select.Option>
                  )}
                  {!isLoading && debouncedTerm && searchOptions.length === 0 && (
                    <Select.Option value="__empty" disabled>
                      Sin resultados
                    </Select.Option>
                  )}
                  {!debouncedTerm && !isLoading && (
                    <Select.Option value="__hint" disabled>
                      Escribe al menos 2 caracteres...
                    </Select.Option>
                  )}
                  {searchOptions.map((opt) => (
                    <Select.Option key={opt.id} value={opt.id}>
                      {opt.name}
                    </Select.Option>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Text style={{ fontSize: "12px", opacity: 0.5 }}>
              Escribe para buscar y selecciona una entidad.
            </Text>
          </Flex>
        )}

        {/* Results table */}
        {tableRows.length > 0 && (
          <Flex flexDirection="column" gap={8}>
            <Text style={{ fontSize: "13px", fontWeight: 600 }}>
              Entidad seleccionada — {extractAllAFFromTags(tableRows[0].tags).length} tag{extractAllAFFromTags(tableRows[0].tags).length !== 1 ? "s" : ""}
            </Text>
            <EntityTable data={tableRows} loading={false} showTypeColumn={false} />
          </Flex>
        )}

        {/* Empty state */}
        {!selectedType && (
          <Flex alignItems="center" justifyContent="center" style={{ padding: "48px", opacity: 0.5 }}>
            <Text>Selecciona un tipo de entidad para empezar</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
