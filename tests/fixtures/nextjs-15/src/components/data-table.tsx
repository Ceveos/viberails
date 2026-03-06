import React, { useCallback, useMemo, useState } from "react";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  width?: number;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

interface PaginationState {
  currentPage: number;
  pageSize: number;
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  let result: number;
  if (typeof a === "string" && typeof b === "string") {
    result = a.localeCompare(b);
  } else if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b));
  }

  return direction === "desc" ? -result : result;
}

function filterData<T>(data: T[], query: string, columns: Column<T>[]): T[] {
  if (!query.trim()) return data;
  const lower = query.toLowerCase();

  return data.filter((row) =>
    columns.some((col) => {
      const value = row[col.key];
      if (value == null) return false;
      return String(value).toLowerCase().includes(lower);
    }),
  );
}

function sortData<T>(
  data: T[],
  sort: SortState,
): T[] {
  if (!sort.column || !sort.direction) return data;

  return [...data].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sort.column!];
    const bVal = (b as Record<string, unknown>)[sort.column!];
    return compareValues(aVal, bVal, sort.direction);
  });
}

function paginateData<T>(
  data: T[],
  pagination: PaginationState,
): T[] {
  const start = (pagination.currentPage - 1) * pagination.pageSize;
  return data.slice(start, start + pagination.pageSize);
}

function getSortIndicator(column: string, sort: SortState): string {
  if (sort.column !== column) return "";
  if (sort.direction === "asc") return " \u2191";
  if (sort.direction === "desc") return " \u2193";
  return "";
}

function getPageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  searchable = false,
  onRowClick,
  emptyMessage = "No data available.",
  className = "",
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize,
  });

  const handleSort = useCallback(
    (columnKey: string) => {
      setSort((prev) => {
        if (prev.column !== columnKey) {
          return { column: columnKey, direction: "asc" };
        }
        if (prev.direction === "asc") {
          return { column: columnKey, direction: "desc" };
        }
        return { column: null, direction: null };
      });
      setPagination((prev) => ({ ...prev, currentPage: 1 }));
    },
    [],
  );

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  }, []);

  const filteredData = useMemo(
    () => filterData(data, searchQuery, columns),
    [data, searchQuery, columns],
  );

  const sortedData = useMemo(
    () => sortData(filteredData, sort),
    [filteredData, sort],
  );

  const totalPages = getPageCount(sortedData.length, pagination.pageSize);
  const paginatedData = paginateData(sortedData, pagination);
  const visiblePages = getVisiblePages(pagination.currentPage, totalPages);

  return (
    <div className={`overflow-hidden rounded-lg border ${className}`}>
      {searchable && (
        <div className="border-b p-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-medium text-gray-700 ${
                    col.sortable ? "cursor-pointer select-none hover:bg-gray-100" : ""
                  }`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.header}
                  {col.sortable && getSortIndicator(col.key, sort)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={`${
                    onRowClick ? "cursor-pointer hover:bg-gray-50" : ""
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-gray-600">
            Showing {(pagination.currentPage - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(
              pagination.currentPage * pagination.pageSize,
              sortedData.length,
            )}{" "}
            of {sortedData.length} results
          </span>

          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Previous
            </button>

            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`rounded px-3 py-1 text-sm ${
                  page === pagination.currentPage
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === totalPages}
              className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function createColumn<T>(
  key: keyof T & string,
  header: string,
  options: Partial<Omit<Column<T>, "key" | "header">> = {},
): Column<T> {
  return { key, header, sortable: true, ...options };
}

export function formatCellValue(value: unknown): string {
  if (value == null) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function getRowId<T extends Record<string, unknown>>(
  row: T,
  idKey = "id",
): string {
  const value = row[idKey];
  return value != null ? String(value) : "";
}
