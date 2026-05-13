import React, { useMemo } from "react";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { Link } from "react-router-dom";
import { Link as StratoLink } from "@dynatrace/strato-components/typography";
import { AFBadge } from "./AFBadge";
import { extractAFFromTags, extractAllAFFromTags, ENTITY_TYPE_LABELS } from "../utils/entity-types";
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
        // If pre-resolved AF is available (e.g. cluster aggregation), use it
        if (rowData.resolvedAF && rowData.resolvedAF.length > 0) {
          return <AFBadge af={rowData.resolvedAF} source={rowData.afSource || "aggregated-namespaces"} />;
        }
        const tags = (value as string[]) || [];
        const allAF = extractAllAFFromTags(tags);
        if (allAF.length > 0) {
          return <AFBadge af={allAF} source="direct" />;
        }
        return <AFBadge af={null} source="none" />;
      },
    });

    return cols;
  }, [showTypeColumn]);

  return (
    <DataTable
      data={data}
      columns={columns}
      sortable
      loading={loading}
    >
      <DataTable.Pagination defaultPageSize={25} />
    </DataTable>
  );
};
