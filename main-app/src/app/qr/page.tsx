"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NavLogo, ModeToggle } from "@/components";
import { handleQrScan } from "./actions";

/**
 * Route: /qr?t=<badge token>
 * The only destination every badge QR points to. No form — fires on mount
 * and lets the server action decide login vs. contact-save vs. no-op based
 * on whether this device already has a session (see actions.ts).
 */
export default function QrLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<"checking" | "done" | "error">("checking");
  const [message, setMessage] = React.useState("Checking badge…");

  React.useEffect(() => {
    const token = searchParams.get("t") ?? "";

    (async () => {
      const result = await handleQrScan(token);

      switch (result.mode) {
        case "login":
          if (result.error) {
            setStatus("error");
            setMessage(result.error);
            return;
          }
          setStatus("done");
          setMessage("Logged in — redirecting…");
          router.push("/welcome");
          router.refresh();
          return;
        case "redirect_login":
          setStatus("done");
          setMessage("This badge is already signed in elsewhere — please log in with your PIN.");
          router.push("/login");
          return;
        case "self":
          setStatus("done");
          setMessage("That's your own badge.");
          router.push("/welcome");
          return;
        case "contact":
          setStatus("done");
          setMessage(
            `Saved ${result.contact.name}${result.contact.company ? ` (${result.contact.company})` : ""} to your contacts.`,
          );
          router.push("/contacts");
          return;
        case "error":
          setStatus("error");
          setMessage(result.error);
          return;
      }
    })();
    // Runs once per mount — a badge scan is a one-shot action, not something
    // that should re-fire if searchParams identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex justify-end p-4">
        <ModeToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-20 text-center">
        <NavLogo />
        <p className={`text-sm ${status === "error" ? "text-red-600" : "text-grey-600"}`}>{message}</p>
        {status === "error" && (
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-semibold text-ink underline underline-offset-2"
          >
            Go to login
          </button>
        )}
      </div>
    </div>
  );
}
