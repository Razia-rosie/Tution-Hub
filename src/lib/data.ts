export type Tutor = {
  id: string; name: string; short: string; initials: string; subjects: string[]; classes: string; area: string; fee: number
  rating: number; reviews: number; verified: number; trust: number; mode: 'Offline' | 'Online' | 'Both'; years: number
  badges: ('identity' | 'education' | 'experience' | 'skill')[]; bio: string; rank?: string
}
const t = (id: string, name: string, subjects: string[], classes: string, area: string, fee: number, rating: number, reviews: number, verified: number, trust: number, mode: Tutor['mode'], years: number, badges: Tutor['badges'], bio: string, rank?: string): Tutor => {
  const p = name.split(' ')
  return { id, name, short: `${p[0]} ${p[p.length - 1][0]}.`, initials: p[0][0] + p[p.length - 1][0], subjects, classes, area, fee, rating, reviews, verified, trust, mode, years, badges, bio, rank }
}
export const TUTORS: Tutor[] = [
  t('tanvir-ahmed-rahman', 'Tanvir Ahmed Rahman', ['Mathematics', 'Physics'], 'Classes 9–12', 'Uttara', 6000, 4.9, 31, 27, 87, 'Both', 6, ['identity', 'education', 'experience', 'skill'], 'Concept-first teaching for SSC and HSC. Weekly timed practice and a short written note after every class.', '#12 Overall · #4 Mathematics · #2 Uttara'),
  t('samira-khanam', 'Samira Khanam', ['Chemistry', 'Biology'], 'Classes 8–10', 'Mirpur', 5000, 4.8, 22, 19, 82, 'Offline', 4, ['identity', 'education', 'experience'], 'Diagram-based biology and step-by-step chemistry problem solving for school exams.'),
  t('rafiq-hasan', 'Rafiq Hasan', ['Accounting', 'ICT'], 'HSC', 'Banani', 8000, 4.7, 17, 14, 79, 'Both', 8, ['identity', 'education', 'experience'], 'Business studies stream specialist. Case-based accounting practice with past board questions.'),
  t('nusrat-jahan', 'Nusrat Jahan', ['English'], 'Classes 6–10', 'Dhanmondi', 4000, 4.9, 26, 23, 85, 'Both', 5, ['identity', 'education', 'skill'], 'Grammar, composition and speaking confidence for Bangla Medium and English Version students.'),
  t('imran-hossain', 'Imran Hossain', ['Mathematics'], 'Classes 6–9', 'Mohammadpur', 3500, 4.6, 12, 9, 71, 'Offline', 3, ['identity', 'education'], 'Patient foundation building in algebra and geometry for younger learners.'),
  t('tasnim-akter', 'Tasnim Akter', ['Bangla', 'English'], 'Classes 6–8', 'Gulshan', 4500, 4.8, 15, 12, 80, 'Both', 4, ['identity', 'education', 'experience'], 'Reading comprehension and writing practice, with monthly progress notes for guardians.'),
  t('arif-chowdhury', 'Arif Chowdhury', ['Physics', 'Chemistry'], 'HSC', 'Bashundhara', 7500, 4.7, 19, 16, 81, 'Offline', 7, ['identity', 'education', 'experience'], 'Numerical-heavy HSC science preparation with weekly model tests.'),
  t('mahmudul-karim', 'Mahmudul Karim', ['ICT', 'Mathematics'], 'Classes 9–10', 'Badda', 4000, 4.5, 8, 6, 68, 'Both', 2, ['identity', 'education'], 'Practical ICT lessons and exam-focused maths revision.'),
  t('farhana-rahman-mou', 'Farhana Rahman Mou', ['Biology'], 'Classes 9–12', 'Rampura', 5500, 4.8, 20, 17, 83, 'Offline', 5, ['identity', 'education', 'experience'], 'Medical admission and HSC biology with memory techniques and weekly quizzes.'),
  t('shafiq-uddin', 'Shafiq Uddin', ['Accounting'], 'HSC', 'Mohakhali', 6500, 4.6, 11, 10, 74, 'Both', 6, ['identity', 'education', 'experience'], 'Financial accounting and cost accounting, with solved board-question banks.'),
  t('ritu-barua', 'Ritu Barua', ['English'], 'Classes 9–12', 'Uttara', 5000, 4.7, 14, 11, 77, 'Both', 4, ['identity', 'education'], 'Writing skills and literature for SSC and HSC English papers.'),
  t('zahid-sarker', 'Zahid Sarker', ['Mathematics'], 'Classes 8–10', 'Mirpur', 4500, 4.7, 16, 13, 78, 'Offline', 5, ['identity', 'education', 'experience'], 'Exam-pattern maths with timed practice and error analysis.'),
  t('lamia-sultana', 'Lamia Sultana', ['Chemistry'], 'Classes 9–12', 'Dhanmondi', 5500, 4.8, 18, 15, 82, 'Both', 5, ['identity', 'education', 'skill'], 'Reaction mechanisms made visual, plus weekly problem sets.'),
  t('kabir-hossain-anik', 'Kabir Hossain Anik', ['Physics'], 'Classes 9–10', 'Banani', 5000, 4.6, 10, 8, 72, 'Offline', 3, ['identity', 'education'], 'Intuition-led physics with plenty of worked numericals.'),
]
export const AREAS = ['Dhanmondi', 'Mirpur', 'Uttara', 'Mohakhali', 'Banani', 'Gulshan', 'Bashundhara', 'Mohammadpur', 'Badda', 'Rampura']
export const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'ICT', 'English', 'Bangla', 'Accounting']
export const CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SSC', 'HSC']

