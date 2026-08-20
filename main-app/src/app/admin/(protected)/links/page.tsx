import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

/**
 * Quick-access external dashboards for IT/admin staff. URLs are derived
 * from what's actually configured for this project:
 *  - GitHub: `git remote -v` → EtnyreControls/supplier-summit-app
 *  - Supabase: project ref from NEXT_PUBLIC_SUPABASE_URL (main-app/.env)
 *  - Azure: the Web App deploy target from
 *    .github/workflows/main_app-etnyre-supplier-prod.yml
 *    (app-etnyre-supplier-prod) — links to the Portal's Web Apps browse
 *    view rather than a specific resource ID, since the subscription/
 *    resource group aren't available outside the masked deploy secrets.
 */
const SUPABASE_PROJECT_REF = "ndnjshkfgvspztisfipa";

const LINKS = [
  {
    label: "GitHub repository",
    description: "EtnyreControls/supplier-summit-app",
    href: "https://github.com/EtnyreControls/supplier-summit-app",
  },
  {
    label: "Supabase dashboard",
    description: "Database, auth, RLS policies, Realtime",
    href: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}`,
  },
  {
    label: "Azure Portal — Web Apps",
    description: 'Find "app-etnyre-supplier-prod" (and the sync server, if deployed separately)',
    href: "https://portal.azure.com/#browse/Microsoft.Web%2Fsites",
  },
];

export default function AdminLinksPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-ink">Quick links</h1>
      <p className="mt-1 text-sm text-grey-600">External dashboards for this app&apos;s infrastructure.</p>

      <ul className="mt-6 flex flex-col gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-(--radius-card) border border-grey-200 p-4 hover:border-grey-400"
            >
              <div>
                <p className="text-sm font-medium text-ink">{link.label}</p>
                <p className="mt-0.5 text-xs text-grey-500">{link.description}</p>
              </div>
              <OpenInNewRoundedIcon fontSize="small" className="text-grey-400" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
