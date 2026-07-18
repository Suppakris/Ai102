"use client";

import {
  fetchPresentations,
  type PresentationDocumentTypeFilter,
} from "@/app/_actions/notebook/presentation/fetchPresentations";
import { togglePresentationFavorite } from "@/app/_actions/notebook/presentation/presentationFavoriteActions";
import {
  createEmptyPresentation,
  deletePresentation,
  duplicatePresentation,
  updatePresentationTitle,
} from "@/app/_actions/notebook/presentation/presentationActions";
import { ModelPicker } from "@/components/notebook/presentation/components/ModelPicker";
import { useBlankPresentationCreator } from "@/hooks/presentation/useBlankPresentationCreator";
import {
  getPresentationGenerationAspectRatioLabel,
  type PresentationGenerationAspectRatio,
} from "@/lib/presentation/aspect-ratio";
import { buildPresentationCustomization } from "@/lib/presentation/customization";
import { LANGUAGE_OPTIONS } from "@/lib/presentation/languages";
import {
  isPdfFile,
  MAX_PDF_FILE_SIZE_BYTES,
} from "@/lib/presentation/source-document";
import { cn } from "@/lib/utils";
import { usePresentationState } from "@/states/presentation-state";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  FileText,
  Folder,
  Globe,
  Grid2X2,
  Languages,
  LayoutTemplate,
  List,
  Loader2,
  MoreVertical,
  PanelsTopLeft,
  Paperclip,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Credenza,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/ui/credenza";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRESENTATIONS_QUERY_KEY = ["presentations"] as const;
const ALL_PRESENTATION_DOCUMENT_TYPES = "ALL";
type PresentationDocumentTypeFilterValue =
  | typeof ALL_PRESENTATION_DOCUMENT_TYPES
  | PresentationDocumentTypeFilter;

type PresentationFileItem = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  modified: string;
  modifiedAt: Date;
  isFavorited: boolean;
  isFavoritePending: boolean;
  isRenamePending: boolean;
  isDeletePending: boolean;
  isDuplicatePending: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
  onRename: (nextName: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onDuplicate: () => void;
};

type PresentationPage = Awaited<ReturnType<typeof fetchPresentations>>;
type PresentationsInfiniteData = InfiniteData<PresentationPage, number>;
type FavoriteMutationVariables = {
  documentId: string;
  isFavorited: boolean;
};

type LibraryTab = "all" | "recent" | "favorites";
type ViewMode = "grid" | "list";
type SortBy = "date-desc" | "date-asc" | "name-asc" | "name-desc";

