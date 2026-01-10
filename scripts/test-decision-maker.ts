import { resolveDecisionMakers } from '../src/lib/core/agents/agents/decision-maker';
// import { env } from '$env/dynamic/private'; // Removed to avoid SvelteKit dependency in test
// import { env } from '$env/dynamic/private'; // Removed to avoid SvelteKit dependency in test

// Mock env for standalone run if needed, but we rely on proper loading usually
if (!process.env.GEMINI_API_KEY) {
    console.error("Please set GEMINI_API_KEY");
    process.exit(1);
}

// Mocking $env/dynamic/private if it fails (basic ploy)
// In reality, we should rely on the fact that we fixed gemini-client to use process.env
// But resolveDecisionMakers imports from valid paths.

async function main() {
    console.log("Testing Decision Maker resolution with strict email requirements...");

    try {
        const result = await resolveDecisionMakers({
            subjectLine: "Fix the Potholes on Main Street",
            coreIssue: "Dangerous potholes causing tire damage on Main St in Springfield",
            topics: ["infrastructure", "roads", "local government"],
            voiceSample: "I popped two tires last week explicitly due to the craters on Main St.",
            urlSlug: "fix-main-street-potholes"
        });

        console.log("Result:", JSON.stringify(result, null, 2));

        // Validation
        const missingEmails = result.decision_makers.filter(dm => !dm.email);
        if (missingEmails.length > 0) {
            console.error("❌ FAILED: Found decision makers without emails:", missingEmails.map(d => d.name));
            process.exit(1);
        } else {
            console.log("✅ SUCCESS: All decision makers have emails.");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
