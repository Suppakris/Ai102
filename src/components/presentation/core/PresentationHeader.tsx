"use client";

import { ArrowLeft, Palette } from "lucide-react";
import * as motion from "motion/react-client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Import our new components
import { updatePresentationTitle } from "@/app/_actions/notebook/presentation/presentationActions";
import AllweoneText from "@/components/globals/allweone-logo";
import { ExportButton } from "@/components/presentation/buttons/ExportButton";
import { PresentButton } from "@/components/presentation/buttons/PresentButton";
import { ReviewButton } from "@/components/presentation/buttons/ReviewButton";
import { PresentationMenu } from "@/components/presentation/controls/PresentationMenu";
import { SystemStatusBadge } from "@/components/presentation/core/SystemStatusBadge";
import { PresentationSavingIndicator } from "@/components/presentation/core/PresentationSavingIndicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePresentationState } from "@/states/presentation-state";
import { ThemeToggleIcon } from "@/provider/theme-provider";
import { AppMenu } from "@/components/presentation/core/AppMenu";
import { UserAvatarMenu } from "@/components/presentation/core/UserAvatarMenu";

interface PresentationHeaderProps {
  title?: string;
}

export default function PresentationHeader({ title }: PresentationHeaderProps) {
  const currentPresentationTitle = usePresentationState(
    (s) => s.currentPresentationTitle,
  );
  const isPresenting = usePresentationState((s) => s.isPresenting);
  const currentPresentationId = usePresentationState(
    (s) => s.currentPresentationId,
  );
  const isReadOnly = usePresentationState((s) => s.isReadOnly);
  const setActiveRightPanel = usePresentationState(
    (s) => s.setActiveRightPanel,
  );

  const { status } = useSession();

  const [presentationTitle, setPresentationTitle] = useState<string>(
    "Presentation",
  );
  const pathname = usePathname();

  const isPresentationPage =
    (pathname.startsWith("/presentation/") ||
      pathname.startsWith("/share/presentation/")) &&
    !pathname.includes("generate");
  const showPresentationTitle = pathname !== "/presentation";

  const isLoggedOut = status === "unauthenticated";
  const showBrand = isLoggedOut;

  // Update title when it changes in the state
  useEffect(() => {
    if (currentPresentationTitle) {
      setPresentationTitle(currentPresentationTitle);
    } else if (title) {
      setPresentationTitle(title);
    }
  }, [currentPresentationTitle, title]);

  if (pathname === "/presentation/create")
    return (
      <header
        className="notranslate flex min-h-12 w-full max-w-screen items-center justify-between gap-2 overflow-clip border-accent px-2 py-2"
        translate="no"
      >
        <div className="flex min-w-0 items-center gap-2">
          <AppMenu />

          <motion.div
            initial={false}
            layout="position"
            transition={{ duration: 1 }}
          >
            <Link href="/" className="h-max">
              <AllweoneText className="h-10 w-30 cursor-pointer transition-transform duration-100 active:scale-95"></AllweoneText>
            </Link>
          </motion.div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggleIcon />
          <SystemStatusBadge />
        </div>

        {/* <SideBarDropdown /> */}
      </header>
    );

  return (
    <header
      className="notranslate glass-panel flex min-h-12 w-full items-center justify-between gap-3 overflow-hidden border-b border-border/60 px-3 py-2 sm:px-4"
      translate="no"
    >
      {/* Left section with breadcrumb navigation */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showBrand ? (
          <Link href="/">
            <AllweoneText className="h-8 w-28" />
          </Link>
        ) : (
          <AppMenu />
        )}
        {/* Explicit back-to-dashboard link on the edit page -- Dashboard
            is also reachable via the hamburger menu, but that wasn't
            discoverable enough on its own. */}
        {isPresentationPage && !isPresenting && !isLoggedOut && (
          <Link
            href="/presentation"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to dashboard</span>
          </Link>
        )}
        {isLoggedOut && showPresentationTitle ? (
          <span className="truncate text-sm font-medium text-foreground sm:hidden">
            {presentationTitle}
          </span>
        ) : !isLoggedOut && showPresentationTitle ? (
          <Input
            type="text"
            id="presentation-title-input"
            value={presentationTitle}
            onChange={(e) => setPresentationTitle(e.target.value)}
            disabled={isReadOnly}
            onBlur={async () => {
              if (isReadOnly) {
                return;
              }
              if (
                presentationTitle &&
                currentPresentationTitle !== presentationTitle &&
                currentPresentationId
              ) {
                try {
                  await updatePresentationTitle(
                    currentPresentationId,
                    presentationTitle,
                  );
                } catch {
                  setPresentationTitle(currentPresentationTitle || "");
                }
              }
            }}
            className="line-clamp-1 h-auto min-w-0 flex-1 cursor-text rounded-xs border-none bg-transparent p-0 font-medium text-ellipsis shadow-none outline-none sm:max-w-96"
            style={{
              appearance: "none",
            }}
          />
        ) : null}
        {/* Document menu (File/Edit/View) rides with the title as a chevron
            so it can't be mistaken for the app-wide hamburger menu */}
        {isPresentationPage && !isLoggedOut && (
          <PresentationMenu readOnly={isReadOnly} />
        )}
      </div>

      {isLoggedOut && showPresentationTitle ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 w-[min(60vw,40rem)] -translate-x-1/2 -translate-y-1/2 px-3 text-center">
          <span className="line-clamp-1 text-lg font-medium text-foreground">
            {presentationTitle}
          </span>
        </div>
      ) : null}

      {/* Right section with actions */}
      <div className="scrollbar-hide flex max-w-[56vw] shrink-0 items-center gap-2 overflow-x-auto md:max-w-none md:overflow-visible">
        {/* Light/dark toggle - app follows system theme until toggled here */}
        {!isPresenting && <ThemeToggleIcon />}

        {/* Backend status - always visible since generation depends on it */}
        {!isPresenting && <SystemStatusBadge />}

        {/* Saving indicator - Placed right before Theme button */}
        {isPresentationPage && !isPresenting && !isReadOnly && (
          <PresentationSavingIndicator />
        )}

        {/* Theme button - Only in presentation page, not outline or present mode */}
        {isPresentationPage && !isPresenting && !isReadOnly && (
          <Button
            variant="ghost"
            className="h-9 gap-1.5"
            onClick={() => setActiveRightPanel("theme")}
          >
            <Palette className="size-4" />
            <span className="sr-only">
              Theme
            </span>
            <span className="hidden sm:inline">
              Theme
            </span>
          </Button>
        )}

        {/* AI deck review - Only in presentation page, not outline or present mode */}
        {isPresentationPage && !isPresenting && !isReadOnly && <ReviewButton />}

        {/* Export button - Only in presentation page, not outline or present mode */}
        {isPresentationPage && !isPresenting && !isReadOnly && <ExportButton />}

        {/* Present button - Only in presentation page, not outline */}
        {isPresentationPage && <PresentButton />}

        {/* Account avatar - hidden while presenting */}
        {!isPresenting && <UserAvatarMenu />}
      </div>
    </header>
  );
}
