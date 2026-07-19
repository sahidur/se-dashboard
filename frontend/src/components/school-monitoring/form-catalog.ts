/**
 * School Monitoring form catalog.
 *
 * Transcribed from "Final Observation Tool for SE.xlsx" (3 sheets → 3 forms).
 * Each form is a set of sections; each section a list of Yes/No/NA indicators.
 * These definitions drive the animated section-by-section monitoring form and
 * the read-only rendering of submitted feedback.
 */

export type MonitoringFormType = 'combined' | 'quality' | 'operations';

export interface MonitoringIndicator {
  code: string;
  text: string;
}

export interface MonitoringSectionDef {
  number: string;
  title: string;
  indicators: MonitoringIndicator[];
}

export interface MonitoringFormDef {
  type: MonitoringFormType;
  title: string;
  shortTitle: string;
  description: string;
  /** Quality & Operations checklists observe a specific class. */
  hasClass: boolean;
  /** Quality & Operations checklists record the observed teacher's name. */
  hasTeacher: boolean;
  sections: MonitoringSectionDef[];
}

/** Grades available for the multi-select class/grade picker. */
export const MONITORING_GRADES: { value: string; label: string }[] = [
  { value: 'Play & Learn', label: 'Play & Learn' },
  { value: 'Nursery', label: 'Nursery' },
  { value: 'Grade 1', label: 'Grade 1' },
  { value: 'Grade 2', label: 'Grade 2' },
  { value: 'Grade 3', label: 'Grade 3' },
  { value: 'Grade 4', label: 'Grade 4' },
  { value: 'Grade 5', label: 'Grade 5' },
  { value: 'Grade 6', label: 'Grade 6' },
  { value: 'Grade 7', label: 'Grade 7' },
  { value: 'Grade 8', label: 'Grade 8' },
  { value: 'Grade 9', label: 'Grade 9' },
  { value: 'Grade 10', label: 'Grade 10' },
];

