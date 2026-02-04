"use client";

import { useState, useMemo } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: string[];
  filterOptions?: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
  }[];
  exportFilename?: string;
  actions?: (item: T) => React.ReactNode;
  bulkActions?: React.ReactNode;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export default function DataTable<T extends { id: string }>({
  data,
  columns,
  searchKeys = [],
  filterOptions = [],
  exportFilename,
  actions,
  bulkActions,
  selectedIds = [],
  onSelectionChange
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (search && searchKeys.length > 0) {
      const searchLower = search.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = getNestedValue(item, key);
          return value && String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        result = result.filter((item) => {
          const itemValue = getNestedValue(item, key);
          return String(itemValue) === value;
        });
      }
    }

    // Apply sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = getNestedValue(a, sortKey);
        const bVal = getNestedValue(b, sortKey);
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, search, searchKeys, filters, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExport = () => {
    if (!exportFilename) return;

    const headers = columns.map((col) => col.label);
    const rows = filteredData.map((item) =>
      columns.map((col) => {
        const value = getNestedValue(item, col.key);
        return typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      })
    );

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFilename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === filteredData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredData.map((item) => item.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="data-table-container">
      <div className="data-table-controls">
        <div className="data-table-search-filters">
          {searchKeys.length > 0 && (
            <input
              type="text"
              className="input data-table-search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {filterOptions.map((filter) => (
            <select
              key={filter.key}
              className="input data-table-filter"
              value={filters[filter.key] || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, [filter.key]: e.target.value }))
              }
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>
        <div className="data-table-actions">
          {bulkActions && selectedIds.length > 0 && (
            <div className="data-table-bulk-actions">
              <span>{selectedIds.length} selected</span>
              {bulkActions}
            </div>
          )}
          {exportFilename && (
            <button className="button small" onClick={handleExport}>
              Export CSV
            </button>
          )}
        </div>
      </div>

      <table className="table data-table">
        <thead>
          <tr>
            {onSelectionChange && (
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                style={{ cursor: col.sortable !== false ? "pointer" : "default" }}
              >
                {col.label}
                {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
              </th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filteredData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectionChange ? 1 : 0) + (actions ? 1 : 0)}>
                No data found.
              </td>
            </tr>
          ) : (
            filteredData.map((item) => (
              <tr key={item.id}>
                {onSelectionChange && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => handleSelectOne(item.id)}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(item) : String(getNestedValue(item, col.key) ?? "")}
                  </td>
                ))}
                {actions && <td>{actions(item)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="data-table-footer">
        Showing {filteredData.length} of {data.length} records
      </div>
    </div>
  );
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
