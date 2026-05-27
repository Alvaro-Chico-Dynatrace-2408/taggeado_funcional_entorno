import React, { useMemo } from "react";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { Link } from "react-router-dom";
import { Link as StratoLink } from "@dynatrace/strato-components/typography";
import { AFBadge } from "./AFBadge";
import { extractAllAFFromTags, ENTITY_TYPE_LABELS, isK8sEntityType } from "../utils/entity-types";
import type { EntityType, AFSource } from "../utils/entity-types";

export interface EntityRow {
  id: string;
  name: string;
  type: EntityType;
  tags: string[];
  /** Pre-resolved AF values (e.g. aggregated from children) */
  resolvedAF?: string[];
  afSource?: AFSource;
}

interface EntityTableProps {
  data: EntityRow[];
  loading?: boolean;
  showTypeColumn?: boolean;
  onRowClick?: (entity: EntityRow) => void;
}

export const EntityTable = ({ data, loading, showTypeColumn = true, onRowClick }: EntityTableProps) => {
  const columns = useMemo<DataTableColumnDef<EntityRow>[]>(() => {
    const cols: DataTableColumnDef<EntityRow>[] = [
      {
        id: "name",
        header: "Nombre",
        accessor: "name",
        cell: ({ value, rowData }) => (
          <StratoLink as={Link} to={`/entity/${rowData.type}/${rowData.id}`}>
            {String(value)}
          </StratoLink>
        ),
      },
      {
        id: "id",
        header: "ID",
        accessor: "id",
        cell: ({ value }) => (
          <span style={{ fontSize: "12px" }}>{String(value)}</span>
        ),
      },
    ];

    if (showTypeColumn) {
      cols.push({
        id: "type",
        header: "Tipo",
        accessor: "type",
        cell: ({ value }) => <>{ENTITY_TYPE_LABELS[value as EntityType] || String(value)}</>,
      });
    }

    cols.push({
      id: "af",
      header: "AF",
      accessor: "tags",
      cell: ({ value, rowData }) => {
        const tone = isK8sEntityType(rowData.type) ? "k8s" : "non-k8s";
        // If pre-resolved AF is available (e.g. cluster aggregation), use it
        if (rowData.resolvedAF && rowData.resolvedAF.length > 0) {
          return <AFBadge af={rowData.resolvedAF} source={rowData.afSource || "aggregated-namespaces"} tone={tone} />;
        }
        const tags = (value as string[]) || [];
        const allAF = extractAllAFFromTags(tags);
        if (allAF.length > 0) {
          return <AFBadge af={allAF} source="direct" tone={tone} />;
        }
        return <AFBadge af={null} source="none" tone={tone} />;
      },
    });

    return cols;
  }, [showTypeColumn]);

  return (
    <div style={{ width: "100%" }}>
    <DataTable
      data={data}
      columns={columns}
      sortable
      resizable
      loading={loading}
      fullWidth
    >
      <DataTable.Pagination defaultPageSize={25} />
    </DataTable>
    </div>
  );
};
