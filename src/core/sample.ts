import type { Workspace } from './workspace'

/** The sample data. Each evaluation task starts from a fresh copy of this state. */
export function sampleWorkspace(): Workspace {
  return structuredClone(SAMPLE)
}

const SAMPLE: Workspace = {
  view: { app: 'mail', page: 0 },
  mails: [
    {
      id: 'mail-newsletter',
      from: 'Riverside Clinic',
      subject: 'Clinic news for December',
      pages: [
        'The clinic has new hours in December. We open at 8 AM on weekdays and at 10 AM on Saturdays.',
        'Flu shots are available at the front desk. You do not need an appointment. Bring your insurance card.',
        'The clinic closes on 25 December and on 1 January. For urgent care on those days, call the hospital line.',
      ],
      unread: true,
      readToEnd: false,
      archived: false,
      drafts: ['Thank you for the update.', 'Can I book a flu shot?', 'What are the hours on Sunday?'],
    },
    {
      id: 'mail-lunch',
      from: 'Dana Lee',
      subject: 'Invitation: Team lunch on Friday',
      pages: ['You are invited to the team lunch on Friday, 4 December, from 12:00 to 13:00 at the Green Cafe.'],
      unread: true,
      readToEnd: false,
      archived: false,
      invite: { title: 'Team lunch', start: '2026-12-04T12:00', end: '2026-12-04T13:00' },
      drafts: ['I am not well today.', 'I have a doctor visit then.', 'I have another meeting then.'],
    },
    {
      id: 'mail-bookclub',
      from: 'Ana Ruiz',
      subject: 'Invitation: Book club on Tuesday',
      pages: ['Book club meets on Tuesday, 8 December, from 18:00 to 19:30 in the library. We read chapter 4.'],
      unread: true,
      readToEnd: false,
      archived: false,
      invite: { title: 'Book club', start: '2026-12-08T18:00', end: '2026-12-08T19:30' },
      drafts: ['I am not well this week.', 'I have a doctor visit then.', 'I did not finish the book.'],
    },
    {
      id: 'mail-pharmacy',
      from: 'Corner Pharmacy',
      subject: 'Your order is ready',
      pages: ['Your order is ready for pickup. The pharmacy keeps it for 7 days.'],
      unread: false,
      readToEnd: true,
      archived: false,
      drafts: ['Thank you.', 'Please deliver it to my home.', 'I will pick it up tomorrow.'],
    },
    {
      id: 'mail-deals',
      from: 'City Market',
      subject: 'Weekly deals',
      pages: ['This week: apples, bread, and tea cost less. The deals end on Sunday.'],
      unread: false,
      readToEnd: true,
      archived: false,
      drafts: ['Please remove me from this list.', 'Thank you.', 'Do you deliver?'],
    },
  ],
  threads: [
    {
      id: 'thread-caregiver',
      contact: 'Sam (caregiver)',
      messages: [{ from: 'them', text: 'I am in the kitchen. Send a message if you need me.' }],
      drafts: ['I need water.', 'Please help me change position.', 'Thank you, Sam.'],
    },
    {
      id: 'thread-mom',
      contact: 'Mom',
      messages: [{ from: 'them', text: 'Are you free to talk tonight?' }],
      drafts: ['Yes, I am free to talk after dinner.', 'Not tonight. Can we talk tomorrow?', 'I love you, Mom.'],
    },
    {
      id: 'thread-ana',
      contact: 'Ana Ruiz',
      messages: [
        { from: 'them', text: 'Did you like the book?' },
        { from: 'me', text: 'Yes, very much.' },
      ],
      drafts: ['See you at book club.', 'Which book is next?', 'Thank you, Ana.'],
    },
  ],
  events: [{ id: 'event-therapy', title: 'Physical therapy', start: '2026-12-03T10:00', end: '2026-12-03T11:00' }],
  notes: [
    { id: 'note-shopping', title: 'Shopping list', body: 'Milk, bread, apples, and green tea.' },
    { id: 'note-doctor', title: 'Doctor questions', body: 'Ask about the new medicine and about sleep.' },
    { id: 'note-gifts', title: 'Gift ideas', body: 'A book of poems for Ana. A scarf for Mom.' },
  ],
  todos: [
    { id: 'todo-pharmacy', text: 'Call the pharmacy', done: false },
    { id: 'todo-plants', text: 'Water the plants', done: false },
    { id: 'todo-chapter', text: 'Read chapter 4', done: true },
  ],
}