const SLIDE_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1} slide${index === 0 ? "" : "s"}`,
  value: String(index + 1),
}));

function getPresentationRoute(item: {
  hasContent: boolean;
  hasSlides: boolean;
  id: string;
}) {
  return item.hasSlides || item.hasContent
    ? `/presentation/${item.id}`
    : `/presentation/generate/${item.id}`;
}

function NotebookPageLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="notebook-section relative h-full w-full max-w-[100vw] min-w-0 overflow-x-hidden overflow-y-auto"
      style={{ scrollbarGutter: "stable" }}
    >
      <main className="mx-auto mt-4 w-full max-w-[min(100vw,72rem)] min-w-0 px-3 pb-8 sm:mt-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function GreetingSection() {
  return (
    <section className="mb-5 flex flex-col items-center gap-2 text-center sm:mb-6">
      <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
        What would you like to{" "}
        <span className="brand-gradient-text">create today?</span>
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Describe your topic and let AI draft, design, and review your deck.
      </p>
    </section>
  );
}

function SettingPill({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:h-9 sm:px-3.5 sm:text-sm"
        >
          <Icon className="size-3.5 shrink-0 sm:size-4" />
          <span className="truncate">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 max-w-[calc(100vw-1rem)] p-2"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotebookInputBox({
  placeholder,
  value,
  onChange,
  onSubmit,
  submitDisabled,
  isSubmitting,
  children,
  topRightContent,
  attachmentSlot,
  onPdfFile,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  isSubmitting: boolean;
  children: ReactNode;
  topRightContent?: ReactNode;
  attachmentSlot?: ReactNode;
  onPdfFile?: (file: File) => void;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragContainsFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setIsDragActive(false);
  };

  const dropHandlers = onPdfFile
    ? {
        onDragEnter: (event: React.DragEvent) => {
          if (!dragContainsFiles(event)) return;
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragActive(true);
        },
        onDragOver: (event: React.DragEvent) => {
          if (!dragContainsFiles(event)) return;
          event.preventDefault();
        },
        onDragLeave: (event: React.DragEvent) => {
          if (!dragContainsFiles(event)) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragActive(false);
          }
        },
        onDrop: (event: React.DragEvent) => {
          if (!dragContainsFiles(event)) return;
          event.preventDefault();
          resetDragState();
          const file = event.dataTransfer.files[0];
          if (file) {
            onPdfFile(file);
          }
        },
      }
    : {};

  return (
    <div
      className="relative mb-4 min-w-0 rounded-2xl border border-border bg-card p-2.5 shadow-lg shadow-primary/5 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 sm:p-4"
      {...dropHandlers}
    >
      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/90">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <FileText className="size-4" />
            Drop a PDF to use it as source material
          </p>
        </div>
      ) : null}
      {topRightContent ? (
        <div className="absolute top-2.5 right-2.5 z-10 sm:top-4 sm:right-4">
          {topRightContent}
        </div>
      ) : null}
      <textarea
        aria-label="Presentation prompt"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.ctrlKey && !submitDisabled) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className={cn(
          "mb-3 h-24 w-full min-w-0 resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none sm:h-30",
          topRightContent ? "pr-34 sm:pr-44" : undefined,
        )}
      />
      {attachmentSlot}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {onPdfFile ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onPdfFile(file);
                }
                event.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Attach a PDF as source material"
              title="Attach a PDF as source material"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-9"
            >
              <Paperclip className="size-4" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          aria-busy={isSubmitting}
          className={cn(
            "brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full shadow-md shadow-primary/30 transition-all sm:h-9 sm:w-9",
            isSubmitting
              ? "cursor-wait opacity-100"
              : "hover:brightness-110 disabled:opacity-50 disabled:shadow-none",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin text-white" />
          ) : (
            <ArrowRight className="size-4 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

/** Thumbnail that swaps to the provided fallback when the image URL is dead. */
function PresentationThumbnail({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return <>{fallback}</>;
  return (
    <Image
      unoptimized
      width={400}
      height={300}
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function PresentationFavoriteButton({
  file,
  className,
}: {
  file: PresentationFileItem;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={
        file.isFavorited
          ? `Remove ${file.name} from favorites`
          : `Add ${file.name} to favorites`
      }
      aria-pressed={file.isFavorited}
      title={file.isFavorited ? "Remove from favorites" : "Add to favorites"}
      disabled={file.isFavoritePending}
      onClick={(event) => {
        event.stopPropagation();
        file.onToggleFavorite();
      }}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-wait disabled:opacity-70",
        file.isFavorited && "text-yellow-500",
        className,
      )}
    >
      {file.isFavoritePending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Star
          className={cn(
            "size-4",
            file.isFavorited && "fill-yellow-400 text-yellow-500",
          )}
        />
      )}
    </button>
  );
}

function PresentationFileActionsMenu({
  file,
  onRenameRequest,
  onDeleteRequest,
}: {
  file: PresentationFileItem;
  onRenameRequest: (file: PresentationFileItem) => void;
  onDeleteRequest: (file: PresentationFileItem) => void;
}) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur hover:bg-background hover:text-foreground"
          >
            <MoreVertical className="size-4" />
            <span className="sr-only">Open presentation actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            disabled={file.isRenamePending}
            onClick={() => onRenameRequest(file)}
          >
            {file.isRenamePending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Pencil className="mr-2 size-4" />
            )}
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={file.isDuplicatePending}
            onClick={file.onDuplicate}
          >
            {file.isDuplicatePending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={file.isFavoritePending}
            onClick={file.onToggleFavorite}
          >
            {file.isFavoritePending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Star
                className={cn(
                  "mr-2 size-4",
                  file.isFavorited && "fill-yellow-400 text-yellow-400",
                )}
              />
            )}
            {file.isFavorited ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={file.isDeletePending}
            className="text-destructive focus:text-destructive"
            onClick={() => onDeleteRequest(file)}
          >
            {file.isDeletePending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 size-4" />
            )}
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PresentationProjectFilesSection({
  files,
  isLoading,
  onCreateNew,
  filterOptions,
  activeFilterId,
  onFilterChange,
  activeTab,
  onActiveTabChange,
  showFavoritesOnly,
  onShowFavoritesOnlyChange,
}: {
  files: PresentationFileItem[];
  isLoading?: boolean;
  onCreateNew: () => void;
  filterOptions: { id: string; label: string }[];
  activeFilterId: string;
  onFilterChange: (filterId: string) => void;
  activeTab: LibraryTab;
  onActiveTabChange: (tab: LibraryTab) => void;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (showFavoritesOnly: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [renameTarget, setRenameTarget] =
    useState<PresentationFileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<PresentationFileItem | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: LibraryTab; label: string; icon: LucideIcon }[] = [
    { id: "all", label: "All", icon: Archive },
    { id: "recent", label: "Recently viewed", icon: Clock3 },
    { id: "favorites", label: "Favorites", icon: Star },
  ];
  const sortOptions: { id: SortBy; label: string; icon: LucideIcon }[] = [
    { id: "date-desc", label: "Newest first", icon: Clock3 },
    { id: "date-asc", label: "Oldest first", icon: Clock3 },
    { id: "name-asc", label: "Name A-Z", icon: Grid2X2 },
    { id: "name-desc", label: "Name Z-A", icon: Grid2X2 },
  ];
  const shouldShowSearchInput = Boolean(searchQuery) || isSearchOpen;
  const activeFiltersCount =
    (showFavoritesOnly ? 1 : 0) +
    (activeFilterId !== filterOptions[0]?.id ? 1 : 0);
  const isRenamePending = renameTarget
    ? (files.find((file) => file.id === renameTarget.id)?.isRenamePending ??
      renameTarget.isRenamePending)
    : false;
  const isDeletePending = deleteTarget
    ? (files.find((file) => file.id === deleteTarget.id)?.isDeletePending ??
      deleteTarget.isDeletePending)
    : false;

  const openRenameDialog = (file: PresentationFileItem) => {
    setRenameTarget(file);
    setRenameValue(file.name);
  };

  const closeRenameDialog = () => {
    if (!isRenamePending) {
      setRenameTarget(null);
      setRenameValue("");
    }
  };

  const closeDeleteDialog = () => {
    if (!isDeletePending) {
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    if (!shouldShowSearchInput) return;

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [shouldShowSearchInput]);

  const visibleFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let nextFiles = files.filter((file) => {
      if (activeTab === "favorites" || showFavoritesOnly) {
        if (!file.isFavorited) return false;
      }
      return query ? file.name.toLowerCase().includes(query) : true;
    });

    nextFiles = [...nextFiles].sort((a, b) => {
      if (sortBy === "date-desc") {
        return b.modifiedAt.getTime() - a.modifiedAt.getTime();
      }
      if (sortBy === "date-asc") {
        return a.modifiedAt.getTime() - b.modifiedAt.getTime();
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      return a.name.localeCompare(b.name);
    });

    return nextFiles;
  }, [activeTab, files, searchQuery, showFavoritesOnly, sortBy]);

  return (
    <>
      <div className="max-w-full min-w-0 overflow-x-hidden">
      <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onActiveTabChange(tab.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1">
            <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:justify-end">
              <div className="order-2 shrink-0 sm:order-1">
                <div
                  className={cn(
                    "relative h-8.5 shrink-0 overflow-hidden transition-[width] duration-300 ease-out",
                    shouldShowSearchInput ? "w-36 sm:w-56 lg:w-64" : "w-8.5",
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSearchOpen(true)}
                    className={cn(
                      "absolute inset-0 size-8.5 p-0 transition-all duration-200 ease-out",
                      shouldShowSearchInput &&
                        "pointer-events-none scale-95 opacity-0",
                    )}
                  >
                    <Search className="size-4" />
                    <span className="sr-only">Search files</span>
                  </Button>
                  <div
                    className={cn(
                      "absolute inset-0 transition-all duration-300 ease-out",
                      shouldShowSearchInput
                        ? "translate-x-0 opacity-100"
                        : "pointer-events-none translate-x-2 opacity-0",
                    )}
                  >
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      aria-label="Search files"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-8.5 w-full min-w-0 rounded-lg border border-border bg-background py-1.5 pr-8 pl-9 text-sm text-foreground outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      aria-label="Close search"
                      onClick={() => {
                        setSearchQuery("");
                        setIsSearchOpen(false);
                      }}
                      className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="order-1 flex min-w-0 flex-row-reverse items-center gap-2 sm:order-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCreateNew}
                  className="h-8.5 gap-1.5 rounded-lg px-3"
                >
                  <Plus className="size-4" />
                  <span>Create new</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative size-8.5 p-0"
                    >
                      <SlidersHorizontal className="size-4" />
                      <span className="sr-only">Sort and filter files</span>
                      {activeFiltersCount > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground sm:static sm:h-5 sm:min-w-5 sm:rounded-full">
                          {activeFiltersCount}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    {sortOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => setSortBy(option.id)}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <option.icon className="size-4" />
                          {option.label}
                        </span>
                        {sortBy === option.id ? (
                          <Check className="size-4" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Filter</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        onShowFavoritesOnlyChange(!showFavoritesOnly)
                      }
                      className="flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Star
                          className={cn(
                            "size-4",
                            showFavoritesOnly &&
                              "fill-yellow-400 text-yellow-400",
                          )}
                        />
                        Favorites only
                      </span>
                      {showFavoritesOnly ? <Check className="size-4" /> : null}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Type</DropdownMenuLabel>
                    {filterOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => onFilterChange(option.id)}
                        className="flex items-center justify-between"
                      >
                        <span>{option.label}</span>
                        {activeFilterId === option.id ? (
                          <Check className="size-4" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === "grid"
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Grid2X2 className="size-3.5" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewMode === "list"
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <List className="size-3.5" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-background">
          {isLoading ? (
            viewMode === "grid" ? (
              <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`grid-skeleton-${index}`}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div className="size-10 animate-pulse rounded-lg bg-muted" />
                      <div className="size-8 animate-pulse rounded-md bg-muted" />
                    </div>
                    <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="mb-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`list-skeleton-${index}`}
                    className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="size-9 animate-pulse rounded-lg bg-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                    <div className="size-8 animate-pulse rounded-md bg-muted" />
                  </div>
                ))}
              </div>
            )
          ) : visibleFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="brand-gradient mb-4 rounded-full p-4 shadow-lg shadow-primary/25">
                {activeTab === "favorites" ? (
                  <Star className="size-8 text-white" />
                ) : (
                  <WandSparkles className="size-8 text-white" />
                )}
              </div>
              {activeTab === "favorites" ? (
                <>
                  <p className="mb-2 text-base font-semibold text-foreground">
                    No favorites yet
                  </p>
                  <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                    Star a presentation and it will show up here for quick
                    access.
                  </p>
                  <Button variant="outline" onClick={() => onActiveTabChange("all")}>
                    Browse all presentations
                  </Button>
                </>
              ) : (
                <>
                  <p className="mb-2 text-base font-semibold text-foreground">
                    Your deck library is empty
                  </p>
                  <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                    Describe a topic in the box above and AI will draft,
                    design, and review your first presentation.
                  </p>
                  <Button
                    className="brand-gradient border-0 text-white shadow-md shadow-primary/30 hover:brightness-110"
                    onClick={() => {
                      const promptBox = document.querySelector<HTMLTextAreaElement>(
                        'textarea[aria-label="Presentation prompt"]',
                      );
                      promptBox?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      promptBox?.focus({ preventScroll: true });
                    }}
                  >
                    <WandSparkles className="mr-2 size-4" />
                    Create your first deck
                  </Button>
                </>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
              {visibleFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                >
                  <button
                    type="button"
                    aria-label={`Open ${file.name}`}
                    onClick={file.onClick}
                    className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-none"
                  />
                  <div className="pointer-events-none relative z-20 aspect-video w-full overflow-hidden bg-muted/30">
                    {file.thumbnailUrl ? (
                      <PresentationThumbnail
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        fallback={
                          <div className="flex size-full items-center justify-center bg-accent/10">
                            <Folder className="size-12 text-muted-foreground/40" />
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-accent/10">
                        <Folder className="size-12 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div
                    className={cn(
                      "absolute top-2 right-2 z-30 flex items-center gap-1 transition-opacity",
                      file.isFavorited
                        ? "opacity-100"
                        : "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                    )}
                  >
                    <PresentationFavoriteButton
                      file={file}
                      className="border border-border/70 bg-background/90 shadow-sm backdrop-blur"
                    />
                    <PresentationFileActionsMenu
                      file={file}
                      onRenameRequest={openRenameDialog}
                      onDeleteRequest={setDeleteTarget}
                    />
                  </div>
                  <div className="pointer-events-none relative z-20 flex flex-1 flex-col p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4
                          className="truncate font-medium text-card-foreground"
                          title={file.name}
                        >
                          {file.name}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {file.modified}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-accent/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:gap-4 sm:py-2.5"
                >
                  <button
                    type="button"
                    aria-label={`Open ${file.name}`}
                    onClick={file.onClick}
                    className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none"
                  />
                  <div className="pointer-events-none relative z-20 flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    {file.thumbnailUrl ? (
                      <PresentationThumbnail
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="h-12 w-20 shrink-0 rounded-md border border-border object-cover"
                        fallback={
                          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
                            <Folder className="size-4" />
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
                        <Folder className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start gap-2">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                          {file.name}
                        </p>
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{file.modified}</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-20 flex shrink-0 items-center gap-1">
                    <PresentationFavoriteButton file={file} />
                    <PresentationFileActionsMenu
                      file={file}
                      onRenameRequest={openRenameDialog}
                      onDeleteRequest={setDeleteTarget}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      </div>

      <Credenza
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeRenameDialog();
          }
        }}
      >
        <CredenzaContent className="sm:max-w-md">
          <CredenzaHeader>
            <CredenzaTitle>Rename presentation</CredenzaTitle>
            <CredenzaDescription>
              Choose a new name for this presentation.
            </CredenzaDescription>
          </CredenzaHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="Enter a new presentation name"
            autoFocus
          />
          <CredenzaFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeRenameDialog}
              disabled={isRenamePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !renameTarget ||
                !renameValue.trim() ||
                renameValue.trim() === renameTarget.name ||
                isRenamePending
              }
              onClick={async () => {
                if (!renameTarget) {
                  closeRenameDialog();
                  return;
                }

                const nextName = renameValue.trim();
                if (!nextName || nextName === renameTarget.name) {
                  closeRenameDialog();
                  return;
                }

                const renamed = await renameTarget.onRename(nextName);
                if (renamed) {
                  closeRenameDialog();
                }
              }}
            >
              {isRenamePending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Rename
            </Button>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete presentation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteTarget || isDeletePending}
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteTarget) {
                  closeDeleteDialog();
                  return;
                }

                const deleted = await deleteTarget.onDelete();
                if (deleted) {
                  closeDeleteDialog();
                }
              }}
            >
              {isDeletePending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PresentationDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [documentTypeFilter, setDocumentTypeFilter] =
    useState<PresentationDocumentTypeFilterValue>(
      ALL_PRESENTATION_DOCUMENT_TYPES,
    );
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("recent");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Deep link from the app menu: /presentation?tab=favorites
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("tab") === "favorites") {
      setLibraryTab("favorites");
    }
  }, [searchParams]);
  const { createBlank: handleCreateBlank, isCreating: isCreatingBlank } =
    useBlankPresentationCreator();
  const {
    presentationInput,
    setPresentationInput,
    isGeneratingOutline,
    language,
    setLanguage,
    numSlides,
    setNumSlides,
    generationAspectRatio,
    setGenerationAspectRatio,
    webSearchEnabled,
    setWebSearchEnabled,
    autoThemeEnabled,
    setAutoThemeEnabled,
    setOutputFormat,
    setCurrentPresentation,
    setIsGeneratingOutline,
    setTheme,
    startOutlineGeneration,
    customThemeData,
    themeDataByTheme,
    generatedThemeData,
    pageStyle,
    presentationStyle,
    textContent,
    tone,
    audience,
    scenario,
    pageBackground,
    selectedSlideTemplates,
    outlineItemIds,
    outlineTemplateOverrides,
    resetPresentationState,
    sourceDocument,
    setSourceDocument,
  } = usePresentationState();
  const [isReadingPdf, setIsReadingPdf] = useState(false);

  useEffect(() => {
    setOutputFormat("flow");
  }, [setOutputFormat]);

  useEffect(() => {
    resetPresentationState();
  }, [resetPresentationState]);

  const typeFilter =
    documentTypeFilter === ALL_PRESENTATION_DOCUMENT_TYPES
      ? undefined
      : documentTypeFilter;
  const favoritesOnly = libraryTab === "favorites" || showFavoritesOnly;

  const updateCachedPresentationFavorite = (
    documentId: string,
    isFavorite: boolean,
  ) => {
    queryClient.setQueriesData<PresentationsInfiniteData>(
      { queryKey: PRESENTATIONS_QUERY_KEY },
      (cachedData) => {
        if (!cachedData) {
          return cachedData;
        }

        return {
          ...cachedData,
          pages: cachedData.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === documentId
                ? {
                    ...item,
                    favorites: isFavorite
                      ? item.favorites.length > 0
                        ? item.favorites
                        : [{ id: "optimistic-favorite" }]
                      : [],
                  }
                : item,
            ),
          })),
        };
      },
    );
  };

  const updateCachedPresentationTitle = (
    documentId: string,
    title: string,
  ) => {
    queryClient.setQueriesData<PresentationsInfiniteData>(
      { queryKey: PRESENTATIONS_QUERY_KEY },
      (cachedData) => {
        if (!cachedData) {
          return cachedData;
        }

        return {
          ...cachedData,
          pages: cachedData.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === documentId ? { ...item, title } : item,
            ),
          })),
        };
      },
    );
  };

  const removeCachedPresentation = (documentId: string) => {
    queryClient.setQueriesData<PresentationsInfiniteData>(
      { queryKey: PRESENTATIONS_QUERY_KEY },
      (cachedData) => {
        if (!cachedData) {
          return cachedData;
        }

        return {
          ...cachedData,
          pages: cachedData.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== documentId),
          })),
        };
      },
    );
  };

  const favoriteMutation = useMutation({
    mutationFn: async ({ documentId }: FavoriteMutationVariables) => {
      const result = await togglePresentationFavorite(documentId);

      if (!result.success) {
        throw new Error(result.message || "Failed to update favorite");
      }

      return result;
    },
    onMutate: async ({
      documentId,
      isFavorited,
    }: FavoriteMutationVariables) => {
      await queryClient.cancelQueries({ queryKey: PRESENTATIONS_QUERY_KEY });

      const previousQueries =
        queryClient.getQueriesData<PresentationsInfiniteData>({
          queryKey: PRESENTATIONS_QUERY_KEY,
        });

      updateCachedPresentationFavorite(documentId, !isFavorited);

      return { previousQueries };
    },
    onError: (error, _variables, context) => {
      context?.previousQueries.forEach(([queryKey, previousData]) => {
        queryClient.setQueryData(queryKey, previousData);
      });

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update favorite",
      );
    },
    onSuccess: (result, variables) => {
      if (typeof result.isFavorite === "boolean") {
        updateCachedPresentationFavorite(
          variables.documentId,
          result.isFavorite,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRESENTATIONS_QUERY_KEY });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({
      documentId,
      title,
    }: {
      documentId: string;
      title: string;
    }) => {
      const result = await updatePresentationTitle(documentId, title);

      if (!result.success) {
        throw new Error(result.message || "Failed to rename presentation");
      }

      return result;
    },
    onMutate: async ({ documentId, title }) => {
      await queryClient.cancelQueries({ queryKey: PRESENTATIONS_QUERY_KEY });

      const previousQueries =
        queryClient.getQueriesData<PresentationsInfiniteData>({
          queryKey: PRESENTATIONS_QUERY_KEY,
        });

      updateCachedPresentationTitle(documentId, title);

      return { previousQueries };
    },
    onError: (error, _variables, context) => {
      context?.previousQueries.forEach(([queryKey, previousData]) => {
        queryClient.setQueryData(queryKey, previousData);
      });

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to rename presentation",
      );
    },
    onSuccess: () => {
      toast.success("Presentation renamed");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRESENTATIONS_QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const result = await deletePresentation(documentId);

      if (!result.success) {
        throw new Error(result.message || "Failed to delete presentation");
      }

      return result;
    },
    onMutate: async ({ documentId }) => {
      await queryClient.cancelQueries({ queryKey: PRESENTATIONS_QUERY_KEY });

      const previousQueries =
        queryClient.getQueriesData<PresentationsInfiniteData>({
          queryKey: PRESENTATIONS_QUERY_KEY,
        });

      removeCachedPresentation(documentId);

      return { previousQueries };
    },
    onError: (error, _variables, context) => {
      context?.previousQueries.forEach(([queryKey, previousData]) => {
        queryClient.setQueryData(queryKey, previousData);
      });

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete presentation",
      );
    },
    onSuccess: () => {
      toast.success("Presentation deleted");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PRESENTATIONS_QUERY_KEY });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const result = await duplicatePresentation(documentId);

      if (!result.success || !result.presentation) {
        throw new Error(result.message || "Failed to duplicate presentation");
      }

      return result.presentation;
    },
    onSuccess: (presentation) => {
      queryClient.invalidateQueries({ queryKey: PRESENTATIONS_QUERY_KEY });
      toast.success("Presentation duplicated");
      router.push(`/presentation/${presentation.id}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to duplicate presentation",
      );
    },
  });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [...PRESENTATIONS_QUERY_KEY, documentTypeFilter, favoritesOnly],
      queryFn: async ({ pageParam = 0 }) =>
        fetchPresentations(pageParam, typeFilter, { favoritesOnly }),
      getNextPageParam: (lastPage, allPages) =>
        lastPage.hasMore ? allPages.length : undefined,
      initialPageParam: 0,
    });
  const { ref: loadMoreRef } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  const allPresentations = data?.pages.flatMap((page) => page.items) ?? [];
  const fileItems: PresentationFileItem[] = allPresentations.map((item) => ({
    id: item.id,
    name: item.title || "Untitled",
    thumbnailUrl: item.thumbnailUrl,
    modified: formatDistanceToNow(new Date(item.updatedAt), {
      addSuffix: true,
    }),
    modifiedAt: new Date(item.updatedAt),
    isFavorited: item.favorites.length > 0,
    isFavoritePending:
      favoriteMutation.isPending &&
      favoriteMutation.variables?.documentId === item.id,
    isRenamePending:
      renameMutation.isPending && renameMutation.variables?.documentId === item.id,
    isDeletePending:
      deleteMutation.isPending && deleteMutation.variables?.documentId === item.id,
    isDuplicatePending:
      duplicateMutation.isPending &&
      duplicateMutation.variables?.documentId === item.id,
    onClick: () => router.push(getPresentationRoute(item)),
    onToggleFavorite: () =>
      favoriteMutation.mutate({
        documentId: item.id,
        isFavorited: item.favorites.length > 0,
      }),
    onRename: async (nextName) => {
      try {
        await renameMutation.mutateAsync({
          documentId: item.id,
          title: nextName,
        });
        return true;
      } catch {
        return false;
      }
    },
    onDelete: async () => {
      try {
        await deleteMutation.mutateAsync({ documentId: item.id });
        return true;
      } catch {
        return false;
      }
    },
    onDuplicate: () => duplicateMutation.mutate({ documentId: item.id }),
  }));

  const selectedLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.shortLabel ??
    "English";
  const slidesLabel =
    SLIDE_OPTIONS.find((option) => option.value === String(numSlides))?.label ??
    `${numSlides} slides`;
  const outputFormatLabel =
    getPresentationGenerationAspectRatioLabel(generationAspectRatio);
  const filterOptions = useMemo(
    () => [
      { id: ALL_PRESENTATION_DOCUMENT_TYPES, label: "All" },
      { id: "PRESENTATION", label: "Presentations" },
    ],
    [],
  );

  const handlePdfFile = async (file: File) => {
    if (!isPdfFile(file)) {
      toast.error("Only PDF files can be used as source material");
      return;
    }

    if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
      toast.error("PDF is too large (max 25MB)");
      return;
    }

    setIsReadingPdf(true);
    try {
      const { extractPdfSource } = await import(
        "@/lib/presentation/pdf-extract"
      );
      const source = await extractPdfSource(file);

      if (!source.text) {
        toast.error(
          "No selectable text found in this PDF. Scanned documents are not supported.",
        );
        return;
      }

      setSourceDocument(source);
    } catch (error) {
      console.error("Failed to read PDF:", error);
      toast.error(
        error instanceof Error
          ? `Failed to read the PDF: ${error.message}`
          : "Failed to read the PDF file",
      );
    } finally {
      setIsReadingPdf(false);
    }
  };

  const handleGenerate = async () => {
    const prompt = presentationInput.trim();

    if (!prompt && !sourceDocument) {
      return;
    }

    const initialTheme = resolvedTheme === "dark" ? "ebony" : "mystique";
    const title =
      (prompt || sourceDocument?.name.replace(/\.pdf$/i, "") || "").substring(
        0,
        50,
      ) || "Untitled Presentation";

    setOutputFormat("flow");
    setIsGeneratingOutline(true);
    setTheme(initialTheme);

    const customization = buildPresentationCustomization({
      customThemeData,
      themeDataByTheme,
      generatedThemeData,
      theme: initialTheme,
      pageStyle,
      presentationStyle,
      generationAspectRatio,
      textContent,
      tone,
      audience,
      scenario,
      pageBackground,
      selectedSlideTemplates,
      outlineItemIds,
      outlineTemplateOverrides,
    });

    try {
      const result = await createEmptyPresentation({
        title,
        theme: initialTheme,
        language,
        customization,
      });

      if (!result.success || !result.presentation) {
        setIsGeneratingOutline(false);
        toast.error(result.message || "Failed to create presentation");
        return;
      }

      setCurrentPresentation(result.presentation.id, result.presentation.title);
      startOutlineGeneration();
      router.push(`/presentation/generate/${result.presentation.id}`);
    } catch (error) {
      setIsGeneratingOutline(false);
      console.error("Error creating presentation:", error);
      toast.error("Failed to create presentation");
    }
  };

  return (
    <NotebookPageLayout>
      <GreetingSection />

      <NotebookInputBox
        placeholder="Describe your topic or paste your content here — or drop a PDF to use it as source material. Our AI will structure it into a compelling presentation."
        value={presentationInput}
        onChange={setPresentationInput}
        onSubmit={handleGenerate}
        submitDisabled={
          (!presentationInput.trim() && !sourceDocument) ||
          isGeneratingOutline ||
          isReadingPdf
        }
        isSubmitting={isGeneratingOutline}
        onPdfFile={handlePdfFile}
        attachmentSlot={
          isReadingPdf || sourceDocument ? (
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-accent/40 px-3 py-1.5 text-[13px] text-foreground">
                {isReadingPdf ? (
                  <>
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    <span>Reading PDF…</span>
                  </>
                ) : sourceDocument ? (
                  <>
                    <FileText className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium">
                      {sourceDocument.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {sourceDocument.pageCount}{" "}
                      {sourceDocument.pageCount === 1 ? "page" : "pages"}
                      {sourceDocument.truncated ? ", truncated" : ""}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove attached PDF"
                      onClick={() => setSourceDocument(null)}
                      className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SettingPill icon={PanelsTopLeft} label={slidesLabel}>
            <DropdownMenuLabel>Slides</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={String(numSlides)}
              onValueChange={(value) => setNumSlides(Number(value))}
            >
              {SLIDE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </SettingPill>

          <SettingPill icon={LayoutTemplate} label={outputFormatLabel}>
            <DropdownMenuLabel>Format</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={generationAspectRatio}
              onValueChange={(value) =>
                setGenerationAspectRatio(
                  value as PresentationGenerationAspectRatio,
                )
              }
            >
              <DropdownMenuRadioItem value="dynamic">
                Dynamic
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="16:9">16:9</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </SettingPill>

          <SettingPill icon={Languages} label={selectedLanguageLabel}>
            <DropdownMenuLabel>Language</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
              {LANGUAGE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </SettingPill>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:h-9 sm:px-3.5 sm:text-sm"
              >
                <WandSparkles className="size-3.5 sm:size-4" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuCheckboxItem
                checked={webSearchEnabled}
                onCheckedChange={setWebSearchEnabled}
              >
                <Globe className="size-4" />
                Web Search
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={autoThemeEnabled}
                onCheckedChange={setAutoThemeEnabled}
              >
                <WandSparkles className="size-4" />
                Auto Theme
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ModelPicker shouldShowLabel={false} />

        </div>
      </NotebookInputBox>

      <PresentationProjectFilesSection
        files={fileItems}
        isLoading={isLoading}
        onCreateNew={() => {
          if (!isCreatingBlank) {
            void handleCreateBlank();
          }
        }}
        filterOptions={filterOptions}
        activeFilterId={documentTypeFilter}
        onFilterChange={(filterId) =>
          setDocumentTypeFilter(filterId as PresentationDocumentTypeFilterValue)
        }
        activeTab={libraryTab}
        onActiveTabChange={setLibraryTab}
        showFavoritesOnly={showFavoritesOnly}
        onShowFavoritesOnlyChange={setShowFavoritesOnly}
      />

      {hasNextPage ? (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage ? (
            <div className="size-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          ) : null}
        </div>
      ) : null}
    </NotebookPageLayout>
  );
}