export type Post = {
  id: string; subject: string; cls: string; medium: string; area: string; days: string; time: string; budget: number
  mode: 'Offline' | 'Online'; posted: string; travel: string; km: string; requirements: string; by: string
}
export const POSTS: Post[] = [
  { id: 'p-1', subject: 'Mathematics', cls: 'Class 10', medium: 'Bangla Medium', area: 'Mirpur', days: 'Sat, Mon, Wed', time: '5:00–6:00 PM', budget: 4500, mode: 'Offline', posted: '9 Oct 2026', travel: '20–28 min', km: '4.8 km', requirements: 'Weekly model tests. Female tutor preferred.', by: 'Verified Parent' },
  { id: 'p-2', subject: 'Physics', cls: 'HSC', medium: 'Bangla Medium', area: 'Uttara', days: 'Sun, Tue, Thu', time: '6:30–7:30 PM', budget: 7000, mode: 'Offline', posted: '8 Oct 2026', travel: '25–35 min', km: '6.5 km', requirements: 'Numerical practice and past board questions.', by: 'Verified Student' },
  { id: 'p-3', subject: 'English', cls: 'Class 8', medium: 'English Version', area: 'Dhanmondi', days: 'Sat, Tue', time: '4:00–5:00 PM', budget: 3500, mode: 'Offline', posted: '7 Oct 2026', travel: '15–22 min', km: '3.2 km', requirements: 'Grammar and speaking confidence.', by: 'Verified Parent' },
  { id: 'p-4', subject: 'Chemistry', cls: 'Class 9', medium: 'English Medium', area: 'Gulshan', days: 'Mon, Wed', time: '5:30–6:30 PM', budget: 5500, mode: 'Online', posted: '6 Oct 2026', travel: 'Online', km: 'Online', requirements: 'Stable internet. Screen-share worksheets.', by: 'Verified Parent' },
  { id: 'p-5', subject: 'Biology', cls: 'SSC', medium: 'Bangla Medium', area: 'Mohammadpur', days: 'Sat, Mon, Wed', time: '5:00–6:00 PM', budget: 4800, mode: 'Offline', posted: '5 Oct 2026', travel: '18–26 min', km: '4.1 km', requirements: 'Diagram practice before SSC model test.', by: 'Verified Parent' },
  { id: 'p-6', subject: 'Accounting', cls: 'HSC', medium: 'Bangla Medium', area: 'Mohakhali', days: 'Sun, Wed', time: '7:00–8:00 PM', budget: 6500, mode: 'Offline', posted: '4 Oct 2026', travel: '22–30 min', km: '5.4 km', requirements: 'Business studies group. Case-based practice.', by: 'Verified Student' },
  { id: 'p-7', subject: 'Mathematics', cls: 'Class 7', medium: 'English Version', area: 'Banani', days: 'Tue, Thu', time: '4:30–5:30 PM', budget: 4000, mode: 'Offline', posted: '3 Oct 2026', travel: '16–24 min', km: '3.9 km', requirements: 'Foundation building. Patient tutor.', by: 'Verified Parent' },
  { id: 'p-8', subject: 'ICT', cls: 'Class 10', medium: 'Bangla Medium', area: 'Badda', days: 'Sat, Wed', time: '6:00–7:00 PM', budget: 3800, mode: 'Offline', posted: '2 Oct 2026', travel: '24–32 min', km: '5.8 km', requirements: 'Practical lab work and exam revision.', by: 'Verified Parent' },
  { id: 'p-9', subject: 'Bangla', cls: 'Class 6', medium: 'Bangla Medium', area: 'Rampura', days: 'Mon, Thu', time: '4:00–5:00 PM', budget: 3000, mode: 'Offline', posted: '1 Oct 2026', travel: '12–18 min', km: '2.6 km', requirements: 'Reading and handwriting practice.', by: 'Verified Parent' },
  { id: 'p-10', subject: 'Physics', cls: 'Class 9', medium: 'English Medium', area: 'Bashundhara', days: 'Tue, Thu', time: '5:00–6:00 PM', budget: 5000, mode: 'Online', posted: '30 Sep 2026', travel: 'Online', km: 'Online', requirements: 'Concept clarity and weekly quizzes.', by: 'Verified Student' },
]

