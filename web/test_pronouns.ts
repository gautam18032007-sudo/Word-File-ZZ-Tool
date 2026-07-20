import { generateFallbackLorDraft } from "./lib/lorFallback";

const basePayload = {
  fullName: "Neha Sharma",
  designation: "Maverick Intern",
  department: "Tech Team",
  joiningDate: "2025-01-15",
  lastWorkingDate: "2025-07-15",
  employmentType: "Intern",
  responsibilities: "I managed database schemas and I built REST APIs.",
  projects: "I handled payment gateway integration.",
  strengths: "Quick learner, problem solver",
};

const testCases = [
  { pref: "female", info: "please mention I got promoted mid-internship" },
  { pref: "female", info: "I extended my tenure by 2 weeks" },
  { pref: "male", info: "please mention I got promoted mid-internship" },
  { pref: "male", info: "I extended my tenure by 2 weeks" },
  { pref: "neutral", info: "please mention I got promoted mid-internship" },
  { pref: "neutral", info: "I extended my tenure by 2 weeks" },
];

console.log("=========================================");
console.log("RUNNING LOR PRONOUN CONSISTENCY TEST");
console.log("=========================================\n");

testCases.forEach(({ pref, info }, idx) => {
  console.log(`--- Test Case ${idx + 1}: Pronoun Preference = "${pref}", Additional Info = "${info}" ---`);
  const draft = generateFallbackLorDraft({
    ...basePayload,
    pronounPreference: pref,
    additionalInfo: info,
  });
  console.log(draft);
  console.log("\n----------------------------------------------------------------------\n");
});
