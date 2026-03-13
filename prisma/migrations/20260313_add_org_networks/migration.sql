-- CreateTable
CREATE TABLE "org_network" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "owner_org_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_network_member" (
    "id" TEXT NOT NULL,
    "network_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by" TEXT,

    CONSTRAINT "org_network_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_network_slug_key" ON "org_network"("slug");
CREATE INDEX "org_network_owner_org_id_idx" ON "org_network"("owner_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_network_member_network_id_org_id_key" ON "org_network_member"("network_id", "org_id");
CREATE INDEX "org_network_member_network_id_idx" ON "org_network_member"("network_id");
CREATE INDEX "org_network_member_org_id_idx" ON "org_network_member"("org_id");

-- AddForeignKey
ALTER TABLE "org_network" ADD CONSTRAINT "org_network_owner_org_id_fkey" FOREIGN KEY ("owner_org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_network_member" ADD CONSTRAINT "org_network_member_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "org_network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_network_member" ADD CONSTRAINT "org_network_member_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
