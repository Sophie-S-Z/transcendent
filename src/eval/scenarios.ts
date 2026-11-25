// Scenario packs for demo mode. Each pack has its own sample data and its own tasks with an automatic done() check.
// The profiles are illustrative. They are not real people.
// 'eval' is the measured set: the 10 tasks and the 5 help tests on the original sample data.

import { sampleWorkspace } from '../core/sample'
import { CAREGIVER, words, type Mail, type Workspace } from '../core/workspace'
import { HELP_TESTS, helpDone, lastFromMe, mail, normalize, TASKS, type Task } from './tasks'

export type Scenario = {
  id: string
  name: string
  profile: string
  signal: string
  workspace: () => Workspace
  tasks: Task[]
}

// The read state of a mail: new and unread, or already read.
const NEW = { unread: true, readToEnd: false, archived: false }
const READ = { unread: false, readToEnd: true, archived: false }

const copy = (ws: Workspace) => () => structuredClone(ws)
const from = (start: () => Workspace, list: (Omit<Task, 'start'> & { start?: () => Workspace })[]): Task[] =>
  list.map((t) => ({ start, ...t }))
/** True when the user wrote a new note that the start data did not have, and the check passes on its body. */
const newNote = (start: Workspace, ok: (body: string) => boolean) => {
  const old = new Set(start.notes.map((n) => n.id))
  return (ws: Workspace) => ws.notes.some((n) => !old.has(n.id) && ok(n.body))
}
const sam = (text: string) => ({
  id: CAREGIVER,
  contact: 'Sam (caregiver)',
  messages: [{ from: 'them' as const, text }],
  drafts: ['I need water.', 'Please help me change position.', 'Thank you, Sam.'],
})

const CARE: Workspace = {
  view: { app: 'mail', page: 0 },
  mails: [
    {
      id: 'mail-nurse',
      from: 'Hillside Care Team',
      subject: 'Nurse visit on Thursday',
      pages: ['Nurse Ruth visits on Thursday at 10 AM. She checks your breathing mask and your skin.'],
      ...NEW,
      drafts: ['Thank you. Thursday is fine.', 'Can Ruth come in the afternoon?', 'Please talk to Sam about the visit.'],
    },
    {
      id: 'mail-group',
      from: 'ALS Support Group',
      subject: 'Notes from the online meeting',
      pages: [
        'Thank you for joining on Monday. We talked about sleep and about new eye-gaze tools.',
        'The next meeting is on 14 December. Family members are welcome too.',
      ],
      ...NEW,
      drafts: ['Thank you for the notes.', 'Nora will join next time.', 'Please send me the link.'],
    },
    {
      id: 'mail-audio',
      from: 'Audio Library',
      subject: 'New audiobooks this month',
      pages: ['This month we added three mystery novels and a travel book about Portugal.'],
      ...READ,
      drafts: ['Please add the travel book to my list.', 'Thank you.', 'Please remove me from this list.'],
    },
  ],
  threads: [
    sam('I am in the kitchen. Send a message if you need me.'),
    {
      id: 'thread-daughter',
      contact: 'Nora (daughter)',
      messages: [{ from: 'them', text: 'Can I visit tonight? Is six a good time?' }],
      drafts: ['Yes, come at six.', 'Not tonight. Come tomorrow.', 'I love you, Nora.'],
    },
    {
      id: 'thread-tom',
      contact: 'Tom (brother)',
      messages: [{ from: 'them', text: 'I found the old photos from the lake. I will bring them on Sunday.' }],
      drafts: ['I cannot wait to see them.', 'Sunday is good.', 'Thank you, Tom.'],
    },
  ],
  events: [{ id: 'event-nurse', title: 'Nurse visit', start: '2026-12-03T10:00', end: '2026-12-03T11:00' }],
  notes: [
    { id: 'note-comfort', title: 'Comfort', body: 'Pillow under the left knee. Window open a little at night.' },
    { id: 'note-music', title: 'Music', body: 'Jazz in the evening. No radio in the morning.' },
    { id: 'note-visitors', title: 'Visitors', body: 'Nora on weekdays after work. Tom on Sundays.' },
  ],
  todos: [
    { id: 'todo-photos', text: 'Choose photos for Nora', done: false },
    { id: 'todo-voice', text: 'Record a voice message for Tom', done: true },
  ],
}