const COMBINED: MonitoringFormDef = {
  type: 'combined',
  title: 'School Observation Protocol/Tool',
  shortTitle: 'School Observation',
  description:
    'Comprehensive whole-school observation covering environment, rules, materials, pedagogy, assessment, leadership, parents, fees and co-curricular activities.',
  hasClass: false,
  hasTeacher: false,
  sections: [
    {
      number: '1',
      title: 'School environment and safety',
      indicators: [
        { code: '1.1', text: 'All rooms and open spaces are swept and mopped' },
        { code: '1.2', text: 'Toilets are clean and in usable condition' },
        { code: '1.3', text: 'Lights and fans of the classrooms are working well' },
        { code: '1.4', text: "All the furniture, including chairs and tables in the classrooms, teachers' room and office, is in good condition" },
        { code: '1.5', text: 'Whiteboards/blackboards are in usable condition' },
        { code: '1.6', text: 'No sharp object/wire etc. are in close contact of students' },
        { code: '1.7', text: 'Safe drinking water is available in the campus' },
        { code: '1.8', text: 'Electricity/water/gas/internet facilities are uninterrupted' },
        { code: '1.9', text: 'Multimedia instruments are working well' },
      ],
    },
    {
      number: '2',
      title: 'Rules and Regulations',
      indicators: [
        { code: '2.1', text: 'Teachers, staff and students arrive at school on time (Cleaner and guard: 7.30 am; teachers: 8.00 am; students: 8.30 am)' },
        { code: '2.2', text: 'Teachers are wearing their appropriate uniform' },
        { code: '2.3', text: 'Students are wearing the school uniform (tie, ID card, badge, etc.)' },
        { code: '2.4', text: 'Student attendance in all classes is over 90% throughout the month' },
        { code: '2.5', text: "In case of a teacher's absence, the alternate teacher conducts the class following the lesson plan and using appropriate teaching-learning materials" },
        { code: '2.6', text: 'Assembly starts on time in appropriate manner' },
        { code: '2.7', text: 'Classes start on time' },
        { code: '2.8', text: 'Classes are taken according to class routine' },
        { code: '2.9', text: 'All students wear neat and tidy school uniform' },
        { code: '2.10', text: 'School finishes on time' },
      ],
    },
    {
      number: '3',
      title: 'School and classroom decoration and materials',
      indicators: [
        { code: '3.1', text: 'Classrooms are well decorated with materials' },
        { code: '3.2', text: 'Display boards have appropriate and updated contents (correctly spelled word zone cards, creative work of students etc. in classrooms; school related information in other boards)' },
        { code: '3.3', text: 'Learning and play materials are preserved rightly after class and play' },
        { code: '3.4', text: 'Learning and play materials are in usable condition' },
        { code: '3.5', text: 'Charts and maps are in usable condition' },
        { code: '3.6', text: 'All students have supplementary books which are in usable condition' },
        { code: '3.7', text: 'All students have early reading books (Story Time books) which are in usable condition' },
      ],
    },
    {
      number: '4',
      title: 'Pedagogical aspects',
      indicators: [
        { code: '4.1', text: "Teachers have prepared their own lesson plan according to the Teacher's Guides/Guidelines" },
        { code: '4.2', text: 'Teachers are assessing the prior knowledge of students' },
        { code: '4.3', text: 'Teachers are using appropriate teaching-learning materials and digital content while taking class' },
        { code: '4.4', text: 'Students are actively participating in the lessons and activities' },
        { code: '4.5', text: 'Teachers are assessing the learning outcome/s of the particular lesson' },
        { code: '4.6', text: 'Children with disabilities are well involved in the lesson and teachers are giving needed attention' },
        { code: '4.7', text: 'Diaries and exercise copies are being regularly used and maintained' },
        { code: '4.8', text: 'Remedial classes are being taken according to the needs' },
      ],
    },
    {
      number: '5',
      title: 'Student assessment',
      indicators: [
        { code: '5.1', text: "Students' portfolio are kept and maintained" },
        { code: '5.2', text: 'Teachers check learning progress (e.g. workbook, home work, monthly/half yearly/annual assessment scripts etc.) regularly and give appropriate feedback to students' },
        { code: '5.3', text: 'Teachers conduct formative assessment in the class' },
        { code: '5.4', text: 'Summative assessment scores and feedback are recorded properly in the report card' },
        { code: '5.5', text: 'Assessment feedback is given to students and parents (check the assessment scripts/workbooks if need be)' },
        { code: '5.6', text: 'Assessment scripts and scores are appropriately reported in the register' },
      ],
    },
    {
      number: '6',
      title: 'Instructional leadership and teacher development',
      indicators: [
        { code: '6.1', text: 'Head Teacher observes classes regularly as per instruction/schedule' },
        { code: '6.2', text: 'Head Teacher assists teachers taking preparation for the next class' },
        { code: '6.3', text: "Head Teacher conducts teachers' development forum according to the schedule" },
        { code: '6.4', text: "Teachers' Development Forum agenda and meeting notes are recorded regularly" },
        { code: '6.5', text: 'Head Teacher resolves problems raised by teachers regularly; list few problems those are being solved by the HT' },
        { code: '6.6', text: 'Monthly refreshers has been conducted. Name the topic' },
      ],
    },
    {
      number: '7',
      title: 'Parent involvement',
      indicators: [
        { code: '7.1', text: 'Parent meeting conducted as per schedule' },
        { code: '7.2', text: 'Percentage of parents have attended the parents meeting' },
        { code: '7.3', text: 'Parents meeting agenda (from both teachers and parents) is discussed in participatory method' },
        { code: '7.4', text: 'Parents complaints have been considered and resolved' },
        { code: '7.5', text: 'Parents are contacted for absent students (The class teacher followed up with the students absent for two consecutive days)' },
      ],
    },
    {
      number: '8',
      title: 'Fee Collection',
      indicators: [
        { code: '8.1', text: 'Admission fee/session fee collected and deposited as per target' },
        { code: '8.2', text: 'Tuition fee collected and deposited as per target' },
        { code: '8.3', text: 'Material fee collected and deposited as per target' },
        { code: '8.4', text: 'Assessment fee collected and deposited as per target' },
      ],
    },
    {
      number: '9',
      title: 'Co-curricular activities',
      indicators: [
        { code: '9.1', text: 'Play Zone/Fun Station activities are being maintained according to the module and schedule' },
        { code: '9.2', text: 'Club activities are practised regularly' },
        { code: '9.3', text: 'Corner activities are practised regularly' },
        { code: '9.4', text: 'Creative writing/wall magazine/word zone/display boards are regularly updated and maintained' },
      ],
    },
    {
      number: '10',
      title: 'Others',
      indicators: [
        { code: '10.1', text: 'School Management Committee is formed and functional' },
        { code: '10.2', text: 'SMC meetings are conducted according to schedule' },
      ],
    },
  ],
};

