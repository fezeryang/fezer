import { loadPosts, loadWorks, loadProfiles, getDefaultProfile } from "./index";

console.log("=== Content Loader Test ===\n");

console.log("--- Posts ---");
try {
  const posts = loadPosts();
  console.log(`Loaded ${posts.length} posts:`);
  posts.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.date}] ${p.title} (slug: ${p.slug})`);
    console.log(`     excerpt: ${p.excerpt.slice(0, 50)}...`);
    console.log(`     tags: ${p.tags.join(", ") || "(none)"}`);
  });
} catch (err) {
  console.error("Posts error:", err);
}

console.log("\n--- Works ---");
try {
  const works = loadWorks();
  console.log(`Loaded ${works.length} works:`);
  works.forEach((w, i) => {
    console.log(`  ${i + 1}. ${w.title} (slug: ${w.slug})`);
    console.log(`     description: ${w.description.slice(0, 50)}...`);
    console.log(`     tags: ${w.tags.join(", ") || "(none)"}`);
  });
} catch (err) {
  console.error("Works error:", err);
}

console.log("\n--- Profiles ---");
try {
  const profiles = loadProfiles();
  console.log(`Loaded ${profiles.length} profiles:`);
  profiles.forEach((p) => {
    console.log(`  - ${p.name} (${p.locale}): ${p.bio}`);
    console.log(`    skills: ${p.skills.join(", ")}`);
  });

  const defaultProfile = getDefaultProfile();
  if (defaultProfile) {
    console.log(`\nDefault profile: ${defaultProfile.name} (${defaultProfile.locale})`);
  }
} catch (err) {
  console.error("Profiles error:", err);
}

console.log("\n=== Test Complete ===");
