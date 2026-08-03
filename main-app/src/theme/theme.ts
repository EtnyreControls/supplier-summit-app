"use client";
import { createTheme } from "@mui/material/styles";

/** Etnyre Summit palette — mirrors the CSS variables in globals.css. */
export const tokens = {
  yellow: "#FFED00",
  yellowHover: "#F0E000",
  yellowPressed: "#DDCE00",
  yellowTint: "#FFFBD1",
  onYellow: "#1C1C1E",
  ink: "#1C1C1E",
  secondaryAccent: "#1C1C1E",
  grey: {
    800: "#2A2A2E",
    700: "#4A4A4C",
    600: "#6B6A6C",
    500: "#8A898B",
    400: "#ABAAAC",
    300: "#C8C7C9",
    200: "#DEDEDD",
    100: "#EEEDEB",
    50: "#F7F6F3",
  },
  amber: {
    100: "#FCE9D2",
    300: "#FBB96A",
    500: "#F98719",
    700: "#C56508",
    900: "#9A5108",
  },
} as const;

const radiusControl = 10;
const radiusCard = 14;

/* CSS variables from globals.css. These flip under .dark, so any override
   referencing them is automatically dark-mode-aware. */
const v = {
  ink: "var(--summit-ink)",
  surface: "var(--summit-surface)",
  background: "var(--background)",
  onYellow: "var(--summit-on-yellow)",
  yellowTint: "var(--summit-yellow-tint)",
  secondaryAccent: "var(--summit-secondary-accent)",
  grey: (n: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800) => `var(--summit-grey-${n})`,
  amber: (n: 100 | 300 | 500 | 700 | 900) => `var(--summit-amber-${n})`,
};