const QUALITY: MonitoringFormDef = {
  type: 'quality',
  title: 'School Monitoring Checklist – Quality',
  shortTitle: 'Quality Monitoring',
  description:
    'Classroom quality checklist covering teaching & learning, student assessment, instructional leadership and parent involvement for a specific class.',
  hasClass: true,
  hasTeacher: true,
  sections: [
    {
      number: '1',
      title: 'Teaching and learning',
      indicators: [
        { code: '1.1', text: 'Classes are being taken according to class routine' },
        { code: '1.2', text: 'Students are well managed and disciplined' },
        { code: '1.3', text: "Teachers have taken preparation according to the lesson plans of Teacher's Guides" },
        { code: '1.4', text: 'Teachers are assessing the prior knowledge of students' },
        { code: '1.5', text: 'Teachers are using appropriate teaching-learning materials and digital content while taking class' },
        { code: '1.6', text: 'Students are participating in the lessons' },
        { code: '1.7', text: 'Teachers are assessing the learning of the students of that particular lesson' },
        { code: '1.8', text: 'Children with special needs are well involved in the class and teachers are giving special attention' },
        { code: '1.9', text: 'Special classes are taken according to routine' },
      ],
    },
    {
      number: '2',
      title: 'Student assessment',
      indicators: [
        { code: '2.1', text: "Daily performance of students' learning and its documentation in given format is done by teachers regularly" },
        { code: '2.2', text: 'Teachers check scripts regularly and give appropriate feedback to students' },
        { code: '2.3', text: 'Teachers conduct formative assessment in the class' },
        { code: '2.4', text: 'Tutorial and summative questions are prepared according to instructions' },
        { code: '2.5', text: 'Tutorial and summative answer scripts are checked properly by teachers' },
        { code: '2.6', text: 'Tutorial and summative examination scores are recorded properly' },
        { code: '2.7', text: 'Examination feedback is given to students and parents' },
      ],
    },
    {
      number: '3',
      title: 'Instructional leadership and Teacher development',
      indicators: [
        { code: '3.1', text: 'Head Teacher observes classes regularly as per instruction/schedule' },
        { code: '3.2', text: 'Head Teacher assists teachers taking preparation for the next class' },
        { code: '3.3', text: 'Head Teacher conducts Saturday meetings regularly' },
        { code: '3.4', text: 'Meeting agenda and meeting note is recorded regularly for Saturday meetings' },
        { code: '3.5', text: 'Head Teacher resolves problems raised by teachers regularly' },
        { code: '3.6', text: 'Monthly refreshers has been conducted' },
      ],
    },
    {
      number: '4',
      title: 'Parent involvement',
      indicators: [
        { code: '4.1', text: 'Parent meeting conducted as per schedule' },
        { code: '4.2', text: '90% parents attend parents meeting' },
        { code: '4.3', text: 'Parents meeting agenda (from both teachers and parents) is discussed in participatory method' },
        { code: '4.4', text: 'Parents complaints have been considered and resolved' },
        { code: '4.5', text: 'Parents are contacted for absent students' },
      ],
    },
  ],
};

