import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const templates = await db.template.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      deliveryMethod: true,
      recipient_config: true,
      scopes: true,
      jurisdictions: true,
    },
    orderBy: { createdAt: "asc" }
  });

  console.log("Templates found:", templates.length);
  console.log("=".repeat(80));

  for (const t of templates) {
    const config = t.recipient_config as Record<string, unknown>;
    const dms = (config?.decisionMakers || []) as Record<string, unknown>[];

    console.log("\nTemplate:", t.title);
    console.log("  Slug:", t.slug);
    console.log("  Delivery:", t.deliveryMethod);
    console.log("  Scopes:", JSON.stringify(t.scopes));
    console.log("  Jurisdictions:", JSON.stringify(t.jurisdictions));
    console.log("  DMs:", dms.length);

    if (dms.length > 0) {
      const first = dms[0];
      console.log("  First DM keys:", Object.keys(first).join(", "));
      console.log("  Sample:", JSON.stringify({
        name: first.name,
        title: first.title,
        roleCategory: first.roleCategory,
        relevanceRank: first.relevanceRank,
        accountabilityOpener: first.accountabilityOpener ? String(first.accountabilityOpener).substring(0, 80) + "..." : null,
        publicActions: first.publicActions,
        emailGrounded: first.emailGrounded,
        personalPrompt: first.personalPrompt ? String(first.personalPrompt).substring(0, 60) + "..." : null,
      }, null, 4));
    }
  }

  await db.$disconnect();
}

main().catch(console.error);
