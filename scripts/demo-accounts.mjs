// The development-only demo accounts. Their passwords are public on purpose
// (docs/demo-accounts.md): these accounts exist only in local development
// databases created by scripts/seed-demo.mjs and must never be loaded into a
// production database.

export const demoAccounts = {
  tutor1: { role: 'tutor', name: 'Arif Hossain', email: 'demo.tutor1@example.test', password: 'Demo-imxf-pPs5-Un9n', approve: true },
  tutor2: { role: 'tutor', name: 'Sadia Rahman', email: 'demo.tutor2@example.test', password: 'Demo-Z557-fCDV-zg6k', approve: false },
  coaching1: { role: 'coaching', name: 'Bright Future Coaching', email: 'demo.coaching1@example.test', password: 'Demo-WrmE-cZuC-U5Zb', approve: true },
  coaching2: { role: 'coaching', name: 'Pathshala Academy', email: 'demo.coaching2@example.test', password: 'Demo-qDAX-B8T6-Sy7R', approve: false },
  parent1: { role: 'parent', name: 'Farzana Akter', email: 'demo.parent1@example.test', password: 'Demo-SLaZ-Z3Pp-f8vy' },
  parent2: { role: 'parent', name: 'Kamal Uddin', email: 'demo.parent2@example.test', password: 'Demo-JL72-iuS5-ELAF' },
  student1: { role: 'student', name: 'Rafi Hasan', email: 'demo.student1@example.test', password: 'Demo-XAsa-PnEN-2JzC' },
  student2: { role: 'student', name: 'Nabila Islam', email: 'demo.student2@example.test', password: 'Demo-4Ty3-HEjf-qJjt' },
}
