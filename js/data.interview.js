/* ============================================================
   INTERVIEW PREP DATA  —  DECA Roleplay & Interview
   Made by WILLY. For Willy.
   window.INTERVIEW_DATA
   ============================================================ */
window.INTERVIEW_DATA = {
  formats: [
    {
      name: "Individual Series",
      code: "IND",
      desc: "A written case + spoken presentation scored on PIs.",
      prep: "10 min prep",
      time: "10 min presentation",
      parts: "1 case · 5 mins out + 10 mins in · 1 judge",
      body: "You get a case with a problem and two questions. Prepare a solution in prep time, then present to the judge with an answer sheet.",
      tips: [
        "Re-read the case twice. Underline numbers and revenue figures in prep time",
        "Structure: situation / root cause / 2-3 solutions / recommendation / implementation",
        "Practice speaking at 140-150 wpm with clear pauses between sections"
      ]
    },
    {
      name: "Team Decision Making (TDM)",
      code: "TDM",
      desc: "Two-student team case scored on PIs.",
      prep: "30 min prep",
      time: "15 min presentation",
      parts: "2-person team · 1 judge",
      body: "Both team members get the same case. Present together in an organized role-play to a judge who scores each person on PIs.",
      tips: [
        "Split speaking parts: one covers situation, other covers recommendation",
        "Use phrases like 'We recommend' and 'Our strategy is' to stay on-team",
        "Share prep time to build ONE agreed solution before writing"
      ]
    },
    {
      name: "Principles Track",
      code: "PIN",
      desc: "Separate Principles (written) tests by event.",
      prep: "—",
      time: "100-questions written test",
      parts: "Multiple choice · 40 / 50 / 75 questions",
      body: "At DECA competitions, a written Principles test is your main scoring. Get quick with our quiz modes and practice daily.",
      tips: [
        "Aim to finish 60% of the test in the first half of the time",
        "Eliminate obviously wrong answers first, then reason",
        "Memorize definitions with the flashcard mode"
      ]
    }
  ],
  pi: [
    { c: "D", title: "Demonstrate knowledge", def: "Accurate, current facts + terminology used correctly and confidently." },
    { c: "E", title: "Explain the rationale", def: "Show the WHY: principles, cause-effect, benefits, trade-offs for your designed approach." },
    { c: "C", title: "Communicate", def: "Professional delivery — clear voice, eye contact, structure, and business vocabulary." },
    { c: "A", title: "Achieve the objective", def: "Your solution truly solves the case problem and reaches a measurable result." }
  ],
  decaMethod: [
    "1. SWINE: Situation, Who, Issues, Needs, Enterprise — identify the exact problem",
    "2. Alternatives: list at least 3 possible solutions, then compare cost/benefit",
    "3. Choose: pick the best option and defend with 2+ solid reasons",
    "4. Implement: who does what, when, with what budget",
    "5. Follow-up: how you will measure success, adjust, and review"
  ],
  scenarios: [
    { q: "You are a store manager. Sales dropped 12% after a new competitor opened nearby. What do you do?", kw: "situation, competitor, differentiation, customer, plan" },
    { q: "Your product costs too much to make and profit margins fell. Propose a solution.", kw: "costs, margin, pricing, suppliers, operations" },
    { q: "A customer complains about a defective product at your register. Handle it.", kw: "service, refund, empathy, resolution, follow-up" },
    { q: "You need to promote a new loyalty card to existing customers. Design the campaign.", kw: "targeting, rewards, promotion, data, measuring" },
    { q: "Your team is late on a key project. Fix it fast.", kw: "priorities, delegation, scheduling, communication" }
  ],
  tips: [
    "Answer in the real order of the case questions. Address each one explicitly.",
    "Use 'I' / 'we' confidently, smile, and talk to the judge as a businessperson.",
    "Give numbers: 'We could save 15% of costs by switching suppliers' sounds concrete.",
    "Never sit silent — if stuck, restate the situation and one solid idea.",
    "Wear business attire: for you — blazer, dress shirt, dress pants or skirt, closed shoes.",
    "Say 'Thank you for your time' before leaving, with a firm handshake."
  ],
  attire: [
    "Blazer / suit jacket (navy, black, or grey)",
    "Dress shirt, plain white or light blue, tucked in",
    "Neatly matched dress pants or skirt",
    "Closed-toe dress shoes",
    "Minimal accessories and a clean, professional haircut"
  ],
  roleplayTimers: {
    individual: { prep: 600, present: 600, label: "Individual Series" },
    team: { prep: 1800, present: 900, label: "Team Decision Making" }
  }
};