const WORK: Workspace = {
  view: { app: 'mail', page: 0 },
  mails: [
    {
      id: 'mail-team',
      from: 'Priya Shah',
      subject: 'Invitation: Team meeting on Monday',
      pages: ['The weekly team meeting is on Monday, 7 December, from 9:30 to 10:00 by video.'],
      ...NEW,
      invite: { title: 'Team meeting', start: '2026-12-07T09:30', end: '2026-12-07T10:00' },
      drafts: ['I will be there.', 'Can we start at ten?', 'I will join by video.'],
    },
    {
      id: 'mail-late',
      from: 'Marco Diaz',
      subject: 'Invitation: Budget review at 19:00',
      pages: ['Can we do the budget review on Tuesday, 8 December, from 19:00 to 20:00? It is the only free time I have.'],
      ...NEW,
      invite: { title: 'Budget review', start: '2026-12-08T19:00', end: '2026-12-08T20:00' },
      drafts: ['I cannot join meetings after six.', 'I have a care visit at that time.', 'Please send me the numbers before.'],
    },
    {
      id: 'mail-client',
      from: 'Northwind Foods',
      subject: 'Invitation: Client call on Wednesday',
      pages: ['Our call about the sales report is on Wednesday, 9 December, from 14:00 to 14:45.'],
      ...NEW,
      invite: { title: 'Client call', start: '2026-12-09T14:00', end: '2026-12-09T14:45' },
      drafts: ['Thank you. See you on Wednesday.', 'Can we move it to Thursday?', 'Please send the agenda.'],
    },
    {
      id: 'mail-manager',
      from: 'Helen Brooks',
      subject: 'Q4 report draft',
      pages: ['Can you send me the first draft of the Q4 report by Friday? A short summary is enough for now.'],
      ...NEW,
      drafts: ['Yes, I will send it by Friday.', 'I need one more day for the draft.', 'Can we talk about it on Monday?'],
    },
    {
      id: 'mail-news',
      from: 'Data Weekly',
      subject: 'Data Weekly: issue 48',
      pages: ['This week: five ways to clean messy tables, and a short guide to charts that people can read.'],
      ...READ,
      drafts: ['Thank you.', 'Please remove me from this list.', 'Where can I read older issues?'],
    },
  ],
  threads: [
    sam('I am out until noon. Send a message if you need me.'),
    {
      id: 'thread-priya',
      contact: 'Priya Shah',
      messages: [{ from: 'them', text: 'Do you have the sales numbers for the meeting?' }],
      drafts: ['Yes, I will share them on Monday.', 'Not yet. I will have them tomorrow.', 'Thank you, Priya.'],
    },
  ],
  events: [
    { id: 'event-focus', title: 'Focus time', start: '2026-12-07T13:00', end: '2026-12-07T15:00' },
    { id: 'event-physio', title: 'Physical therapy', start: '2026-12-08T10:00', end: '2026-12-08T11:00' },
  ],
  notes: [
    { id: 'note-outline', title: 'Report outline', body: 'Sales by region, top products, and the plan for next year.' },
    { id: 'note-helen', title: 'Questions for Helen', body: 'Which regions go first? Do we show the old numbers too?' },
  ],
  todos: [
    { id: 'todo-numbers', text: 'Check the sales numbers', done: false },
    { id: 'todo-dashboard', text: 'Update the dashboard', done: false },
  ],
}