/**
 * Conventions
 * - primary   = brand yellow. Content on yellow is ALWAYS #1C1C1E (on-yellow),
 *   in both light and dark mode — but the yellow itself now flips to a
 *   muted #F0E54C in dark mode (dark-mode-palette.css handoff).
 * - secondary = ink (flips to light in dark mode). Distinct from the new
 *   --summit-secondary-accent token (v.secondaryAccent) added by the same
 *   handoff — that one's a muted grey, not wired into this MUI role.
 * - error/warning = candy-corn amber ramp (no red in this brand).
 * - success   = fixed dark chip (#2A2A2E) with yellow icon in BOTH modes —
 *   there is no green in the brand, and the dark pill reads on any surface.
 * - Dark mode: tokens flip via the .dark class (see globals.css); MUI applies
 *   that class through colorSchemeSelector below, so Tailwind follows too.
 */
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: tokens.yellow, dark: tokens.yellowPressed, light: tokens.yellowTint, contrastText: tokens.onYellow },
        secondary: { main: tokens.ink, contrastText: "#FFFFFF" },
        error: { main: tokens.amber[500], dark: tokens.amber[700], light: tokens.amber[100], contrastText: tokens.onYellow },
        warning: { main: tokens.amber[500], dark: tokens.amber[700], light: tokens.amber[100], contrastText: tokens.onYellow },
        success: { main: tokens.grey[800], contrastText: "#FFFFFF" },
        info: { main: tokens.grey[700], contrastText: "#FFFFFF" },
        text: { primary: tokens.ink, secondary: tokens.grey[600], disabled: tokens.grey[400] },
        divider: tokens.grey[200],
        background: { default: "#FFFFFF", paper: "#FFFFFF" },
        grey: tokens.grey,
      },
    },
    dark: {
      palette: {
        // dark-mode-palette.css / dark-mode-palette (1).css handoff, 1:1 swap
        // (mirrors globals.css's .dark block — see there for the full ramp).
        // main: full-saturation cooler yellow, not the handoff's muted/olive
        // #F0E54C; light (tint): matched to the nav bar's shade, not the
        // handoff's warm brown #2B2703 — see globals.css's --summit-yellow(-tint)
        // comments for why.
        primary: { main: "#E6D600", dark: tokens.yellowPressed, light: "#201F1C", contrastText: tokens.onYellow },
        secondary: { main: "#E2E2E2", contrastText: tokens.ink },
        error: { main: tokens.amber[300], dark: "#FBA94C", light: "#3B2A14", contrastText: tokens.ink },
        warning: { main: tokens.amber[300], dark: "#FBA94C", light: "#3B2A14", contrastText: tokens.ink },
        success: { main: tokens.grey[800], contrastText: "#FFFFFF" },
        info: { main: "#C5C4C8", contrastText: tokens.ink },
        text: { primary: "#E2E2E2", secondary: "#A9A8AC", disabled: "#545355" },
        divider: "#333338",
        background: { default: "#121212", paper: "#201F1C" },
      },
    },
  },
  shape: { borderRadius: radiusControl },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
    h1: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h2: { fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontSize: "1.125rem", fontWeight: 600 },
    subtitle1: { fontSize: "0.9375rem", fontWeight: 600 },
    subtitle2: { fontSize: "0.8125rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const },
    body1: { fontSize: "0.9375rem", lineHeight: 1.6 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.55 },
    button: { textTransform: "none" as const, fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radiusControl,
          paddingInline: 18,
          minHeight: 44,
          variants: [
            {
              props: { variant: "contained", color: "primary" },
              style: {
                color: tokens.onYellow,
                "&:hover": { backgroundColor: tokens.yellowHover },
                "&:active": { backgroundColor: tokens.yellowPressed },
              },
            },
            {
              // Ghost (text) buttons must never render in brand yellow —
              // yellow text on the page/surface background fails contrast.
              // MUI defaults color to "primary" when a call site omits it,
              // so a bare <Button variant="text"> would come out yellow;
              // remap it to the same ink treatment as the secondary ghost.
              props: { variant: "text", color: "primary" },
              style: {
                color: v.ink,
                "&:hover": { backgroundColor: v.grey(100) },
              },
            },
            {
              // Same contrast failure as the text-variant case above, just
              // for outlined ghost buttons — a bare <Button variant="outlined">
              // (no color) also defaults to "primary" and renders a yellow
              // border/text combo that fails contrast (see /speaker's
              // Decline button, which hit this before color="secondary" was
              // added explicitly there). Remap the default here too so
              // omitting color is safe everywhere, not just at that one
              // call site.
              props: { variant: "outlined", color: "primary" },
              style: {
                color: v.ink,
                borderColor: v.grey(300),
                "&:hover": { borderColor: v.ink, backgroundColor: v.grey(50) },
              },
            },
            {
              props: { variant: "outlined", color: "secondary" },
              style: {
                borderColor: v.grey(300),
                "&:hover": { borderColor: v.ink, backgroundColor: v.grey(50) },
              },
            },
            {
              props: { variant: "contained", color: "error" },
              style: {
                color: "#FFFFFF",
                backgroundColor: tokens.amber[700],
                "&:hover": { backgroundColor: tokens.amber[900] },
              },
            },
          ],
        },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: radiusControl } },
    },
    MuiFab: {
      defaultProps: { color: "primary" },
      styleOverrides: {
        root: {
          color: tokens.onYellow,
          boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
          "&:hover": { backgroundColor: tokens.yellowHover },
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radiusControl,
          backgroundColor: v.surface,
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: v.grey(500) },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: v.ink, borderWidth: 2 },
        },
        notchedOutline: { borderColor: v.grey(300) },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { "&.Mui-focused": { color: v.ink } } },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999 },
        colorPrimary: { color: tokens.onYellow },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          "& .MuiSwitch-switchBase.Mui-checked": { color: tokens.yellow },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: v.ink, opacity: 1 },
          "& .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb": { border: `1px solid ${tokens.onYellow}` },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: { root: { color: v.grey(400), "&.Mui-checked": { color: v.ink } } },
    },
    MuiRadio: {
      styleOverrides: { root: { color: v.grey(400), "&.Mui-checked": { color: v.ink } } },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { backgroundColor: tokens.yellow, height: 3, borderRadius: 3 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, "&.Mui-selected": { color: v.ink } },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 8, borderRadius: 999, backgroundColor: v.grey(100) },
        bar: { borderRadius: 999, backgroundColor: tokens.yellow },
      },
    },
    MuiCircularProgress: {
      styleOverrides: { colorPrimary: { color: v.ink } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radiusCard, padding: 4, backgroundImage: "none" } },
    },
    MuiPaper: {
      styleOverrides: { rounded: { borderRadius: radiusCard }, root: { backgroundImage: "none" } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radiusCard,
          border: `1px solid ${v.grey(200)}`,
          boxShadow: "none",
          backgroundColor: v.surface,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: radiusControl,
          variants: [
            {
              props: { severity: "error", variant: "standard" },
              style: { backgroundColor: v.amber(100), color: v.amber(900), "& .MuiAlert-icon": { color: v.amber(700) } },
            },
            {
              props: { severity: "warning", variant: "standard" },
              style: { backgroundColor: v.amber(100), color: v.amber(900), "& .MuiAlert-icon": { color: v.amber(700) } },
            },
            {
              props: { severity: "success", variant: "standard" },
              style: { backgroundColor: "#2A2A2E", color: "#FFFFFF", "& .MuiAlert-icon": { color: tokens.yellow } },
            },
            {
              props: { severity: "info", variant: "standard" },
              style: { backgroundColor: v.grey(100), color: v.ink, "& .MuiAlert-icon": { color: v.grey(700) } },
            },
          ],
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: v.grey(200),
          "&.Mui-active": { color: tokens.yellow, "& .MuiStepIcon-text": { fill: tokens.onYellow } },
          "&.Mui-completed": { color: v.ink },
        },
        text: { fill: v.grey(600), fontWeight: 700 },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: { root: { borderTop: `1px solid ${v.grey(200)}`, backgroundColor: v.surface } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { color: v.grey(500), "&.Mui-selected": { color: v.ink } },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: {
        root: { backgroundColor: v.surface, borderBottom: `1px solid ${v.grey(200)}`, backgroundImage: "none" },
      },
    },
    MuiAvatar: {
      styleOverrides: { root: { backgroundColor: v.grey(100), color: v.ink, fontWeight: 600 } },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: v.grey(100) } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { backgroundColor: v.ink, color: v.background, fontSize: "0.75rem" } },
    },
  },
});

export default theme;
