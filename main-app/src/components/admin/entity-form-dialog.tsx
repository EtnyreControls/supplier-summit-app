"use client";
import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Button from "@mui/material/Button";

export type EntityField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "datetime" | "checkbox" | "number";
  options?: { value: string; label: string }[];
  required?: boolean;
};

/**
 * Generic create/edit dialog driven by a field-config array — pairs with
 * data-table.tsx so each /admin/* entity screen only has to describe its
 * fields, not build a bespoke form.
 */
export function EntityFormDialog({
  open,
  title,
  fields,
  initialValues,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  fields: EntityField[];
  initialValues: Record<string, unknown>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, unknown>>(initialValues);
  // Reset the form's values when the dialog transitions closed → open,
  // adjusted during render (React's documented alternative to an effect
  // for "reset state when a prop changes") rather than in a useEffect.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setValues(initialValues);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const setField = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent className="flex flex-col gap-4 pt-2">
        {fields.map((f) => {
          const value = values[f.name];
          if (f.type === "checkbox") {
            return (
              <FormControlLabel
                key={f.name}
                control={<Checkbox checked={Boolean(value)} onChange={(e) => setField(f.name, e.target.checked)} />}
                label={f.label}
              />
            );
          }
          if (f.type === "select") {
            return (
              <TextField
                key={f.name}
                select
                label={f.label}
                value={(value as string) ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                required={f.required}
              >
                {f.options?.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            );
          }
          return (
            <TextField
              key={f.name}
              label={f.label}
              type={f.type === "datetime" ? "datetime-local" : f.type === "number" ? "number" : "text"}
              multiline={f.type === "textarea"}
              minRows={f.type === "textarea" ? 3 : undefined}
              value={(value as string) ?? ""}
              onChange={(e) => setField(f.name, e.target.value)}
              required={f.required}
              slotProps={f.type === "datetime" ? { inputLabel: { shrink: true } } : undefined}
            />
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" disabled={submitting} onClick={() => onSubmit(values)}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
