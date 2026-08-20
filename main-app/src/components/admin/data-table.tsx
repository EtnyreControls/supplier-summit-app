"use client";
import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

/**
 * Generic sortable-free CRUD table used by every /admin/* screen — columns
 * are config, not per-page markup, so each entity screen only needs to
 * describe its shape once.
 */
export function DataTable<T extends { id: string }>({
  title,
  columns,
  rows,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {onAdd && (
          <Button size="small" variant="contained" color="primary" startIcon={<AddRoundedIcon />} onClick={onAdd}>
            Add
          </Button>
        )}
      </div>
      <TableContainer component={Paper} variant="outlined" className="mt-2">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key}>{c.label}</TableCell>
              ))}
              {(onEdit || onDelete) && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </TableCell>
                ))}
                {(onEdit || onDelete) && (
                  <TableCell align="right">
                    {onEdit && (
                      <IconButton size="small" aria-label="Edit" onClick={() => onEdit(row)}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    )}
                    {onDelete && (
                      <IconButton size="small" aria-label="Delete" onClick={() => onDelete(row)}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1}>
                  <span className="text-sm text-grey-500">No rows yet.</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
