-- CreateTable
CREATE TABLE "SlideAudit" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "pass" BOOLEAN NOT NULL DEFAULT false,
    "claims" JSONB,
    "revision_notes" JSONB,
    "reviewer_notes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlideAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlideAudit_slideId_idx" ON "SlideAudit"("slideId");