const STUDY: Workspace = {
  view: { app: 'mail', page: 0 },
  mails: [
    {
      id: 'mail-course',
      from: 'Dr. Okafor',
      subject: 'Biology 101: plan for week 6',
      pages: [
        'This week we study how cells make energy. Read chapter 6 before the lecture on Tuesday.',
        'The lab on Thursday uses the microscopes in room 210. Bring the lab sheet.',
        'Office hours move to Friday this week, from 13:00 to 15:00.',
      ],
      ...NEW,
      drafts: ['Thank you for the plan.', 'Can I get the slides before the lecture?', 'I will come to office hours.'],
    },
    {
      id: 'mail-library',
      from: 'Campus Library',
      subject: 'Your book is due on Friday',
      pages: ['Please return "Cell Biology Basics" by Friday, or renew it online.'],
      ...NEW,
      drafts: ['Please renew the book.', 'I will return it on Friday.', 'Thank you.'],
    },
    {
      id: 'mail-services',
      from: 'Disability Services',
      subject: 'Your support plan',
      pages: ['Your support plan is ready. You get a note taker in lectures and a quiet room for tests.'],
      ...READ,
      drafts: ['Thank you for the plan.', 'Can we meet next week?', 'Please send it to my teachers.'],
    },
  ],
  threads: [
    sam('I pick you up after the lab at four.'),
    {
      id: 'thread-jun',
      contact: 'Jun (classmate)',
      messages: [{ from: 'them', text: 'Do you want to study together on Sunday?' }],
      drafts: ['Yes, Sunday is good.', 'Can we do Saturday?', 'Thank you, Jun.'],
    },
  ],
  events: [
    { id: 'event-lecture', title: 'Biology lecture', start: '2026-12-08T10:00', end: '2026-12-08T11:30' },
    { id: 'event-lab', title: 'Biology lab', start: '2026-12-10T14:00', end: '2026-12-10T16:00' },
  ],
  notes: [
    { id: 'note-cells', title: 'Cells', body: 'Cells make energy in the mitochondria.' },
    { id: 'note-exam', title: 'Biology plan', body: 'The final exam is on 15 December. Review chapters 3 to 6.' },
    { id: 'note-reading', title: 'Reading list', body: 'Chapter 6, then the lab sheet, then the essay notes.' },
  ],
  todos: [
    { id: 'todo-essay', text: 'Submit essay', done: false },
    { id: 'todo-sheet', text: 'Print the lab sheet', done: false },
    { id: 'todo-book', text: 'Return the library book', done: true },
  ],
}

const HEALTH: Workspace = {
  view: { app: 'mail', page: 0 },
  mails: [
    {
      id: 'mail-doctor',
      from: 'Lakeside Medical',
      subject: 'Invitation: Check-up with Dr. Patel',
      pages: ['Your check-up with Dr. Patel is on Thursday, 10 December, from 9:00 to 9:30.'],
      ...NEW,
      invite: { title: 'Check-up with Dr. Patel', start: '2026-12-10T09:00', end: '2026-12-10T09:30' },
      drafts: ['I will be there.', 'Can we move it to the afternoon?', 'My son will drive me.'],
    },
    {
      id: 'mail-speech',
      from: 'Speech Therapy Center',
      subject: 'Your exercises for this week',
      pages: [
        'Say each word slowly three times: water, window, morning.',
        'Then read one short page of a book out loud. Ten minutes a day is enough.',
      ],
      ...NEW,
      drafts: ['Thank you.', 'The exercises are hard for me.', 'Can we talk at the next visit?'],
    },
    {
      id: 'mail-plan',
      from: 'Health Plan',
      subject: 'Your new member card',
      pages: ['Your new member card is in the mail. Keep the old card until the new one arrives.'],
      ...READ,
      drafts: ['Thank you.', 'I did not get the card.', 'Please call my son.'],
    },
  ],
  threads: [
    sam('I come at noon to make lunch.'),
    {
      id: 'thread-pharmacy',
      contact: 'Corner Pharmacy',
      messages: [{ from: 'them', text: 'Your blood pressure pills are ready. We deliver on Friday.' }],
      drafts: ['Thank you.', 'Please deliver on Friday.', 'My son will pick them up.'],
    },
    {
      id: 'thread-son',
      contact: 'David (son)',
      messages: [{ from: 'them', text: 'How are you today, Dad?' }],
      drafts: ['I feel fine today.', 'I am tired today.', 'Please call me tonight.'],
    },
  ],
  events: [{ id: 'event-speech', title: 'Speech therapy', start: '2026-12-08T11:00', end: '2026-12-08T12:00' }],
  notes: [
    { id: 'note-pills', title: 'Pills', body: 'The white pill in the morning with food.' },
    { id: 'note-questions', title: 'Questions for Dr. Patel', body: 'Ask about my right hand and about sleep.' },
  ],
  todos: [
    { id: 'todo-walk', text: 'Walk for ten minutes', done: false },
    { id: 'todo-exercises', text: 'Do the speech exercises', done: false },
  ],
}

