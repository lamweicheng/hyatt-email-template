-- CreateTable
CREATE TABLE "EmailTemplateSettings" (
    "id" TEXT NOT NULL,
    "defaultTemplate" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "selectedTopicIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateSettings_pkey" PRIMARY KEY ("id")
);
