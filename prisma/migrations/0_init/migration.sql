-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NOTE', 'DOCUMENT', 'DRAWING', 'DESIGN', 'STICKY_NOTES', 'MIND_MAP', 'RESEARCH_PAPER', 'FLIPBOOK', 'PRESENTATION');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headline" VARCHAR(100),
    "bio" TEXT,
    "interests" TEXT[],
    "location" TEXT,
    "website" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "hasAccess" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "userId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "documentType" TEXT NOT NULL,

    CONSTRAINT "BaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'mystique',
    "imageSource" TEXT DEFAULT 'ai',
    "prompt" TEXT,
    "presentationStyle" TEXT,
    "customization" JSONB,
    "language" TEXT DEFAULT 'en-US',
    "outline" TEXT[],
    "searchResults" JSONB,
    "toolCalls" JSONB,
    "selectedChunks" JSONB,
    "templateId" TEXT,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "themeData" JSONB NOT NULL,

    CONSTRAINT "CustomTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoritePresentationTheme" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePresentationTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentationThemeLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationThemeLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FontPair" (
    "id" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "headingUrl" TEXT,
    "headingWeight" INTEGER NOT NULL DEFAULT 700,
    "body" TEXT NOT NULL,
    "bodyUrl" TEXT,
    "bodyWeight" INTEGER NOT NULL DEFAULT 400,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FontPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteDocument" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FavoriteDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CustomTheme_userId_idx" ON "CustomTheme"("userId");

-- CreateIndex
CREATE INDEX "FavoritePresentationTheme_userId_idx" ON "FavoritePresentationTheme"("userId");

-- CreateIndex
CREATE INDEX "FavoritePresentationTheme_themeId_idx" ON "FavoritePresentationTheme"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePresentationTheme_userId_themeId_key" ON "FavoritePresentationTheme"("userId", "themeId");

-- CreateIndex
CREATE INDEX "PresentationThemeLike_userId_idx" ON "PresentationThemeLike"("userId");

-- CreateIndex
CREATE INDEX "PresentationThemeLike_themeId_idx" ON "PresentationThemeLike"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "PresentationThemeLike_userId_themeId_key" ON "PresentationThemeLike"("userId", "themeId");

-- CreateIndex
CREATE INDEX "FontPair_userId_idx" ON "FontPair"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDocument_userId_documentId_key" ON "FavoriteDocument"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseDocument" ADD CONSTRAINT "BaseDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_id_fkey" FOREIGN KEY ("id") REFERENCES "BaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomTheme" ADD CONSTRAINT "CustomTheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePresentationTheme" ADD CONSTRAINT "FavoritePresentationTheme_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePresentationTheme" ADD CONSTRAINT "FavoritePresentationTheme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "CustomTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationThemeLike" ADD CONSTRAINT "PresentationThemeLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentationThemeLike" ADD CONSTRAINT "PresentationThemeLike_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "CustomTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FontPair" ADD CONSTRAINT "FontPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDocument" ADD CONSTRAINT "FavoriteDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "BaseDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDocument" ADD CONSTRAINT "FavoriteDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
