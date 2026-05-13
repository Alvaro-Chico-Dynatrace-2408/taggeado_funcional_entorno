import React, { useState, useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { EntityTable, type EntityRow } from "../components/EntityTable";
import { BreadcrumbNav, type Breadcrumb } from "../components/BreadcrumbNav";
import {
  buildFetchAllByType,
  buildProcessGroupsFromHost,
  buildServicesFromProcessGroup,
} from "../utils/dql-queries";

type DrillLevel = "hosts" | "process_groups" | "services";

interface Selection {
  hostId?: string;
  hostName?: string;
  pgId?: string;
  pgName?: string;
}

export const NonKubernetesView = () => {
  const [level, setLevel] = useState<DrillLevel>("hosts");
  const [selection, setSelection] = useState<Selection>({});

  const query = useMemo(() => {
    switch (level) {
      case "hosts":
        return buildFetchAllByType("host");
      case "process_groups":
        return selection.hostId ? buildProcessGroupsFromHost(selection.hostId) : null;
      case "services":
        return selection.pgId ? buildServicesFromProcessGroup(selection.pgId) : null;
      default:
        return null;
    }
  }, [level, selection]);

  const { data, isLoading } = useDql(
    query ? { query } : { query: "" },
    { enabled: !!query }
  );

  const entityType = useMemo(() => {
    switch (level) {
      case "hosts": return "host" as const;
      case "process_groups": return "process_group" as const;
      case "services": return "service" as const;
    }
  }, [level]);

  const rows: EntityRow[] = useMemo(() => {
    if (!data?.records) return [];
    return data.records.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        id: rec.id as string,
        name: (rec["entity.name"] as string) || "",
        type: entityType,
        tags: (rec.tags as string[]) || [],
      };
    });
  }, [data, entityType]);

  const breadcrumbs: Breadcrumb[] = useMemo(() => {
    const items: Breadcrumb[] = [{ label: "Hosts" }];

    if (level === "hosts") return items;

    items[0] = { label: "Hosts", path: "/non-kubernetes" };

    if (level === "process_groups" || level === "services") {
      items.push({
        label: selection.hostName || "Process Groups",
        path: level === "process_groups" ? undefined : "/non-kubernetes",
      });
    }
    if (level === "services") {
      items.push({
        label: selection.pgName || "Services",
      });
    }
    return items;
  }, [level, selection]);

  const handleRowClick = (entity: EntityRow) => {
    switch (level) {
      case "hosts":
        setSelection({ hostId: entity.id, hostName: entity.name });
        setLevel("process_groups");
        break;
      case "process_groups":
        setSelection((prev) => ({ ...prev, pgId: entity.id, pgName: entity.name }));
        setLevel("services");
        break;
    }
  };

  const handleReset = () => {
    setLevel("hosts");
    setSelection({});
  };

  return (
    <Flex flexDirection="column" padding={16} gap={16}>
      <Heading level={4}>Infraestructura No-Kubernetes</Heading>
      <BreadcrumbNav items={breadcrumbs} />

      {level !== "hosts" && (
        <button
          onClick={handleReset}
          style={{
            alignSelf: "flex-start",
            padding: "4px 12px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          ← Volver a Hosts
        </button>
      )}

      <Text>
        {level === "hosts" && "Selecciona un host para ver sus process groups"}
        {level === "process_groups" && `Process Groups del host: ${selection.hostName}`}
        {level === "services" && `Services del process group: ${selection.pgName}`}
      </Text>

      <div onClick={(e) => {
        const target = e.target as HTMLElement;
        const link = target.closest("a");
        if (link && level !== "services") {
          e.preventDefault();
          const row = rows.find((r) => link.href?.includes(r.id));
          if (row) handleRowClick(row);
        }
      }}>
        <EntityTable data={rows} loading={isLoading} showTypeColumn={false} />
      </div>
    </Flex>
  );
};
