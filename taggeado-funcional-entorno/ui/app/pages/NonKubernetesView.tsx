import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { Select, Switch } from "@dynatrace/strato-components/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { HostsIcon } from "@dynatrace/strato-icons";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import type { EntityType } from "../utils/entity-types";
import { extractAllAFFromTags } from "../utils/entity-types";
import { buildSearchByName, buildSearchById, buildServicesCalledByApp } from "../utils/dql-queries";

type NonK8sEntityType = "host" | "process_group" | "service" | "application" | "device_application" | "custom_application";
type NonK8sCategoryType = "host" | "process_group" | "service" | "aplicaciones";

type AppSubType = "application" | "device_application" | "custom_application";

const NON_K8S_CATEGORY_OPTIONS: { type: NonK8sCategoryType; label: string }[] = [
  { type: "host", label: "Host" },
  { type: "process_group", label: "Process Group" },
  { type: "service", label: "Service" },
  { type: "aplicaciones", label: "Aplicaciones" },
];

const APP_SUB_TYPE_OPTIONS: { type: AppSubType; label: string }[] = [
  { type: "application", label: "Web" },
  { type: "device_application", label: "Móvil" },
  { type: "custom_application", label: "Custom" },
];

export const NonKubernetesView = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params (survives navigation)
  const [selectedCategory, setSelectedCategory] = useState<NonK8sCategoryType | null>(
    (searchParams.get("type") as NonK8sCategoryType) || null
  );
  const [appSubType, setAppSubType] = useState<AppSubType | null>(
    (searchParams.get("appSub") as AppSubType) || null
  );

  // The actual entity type used for queries
  const selectedType: NonK8sEntityType | null = useMemo(() => {
    if (!selectedCategory) return null;
    if (selectedCategory === "aplicaciones") return appSubType;
    return selectedCategory as NonK8sEntityType;
  }, [selectedCategory, appSubType]);

  const initialQ = searchParams.get("q") || searchParams.get("name") || "";
  const [filterTerm, setFilterTerm] = useState(initialQ);
  const [debouncedTerm, setDebouncedTerm] = useState(initialQ);
  const [selectedName, setSelectedName] = useState<string | null>(searchParams.get("name") || null);
  const [searchById, setSearchById] = useState(searchParams.get("byId") === "1");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const hasUserInteracted = useRef(false);

  // Mark as interacted after initial mount stabilizes
  useEffect(() => {
    const t = setTimeout(() => { hasUserInteracted.current = true; }, 500);
    return () => clearTimeout(t);
  }, []);

  // Sync state → URL params (replaceState so no extra history entries)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedCategory) params.type = selectedCategory;
    if (appSubType && selectedCategory === "aplicaciones") params.appSub = appSubType;
    if (selectedName) params.name = selectedName;
    if (searchById) params.byId = "1";
    setSearchParams(params, { replace: true });
  }, [selectedCategory, appSubType, selectedName, searchById, setSearchParams]);

  // Cache entity data so selected entities remain visible after search changes
  const entityCacheRef = useRef<Record<string, EntityRow>>({});

  // Debounce filter input from multi-select
  const handleFilterChange = useCallback((val: string) => {
    // Only clear selection when the user is actively typing (not on mount/re-render)
    setFilterTerm((prev) => {
      if (hasUserInteracted.current && val !== prev) {
        setSelectedName(null);
      }
      return val;
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedTerm(val.trim().length >= 2 ? val.trim() : "");
    }, 400);
  }, []);

  // --- Search query ---
  // Use selectedName as fallback search term to ensure the query fires on remount
  // (e.g. after navigating back) even if the debounce timer resets debouncedTerm.
  const effectiveSearchTerm = debouncedTerm || selectedName || "";
  const searchQuery = useMemo(() => {
    if (!selectedType || !effectiveSearchTerm) return null;
    return searchById
      ? buildSearchById(selectedType, effectiveSearchTerm)
      : buildSearchByName(selectedType, effectiveSearchTerm);
  }, [selectedType, effectiveSearchTerm, searchById]);

  const { data: searchData, isLoading } = useDql(
    searchQuery ? { query: searchQuery, maxResultRecords: 5000 } : { query: "" },
    { enabled: !!searchQuery }
  );

  // Build options from search results + cache them
  const searchOptions = useMemo(() => {
    if (!searchData?.records || !selectedType) {
      // Keep the selected option visible even when search results are cleared
      if (selectedName) {
        return [{ key: selectedName, label: selectedName }];
      }
      return [];
    }
    const uniqueKeys: string[] = [];
    for (const r of searchData.records) {
      const rec = r as Record<string, unknown>;
      const id = rec.id as string;
      const name = (rec["entity.name"] as string) || "";
      const tags = (rec.tags as string[]) || [];
      const row: EntityRow = { id, name, type: selectedType as EntityType, tags };
      entityCacheRef.current[id] = row;
      const key = searchById ? id : name;
      if (!uniqueKeys.includes(key)) uniqueKeys.push(key);
    }
    return uniqueKeys.map((key) => ({ key, label: key }));
  }, [searchData, selectedType, searchById, selectedName]);

  // Get all entity IDs matching the selected name/id
  const selectedIds = useMemo<string[]>(() => {
    if (!selectedName) return [];
    if (searchById) {
      return entityCacheRef.current[selectedName] ? [selectedName] : [];
    }
    return Object.keys(entityCacheRef.current).filter(
      (id) => entityCacheRef.current[id].name === selectedName
    );
  }, [selectedName, searchOptions, searchById]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build table rows from all entities matching selected name
  const tableRows: EntityRow[] = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const rows: EntityRow[] = [];
    for (const id of selectedIds) {
      const row = entityCacheRef.current[id];
      if (!row) continue;
      rows.push(row);
    }
    return rows;
  }, [selectedIds, selectedName, searchOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- For apps: query services to get inherited AF ---
  const isAppType = selectedType === "application" || selectedType === "device_application" || selectedType === "custom_application";
  const appAfQuery = useMemo(() => {
    if (!isAppType || selectedIds.length === 0) return null;
    // Use the first selected app ID
    return buildServicesCalledByApp(selectedIds[0], selectedType as EntityType);
  }, [isAppType, selectedIds, selectedType]);

  const { data: appAfData, isLoading: appAfLoading } = useDql(
    appAfQuery ? { query: appAfQuery, maxResultRecords: 5000 } : { query: "" },
    { enabled: !!appAfQuery }
  );

  // For apps, wait until inherited AF is loaded before showing the table
  const appAfReady = !isAppType || !appAfQuery || (!appAfLoading && appAfData !== undefined);

  // Extract inherited AF from services and inject into table rows
  const enrichedTableRows: EntityRow[] = useMemo(() => {
    if (!isAppType || !appAfData?.records || tableRows.length === 0) return tableRows;
    const afs: string[] = [];
    for (const record of appAfData.records) {
      const rec = record as Record<string, unknown>;
      const tag = (rec.tags as string) || "";
      if (!tag) continue;
      const afKeyIdx = tag.indexOf("AppFuncional_DatalakeInfo");
      if (afKeyIdx === -1) continue;
      const colonIndex = tag.indexOf(":", afKeyIdx + "AppFuncional_DatalakeInfo".length);
      if (colonIndex === -1) continue;
      const afValue = tag.substring(colonIndex + 1).trim();
      if (afValue && !afs.includes(afValue)) afs.push(afValue);
    }
    if (afs.length === 0) return tableRows;
    return tableRows.map((row) => ({ ...row, resolvedAF: afs, afSource: "inherited-service" as const }));
  }, [isAppType, appAfData, tableRows]);

  // Reset when entity type changes
  const handleTypeChange = useCallback((val: unknown) => {
    setSelectedCategory(val as NonK8sCategoryType | null);
    setAppSubType(null);
    setFilterTerm("");
    setDebouncedTerm("");
    setSelectedName(null);
    setSearchById(false);
    entityCacheRef.current = {};
  }, []);

  // Reset search when app subtype changes
  const handleAppSubTypeChange = useCallback((val: unknown) => {
    setAppSubType(val as AppSubType | null);
    setFilterTerm("");
    setDebouncedTerm("");
    setSelectedName(null);
    setSearchById(false);
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
            <HostsIcon style={{ fontSize: "22px", color: "#43a047" }} />
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Heading level={2} style={{ color: "#fff", margin: 0 }}>
              No-Kubernetes
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Selecciona un tipo de entidad y busca por nombre o ID
            </Text>
          </Flex>
        </Flex>
      </Flex>

      {/* ── Content area ── */}
      <Flex flexDirection="column" gap={20} style={{ padding: "24px 36px", width: "100%", boxSizing: "border-box" }}>
        {/* Entity type dropdown */}
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>Tipo de entidad</Text>
          <Select value={selectedCategory} onChange={handleTypeChange}>
            <Select.Trigger width="400px" style={{ background: "rgba(27, 94, 32, 0.06)", borderColor: "rgba(27, 94, 32, 0.25)" }} />
            <Select.Content>
              {NON_K8S_CATEGORY_OPTIONS.map((opt) => (
                <Select.Option key={opt.type} value={opt.type}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select.Content>
          </Select>
        </Flex>

        {/* App subtype dropdown (only when "Aplicaciones" is selected) */}
        {selectedCategory === "aplicaciones" && (
          <Flex flexDirection="column" gap={4}>
            <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>Tipo de aplicación</Text>
            <Select value={appSubType} onChange={handleAppSubTypeChange}>
              <Select.Trigger width="400px" style={{ background: "rgba(27, 94, 32, 0.06)", borderColor: "rgba(27, 94, 32, 0.25)" }} />
              <Select.Content>
                {APP_SUB_TYPE_OPTIONS.map((opt) => (
                  <Select.Option key={opt.type} value={opt.type}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select.Content>
            </Select>
          </Flex>
        )}

        {/* Entity search with Name/ID toggle */}
        {selectedType && (
          <Flex flexDirection="column" gap={8}>
            <Flex alignItems="center" gap={12}>
              <Text style={{ fontSize: "12px", fontWeight: 600, opacity: 0.7 }}>
                Buscar y seleccionar entidades
              </Text>
              <Flex alignItems="center" gap={6}>
                <Text style={{ fontSize: "11px", opacity: searchById ? 0.5 : 1, fontWeight: searchById ? 400 : 600 }}>Nombre</Text>
                <Switch value={searchById} onChange={() => { setSearchById((v) => !v); setSelectedName(null); setFilterTerm(""); setDebouncedTerm(""); }} />
                <Text style={{ fontSize: "11px", opacity: searchById ? 1 : 0.5, fontWeight: searchById ? 600 : 400 }}>ID</Text>
              </Flex>
            </Flex>
            {filterTerm.trim().length < 2 && !selectedName && (
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
                value={selectedName}
                onChange={(val) => { setSelectedName(prev => prev === val ? null : (val as string)); }}
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
                      {searchById
                        ? (selectedType === "host" ? "Ej: HOST-1A2B3C4D5E6F7890"
                          : selectedType === "process_group" ? "Ej: PROCESS_GROUP-1A2B3C4D5E6F7890"
                          : selectedType === "service" ? "Ej: SERVICE-1A2B3C4D5E6F7890"
                          : selectedType === "application" ? "Ej: APPLICATION-1A2B3C4D5E6F7890"
                          : selectedType === "device_application" ? "Ej: MOBILE_APPLICATION-1A2B3C4D"
                          : "Ej: CUSTOM_APPLICATION-1A2B3C4D")
                        : (selectedType === "host" ? "Ej: san01mihost.pro.bo1"
                          : selectedType === "process_group" ? "Ej: com.example.MyProcess"
                          : selectedType === "service" ? "Ej: MiServicio"
                          : "Ej: MiAplicacion")}
                    </Select.Option>
                  )}
                  {searchOptions.map((opt) => (
                    <Select.Option key={opt.key} value={opt.key}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Text style={{ fontSize: "12px", opacity: 0.5 }}>
              {searchById ? "Pega el ID completo de la entidad." : "Escribe para buscar y selecciona una entidad."}
            </Text>
          </Flex>
        )}

        {/* Results table — for apps, wait until AF is resolved */}
        {enrichedTableRows.length > 0 && appAfReady && (
          <Flex flexDirection="column" gap={8} style={{ width: "100%", overflow: "auto" }}>
            <Text style={{ fontSize: "13px", fontWeight: 600 }}>
              {enrichedTableRows.length} entidad{enrichedTableRows.length !== 1 ? "es" : ""} con nombre &quot;{selectedName}&quot; — {(() => {
                const row = enrichedTableRows[0];
                const afs = row.resolvedAF || extractAllAFFromTags(row.tags);
                return `${afs.length} tag${afs.length !== 1 ? "s" : ""}`;
              })()}
            </Text>
            <EntityTable data={enrichedTableRows} loading={false} showTypeColumn={false} />
          </Flex>
        )}
        {isAppType && selectedIds.length > 0 && !appAfReady && (
          <Flex alignItems="center" justifyContent="center" style={{ padding: "24px" }}>
            <Text style={{ fontSize: "13px", opacity: 0.6 }}>Cargando tags heredadas de servicios...</Text>
          </Flex>
        )}

        {/* Empty state */}
        {!selectedCategory && (
          <Flex alignItems="center" justifyContent="center" style={{ padding: "48px", opacity: 0.5 }}>
            <Text>Selecciona un tipo de entidad para empezar</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
