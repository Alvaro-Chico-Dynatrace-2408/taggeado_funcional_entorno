import React, { useState, useCallback } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { SearchBar } from "../components/SearchBar";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import { ALL_SEARCHABLE_TYPES, ENTITY_TYPE_LABELS } from "../utils/entity-types";
import type { EntityType } from "../utils/entity-types";
import { buildSearchByName } from "../utils/dql-queries";

export const SearchView = () => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeType, setActiveType] = useState<EntityType>("host");

  const query = searchTerm ? buildSearchByName(activeType, searchTerm) : null;
  const { data, isLoading } = useDql(
    query ? { query } : { query: "" },
    { enabled: !!query }
  );

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const results: EntityRow[] = React.useMemo(() => {
    if (!data?.records) return [];
    return data.records.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        id: rec.id as string,
        name: (rec["entity.name"] as string) || "",
        type: activeType,
        tags: (rec.tags as string[]) || [],
      };
    });
  }, [data, activeType]);

  return (
    <Flex flexDirection="column" padding={16} gap={16}>
      <Heading level={4}>Búsqueda Universal de Entidades</Heading>
      <SearchBar onSearch={handleSearch} />

      <Flex gap={8} style={{ flexWrap: "wrap" }}>
        {ALL_SEARCHABLE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            style={{
              padding: "4px 12px",
              borderRadius: "4px",
              border: activeType === type ? "2px solid #6b2fff" : "1px solid #ccc",
              background: activeType === type ? "#f0e8ff" : "transparent",
              cursor: "pointer",
              fontWeight: activeType === type ? 600 : 400,
            }}
          >
            {ENTITY_TYPE_LABELS[type]}
          </button>
        ))}
      </Flex>

      {searchTerm && (
        <EntityTable data={results} loading={isLoading} showTypeColumn={false} />
      )}
    </Flex>
  );
};