export type Centre = {
  id: string; name: string; area: string; subjects: string[]; classes: string; teachers: number; students: number; batches: number
  rating: number; reviews: number; about: string; est: string; teacherList: [string, string][]; batchList: [string, string, string][]
}
export const CENTRES: Centre[] = [
  { id: 'scholars-point', name: 'Scholars Point Coaching', area: 'Mohakhali', subjects: ['Mathematics', 'Physics', 'Chemistry', 'English'], classes: 'Classes 8–10, SSC', teachers: 14, students: 320, batches: 12, rating: 4.7, reviews: 48, est: '2018', about: 'A fictional SSC-focused coaching centre used for this demo. Small batches, weekly model tests and monthly parent reports.',
    teacherList: [['Mr. Anwar Hossain', 'Mathematics'], ['Ms. Sultana Parvin', 'Physics'], ['Mr. Delwar Karim', 'Chemistry'], ['Ms. Rehana Akter', 'English']],
    batchList: [['SSC Maths A', 'Sat, Mon, Wed · 4:00 PM', '৳3,000 / month'], ['SSC Physics B', 'Sun, Tue · 5:30 PM', '৳2,800 / month'], ['Class 9 Science', 'Fri-off · Sat, Tue · 3:00 PM', '৳2,500 / month']] },
  { id: 'bright-path', name: 'Bright Path Academy', area: 'Uttara', subjects: ['Biology', 'Chemistry', 'English', 'ICT'], classes: 'Classes 6–10', teachers: 9, students: 210, batches: 8, rating: 4.6, reviews: 31, est: '2020', about: 'A fictional neighbourhood academy for junior and secondary students, with a strong English and ICT programme.',
    teacherList: [['Ms. Jarin Tasnim', 'Biology'], ['Mr. Habib Ullah', 'Chemistry'], ['Ms. Mitu Roy', 'English']],
    batchList: [['Class 8 English', 'Sat, Mon · 4:30 PM', '৳2,200 / month'], ['SSC Biology', 'Sun, Wed · 5:00 PM', '৳2,600 / month']] },
  { id: 'nexus-learning-hub', name: 'Nexus Learning Hub', area: 'Dhanmondi', subjects: ['Accounting', 'ICT', 'Mathematics'], classes: 'HSC', teachers: 11, students: 180, batches: 9, rating: 4.8, reviews: 36, est: '2016', about: 'A fictional HSC business-studies and science coaching centre with mock exams every fortnight.',
    teacherList: [['Mr. Faruk Ahmed', 'Accounting'], ['Ms. Nilufar Yasmin', 'ICT'], ['Mr. Saiful Islam', 'Mathematics']],
    batchList: [['HSC Accounting 1st Paper', 'Sat, Mon · 6:00 PM', '৳3,500 / month'], ['HSC ICT', 'Sun, Tue · 5:00 PM', '৳3,000 / month']] },
  { id: 'crescent-care', name: 'Crescent Care Coaching', area: 'Mirpur', subjects: ['Mathematics', 'Bangla', 'English'], classes: 'Classes 6–8', teachers: 7, students: 140, batches: 6, rating: 4.5, reviews: 22, est: '2021', about: 'A fictional foundation-level coaching centre with small groups and weekly guardian updates.',
    teacherList: [['Ms. Shirin Akter', 'Mathematics'], ['Mr. Joynal Abedin', 'Bangla']],
    batchList: [['Class 6 Foundation', 'Sat, Mon, Wed · 3:30 PM', '৳1,800 / month']] },
]