const OPERATIONS: MonitoringFormDef = {
  type: 'operations',
  title: 'School Monitoring Checklist – Operations and Management',
  shortTitle: 'Operations & Management',
  description:
    'Operations checklist covering environment & safety, rules, classroom materials and fee collection for a specific class.',
  hasClass: true,
  hasTeacher: true,
  sections: [
    {
      number: '1',
      title: 'School and classroom environment and safety',
      indicators: [
        { code: '1.1', text: 'All rooms and open spaces are swept and mopped' },
        { code: '1.2', text: 'Toilets are clean and in usable condition' },
        { code: '1.3', text: 'Lights and fans of the classrooms are working well' },
        { code: '1.4', text: "Chairs and tables of classrooms, teacher's room and office room are in good condition" },
        { code: '1.5', text: 'Whiteboards are in usable condition' },
        { code: '1.6', text: 'No sharp object/wire etc. are in close contact of students' },
        { code: '1.7', text: 'Water filter is clean and in usable condition' },
        { code: '1.8', text: 'Electricity/water/gas/internet facilities are uninterrupted' },
        { code: '1.9', text: 'Multimedia instruments are working well' },
      ],
    },
    {
      number: '2',
      title: 'Rules and Regulations',
      indicators: [
        { code: '2.1', text: 'Teachers, staff and students enter school on time (By-Cleaner and Guard 7.30am, Teachers 8am, Students 8.30am)' },
        { code: '2.2', text: 'Student attendance in all classes is over 90% throughout the month' },
        { code: '2.3', text: 'Alternative teacher takes class in case of leave of any teacher' },
        { code: '2.4', text: 'Assembly starts on time in appropriate manner' },
        { code: '2.5', text: 'Classes start on time' },
        { code: '2.6', text: 'Classes are taken according to class routine' },
        { code: '2.7', text: 'All students wear neat and tidy school uniform' },
        { code: '2.8', text: 'School finishes on time' },
      ],
    },
    {
      number: '3',
      title: 'School and classroom decoration and materials',
      indicators: [
        { code: '3.1', text: 'Classrooms are well decorated with materials' },
        { code: '3.2', text: 'Display boards have appropriate and updated contents (correctly spelled word zone cards, creative work of students etc. in classrooms; school related information in other boards)' },
        { code: '3.3', text: 'Learning and play materials are preserved rightly after class' },
        { code: '3.4', text: 'Play materials are in usable condition' },
        { code: '3.5', text: 'Charts and maps are in usable condition' },
        { code: '3.6', text: 'All students have supplementary books which are in usable condition' },
        { code: '3.7', text: 'All students have early reading books which are in usable condition' },
      ],
    },
    {
      number: '4',
      title: 'Fee Collection',
      indicators: [
        { code: '4.1', text: 'Admission fee collected and deposited as per target' },
        { code: '4.2', text: 'Tuition fee collected and deposited as per target' },
        { code: '4.3', text: 'Material fee collected and deposited as per target' },
        { code: '4.4', text: 'Exam fee collected and deposited as per target' },
      ],
    },
  ],
};

export const MONITORING_FORMS: Record<MonitoringFormType, MonitoringFormDef> = {
  combined: COMBINED,
  quality: QUALITY,
  operations: OPERATIONS,
};

export const MONITORING_FORM_LIST: MonitoringFormDef[] = [
  COMBINED,
  QUALITY,
  OPERATIONS,
];

export function getMonitoringForm(type: string): MonitoringFormDef | undefined {
  return MONITORING_FORMS[type as MonitoringFormType];
}

export function totalIndicators(form: MonitoringFormDef): number {
  return form.sections.reduce((n, s) => n + s.indicators.length, 0);
}