// The judges see the care data plus one meeting invitation.
const MEETING: Mail = { ...WORK.mails[0], id: 'mail-meeting' }
const JUDGES: Workspace = { ...CARE, mails: [MEETING, ...CARE.mails] }
const saidToSam = (ws: Workspace, phrase: string) =>
  ws.threads.find((t) => t.id === CAREGIVER)!.messages.some((m) => m.from === 'me' && normalize(m.text).includes(phrase))

const care = copy(CARE)
const work = copy(WORK)
const study = copy(STUDY)
const health = copy(HEALTH)

export const SCENARIOS: Scenario[] = [
  {
    id: 'eval',
    name: 'Evaluation',
    profile: 'The measured set: 10 tasks and 5 “Call for help” tests.',
    signal: 'Held blink or any key',
    workspace: sampleWorkspace,
    tasks: [...TASKS, ...HELP_TESTS],
  },
  {
    id: 'care',
    name: 'Needs and care',
    profile: 'Maya, 54, late-stage ALS. She controls only her eyelids.',
    signal: 'Held blink',
    workspace: care,
    tasks: from(care, [
      {
        id: 'care-1',
        title: 'Ask for water',
        instruction: 'Tell Sam: “I need water”.',
        done: (ws) => normalize(lastFromMe(ws, CAREGIVER)).includes('i need water'),
      },
      {
        id: 'care-2',
        title: 'Ask to change position',
        instruction: 'Ask Sam to help you change position.',
        done: (ws) => normalize(lastFromMe(ws, CAREGIVER)) === normalize('Please help me change position.'),
      },
      {
        id: 'care-3',
        title: 'Answer your daughter',
        instruction: 'Answer your daughter: “Yes, come at six.”',
        done: (ws) => normalize(lastFromMe(ws, 'thread-daughter')) === normalize('Yes, come at six.'),
      },
      {
        id: 'care-4',
        title: 'Call for help from notes',
        instruction: 'Call for help.',
        start: () => ({ ...care(), view: { app: 'notes', page: 0 } }),
        done: helpDone,
      },
    ]),
  },
  {
    id: 'work',
    name: 'Work mail and calendar',
    profile: 'Daniel, 31, C4 spinal cord injury, works from home as an analyst.',
    signal: 'Head switch (a key press)',
    workspace: work,
    tasks: from(work, [
      {
        id: 'work-1',
        title: 'Accept the team meeting',
        instruction: 'Accept the team meeting invitation.',
        done: (ws) => mail(ws, 'mail-team')?.response?.kind === 'accepted',
      },
      {
        id: 'work-2',
        title: 'Decline the late meeting',
        instruction: 'Decline the budget review at 19:00. Give a reason of 5 words or more.',
        done: (ws) => {
          const r = mail(ws, 'mail-late')?.response
          return r?.kind === 'declined' && words(r.text).length >= 5
        },
      },
      {
        id: 'work-3',
        title: 'Add the client call',
        instruction: 'Add the client call to the calendar.',
        done: (ws) => ws.events.some((e) => e.fromMail === 'mail-client'),
      },
      {
        id: 'work-4',
        title: 'Archive the newsletter',
        instruction: 'Archive the “Data Weekly” newsletter.',
        done: (ws) => mail(ws, 'mail-news')?.archived === true,
      },
      {
        id: 'work-5',
        title: 'Reply to your manager',
        instruction: 'Reply to Helen, your manager, with one of the drafts.',
        done: (ws) => mail(ws, 'mail-manager')?.response?.kind === 'replied',
      },
    ]),
  },
  {
    id: 'study',
    name: 'Study',
    profile: 'Leila, 19, cerebral palsy, first-year student.',
    signal: 'One large switch',
    workspace: study,
    tasks: from(study, [
      {
        id: 'study-1',
        title: 'Write a lecture note',
        instruction: 'Write a note of 5 words or more about the lecture.',
        done: newNote(STUDY, (body) => words(body).length >= 5),
      },
      {
        id: 'study-2',
        title: 'Find the exam note',
        instruction: 'Find the note with the word “exam”. Open it.',
        done: (ws) => ws.view.app === 'notes' && ws.view.open === 'note-exam',
      },
      {
        id: 'study-3',
        title: 'Complete a to-do',
        instruction: 'Mark “Submit essay” as done.',
        done: (ws) => ws.todos.some((t) => t.id === 'todo-essay' && t.done),
      },
      {
        id: 'study-4',
        title: 'Read the course email',
        instruction: 'Open the course email. Read it to the end.',
        done: (ws) => mail(ws, 'mail-course')?.readToEnd === true,
      },
    ]),
  },
  {
    id: 'health',
    name: 'Health',
    profile: 'Robert, 72, after a stroke, with aphasia and weakness on the right side.',
    signal: 'Held blink or switch',
    workspace: health,
    tasks: from(health, [
      {
        id: 'health-1',
        title: 'Confirm the doctor visit',
        instruction: 'Confirm the check-up with Dr. Patel.',
        done: (ws) => mail(ws, 'mail-doctor')?.response?.kind === 'accepted',
      },
      {
        id: 'health-2',
        title: 'Read the pharmacy message',
        instruction: 'Read the message from the pharmacy.',
        done: (ws) => ws.view.app === 'messages' && ws.view.open === 'thread-pharmacy',
      },
      {
        id: 'health-3',
        title: 'Write a pill note',
        instruction: 'Write a note: “Take the blue pill at eight”.',
        done: newNote(HEALTH, (body) => normalize(body).includes('take the blue pill at eight')),
      },
      {
        id: 'health-4',
        title: 'Answer your son',
        instruction: 'Tell your son: “I feel fine today”.',
        done: (ws) => normalize(lastFromMe(ws, 'thread-son')) === normalize('I feel fine today.'),
      },
    ]),
  },
  {
    id: 'setup',
    name: 'Setup',
    profile: 'Sam, a caregiver who sets up the app.',
    signal: 'Mouse, then one key',
    workspace: sampleWorkspace,
    tasks: [],
  },
  {
    id: 'judges',
    name: 'Judges’ live demo',
    profile: 'Hackathon judges who watch for 2 minutes.',
    signal: 'Held blink only',
    workspace: copy(JUDGES),
    tasks: from(copy(JUDGES), [
      {
        id: 'judges-1',
        title: 'Water, meeting, help',
        instruction: 'Tell Sam “I need water”, accept the meeting, and call for help.',
        done: (ws) => saidToSam(ws, 'i need water') && mail(ws, 'mail-meeting')?.response?.kind === 'accepted' && helpDone(ws),
      },
    ]),
  },
]

/** The scenario with this id. An unknown id gives the evaluation set. */
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