export const REVIEWS = [
  { who: 'Parent, Dhanmondi', text: 'Clear explanations and a short note after every class. My son finally enjoys maths.', stars: 5, when: 'Sep 2026' },
  { who: 'Student, Uttara', text: 'Very punctual and patient. The weekly timed tests really helped before the model test.', stars: 5, when: 'Aug 2026' },
  { who: 'Parent, Mirpur', text: 'Honest feedback and never missed a class. Would recommend.', stars: 4, when: 'Jul 2026' },
]

export const FAQS: { cat: string; q: string; a: string }[] = [
  { cat: 'Getting started', q: 'How do I join TuitionHub?', a: 'Choose Sign up, pick your role (Tutor, Student, Parent / Guardian or Coaching / Institute), verify your phone and email, then complete your role verification. Until you are verified you can browse a limited dashboard, but posting, sending interest and chat stay locked.' },
  { cat: 'Getting started', q: 'Is TuitionHub free to browse?', a: 'Yes. Anyone can search tutors and tuition posts with limited details. Contacting someone needs a verified account.' },
  { cat: 'Getting started', q: 'Is this a real service?', a: 'No. This is a clickable demonstration prototype. All people, scores, reviews and payments are fictional, and there is no real OTP, payment, GPS, AI or database behind it.' },
  { cat: 'Verification', q: 'What does Identity Verified mean?', a: 'The tutor completed an identity check. In production, a reviewer would check an NID or equivalent. In this demo, no real document is collected.' },
  { cat: 'Verification', q: 'Do students and guardians get verified too?', a: 'Yes. Students receive a Student Verified badge and guardians a Verified Parent / Guardian badge, so both sides of every tuition are known.' },
  { cat: 'Matching', q: 'How does matching work?', a: 'Matching is a transparent weighted-rule score: Subject 25, Class 15, Schedule 15, Location 15, Budget 15, Verification 5, Experience 5, Preferences 5. A subject mismatch excludes a tutor. These are demo weights, not machine learning.' },
  { cat: 'Matching', q: 'What is the Trust Score?', a: 'A 0–100 score built from verification, reviews, attendance consistency, qualifications, experience, progress and response rate. It is separate from the star rating and from rank.' },
  { cat: 'Safety and privacy', q: 'Is my address shared?', a: 'No. Before agreement only an approximate area is shown. The exact address is revealed only after both sides agree, only to the tutor, and only on request.' },
  { cat: 'Safety and privacy', q: 'What do parents get notified about?', a: 'When the tutor arrives, when the class is completed, and for absences or reschedules. In this prototype, arrival and completion are simulated.' },
  { cat: 'Payments', q: 'Does TuitionHub process payments?', a: 'No. Payments are tracked only: a guardian marks a monthly fee paid in ৳ and the tutor confirms. No money moves through the platform.' },
  { cat: 'Payments', q: 'Can I leave a review any time?', a: 'Reviews unlock only after a tuition is completed, and carry a Verified Review badge.' },
  { cat: 'Account', q: 'I lost access to my phone or email. What now?', a: 'Use Account Recovery. You will describe the problem and a support reviewer follows up. No documents are requested in this demo.' },
]
