import { Client } from 'pg';
import * as crypto from 'crypto';
// Loads backend/.env so real credentials are never hardcoded in source.
import { config } from 'dotenv';
config();

const uuid = () => crypto.randomUUID();
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EXAMS = ['Mid-Term', 'Final', 'Monthly Test'];
const FORMS = ['ba-1', 'ba-2', 'ba-3', 'bps-1', 'bps-2', 'bss-1'];
const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4'];
const MALE = ['Mohammad Rahman','Abdul Hossain','Kamal Ahmed','Rafiqul Islam','Shahjalal Mia','Abdur Rob','Mizanur Rahman','Anisur Islam','Fazlul Haq','Nurul Huda','Golam Rabbani','Akhtar Hossain','Syed Ahmed','Bashir Uddin','Habibur Rahman','Mahbubul Alam','Khalid Hasan','Zahirul Islam','Monir Hossain','Sohel Rana','Jamal Uddin','Faruk Hossain','Nasir Ahmed','Rashidul Hasan','Tariqul Islam'];
const FEMALE = ['Fatema Khatun','Rashida Begum','Nasreen Akter','Farzana Parveen','Salma Khatun','Roksana Khatun','Shahana Akter','Jesmin Ara','Amena Begum','Hasina Khatun','Ruma Begum','Monira Khatun','Saleha Khatun','Rabeya Khatun','Jahanara Begum'];
const LOCS = ['Mirpur','Agrabad','Zindabazar','Rajshahi','Khulna','Dhanmondi','Uttara','Gulshan','Motijheel','Tejgaon'];
const DESIG = ['Head Teacher','Assistant Head Teacher','Senior Teacher','Teacher','Assistant Teacher'];
const ACTS = ['Reading Corner','Science Club','Math Club','Sports Club','Art Club','Language Club','Debate Club','Cultural Club'];
const EVENTS = [{name:'Science Fair',level:'district'},{name:'Math Olympiad',level:'upazila'},{name:'Debate Competition',level:'division'},{name:'Sports Tournament',level:'national'},{name:'Cultural Program',level:'school'},{name:'Art Competition',level:'district'},{name:'Bangla Speech Contest',level:'upazila'},{name:'English Olympiad',level:'national'}];

let ADMIN_ID = '';

const SCHOOLS = [
  { name:'Government Primary School, Mirpur', code:'GPS-MIR-001', address:'Plot 12, Road 5, Mirpur-10, Dhaka-1216', district:'Dhaka', division:'Dhaka', upazila:'Dhaka North City Corporation', phone:'+8801712345001', email:'gps.mirpur@bep.edu.bd', pname:'Abdur Rob', eyr:1985, stype:'government', scat:'primary', grades:['1','2','3','4','5'], base:{'1':{b:55,g:48},'2':{b:52,g:45},'3':{b:48,g:42},'4':{b:45,g:40},'5':{b:42,g:38}}, tch:18, fp:150, fs:0, perf:'average' as const, rm:10 },
  { name:'Model Secondary School, Agrabad', code:'MSS-AGR-002', address:'27 Agrabad CDA R/A, Chittagong-4100', district:'Chattogram', division:'Chattogram', upazila:'Chattogram City Corporation', phone:'+8801812345002', email:'model.agrabad@bep.edu.bd', pname:'Kamal Ahmed', eyr:1972, stype:'non-government', scat:'secondary', grades:['6','7','8','9','10'], base:{'6':{b:95,g:88},'7':{b:90,g:82},'8':{b:85,g:78},'9':{b:78,g:70},'10':{b:72,g:65}}, tch:28, fp:0, fs:800, perf:'good' as const, rm:16 },
  { name:'Progressive High School, Zindabazar', code:'PHS-ZIN-003', address:'45 Zindabazar, Sylhet-3100', district:'Sylhet', division:'Sylhet', upazila:'Sylhet City Corporation', phone:'+8801912345003', email:'progressive.zinda@bep.edu.bd', pname:'Rafiqul Islam', eyr:1990, stype:'non-government', scat:'secondary', grades:['6','7','8','9','10'], base:{'6':{b:78,g:72},'7':{b:75,g:68},'8':{b:70,g:62},'9':{b:65,g:58},'10':{b:60,g:52}}, tch:24, fp:0, fs:650, perf:'average' as const, rm:14 },
  { name:'Ideal School & College, Rajshahi', code:'ISC-RAJ-004', address:'88 College Road, Rajshahi-6205', district:'Rajshahi', division:'Rajshahi', upazila:'Rajshahi City Corporation', phone:'+8801712345004', email:'ideal.rajshahi@bep.edu.bd', pname:'Shahjalal Mia', eyr:1965, stype:'non-government', scat:'school_and_college', grades:['1','2','3','4','5','6','7','8','9','10'], base:{'1':{b:65,g:60},'2':{b:62,g:58},'3':{b:60,g:55},'4':{b:58,g:52},'5':{b:55,g:50},'6':{b:68,g:62},'7':{b:65,g:58},'8':{b:60,g:55},'9':{b:55,g:48},'10':{b:50,g:45}}, tch:38, fp:400, fs:1000, perf:'excellent' as const, rm:22 },
  { name:'National Academy, Khan Jahan Ali', code:'NAK-KJA-005', address:'12 Khan Jahan Ali Road, Khulna-9208', district:'Khulna', division:'Khulna', upazila:'Chuadanga', phone:'+8801812345005', email:'national.kjali@bep.edu.bd', pname:'Mizanur Rahman', eyr:1995, stype:'government', scat:'secondary', grades:['6','7','8','9','10'], base:{'6':{b:68,g:60},'7':{b:65,g:58},'8':{b:60,g:52},'9':{b:55,g:48},'10':{b:50,g:45}}, tch:20, fp:0, fs:500, perf:'average' as const, rm:12 },
];

const q = (n: number) => `$${n}`;

async function batchInsert(client: Client, table: string, cols: string[], rows: any[][]) {
  if (rows.length === 0) return;
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const colsList = cols.join(',');
    const ph = batch.map((_, j) => {
      const offset = j * cols.length;
      return `(${Array.from({length: cols.length}, (_, k) => q(k + 1 + offset)).join(',')})`;
    }).join(',');
    await client.query(`INSERT INTO bep.${table}(${colsList}) VALUES ${ph}`, batch.flat());
  }
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to DB');

  console.log('\nClearing...');
  const del = ['dc_form_drafts','dc_event_participation','dc_activity_participation','dc_alumni','dc_cocurricular','dc_pedagogical_achievement','dc_performance','dc_fee_structure_log','dc_fee_structure','dc_revenue_actual_monthly','dc_revenue_actual_total','dc_revenue_budget_monthly','dc_revenue_budget_total','dc_revenue','dc_teachers_development','dc_teacher_individual','dc_teachers_info','dc_student_performance','dc_students_performance','dc_students_info','dc_infrastructure','dc_basic_information','dc_schools','school_monitoring_submissions','user_schools'];
  for (const t of del) await client.query(`DELETE FROM bep."${t}"`);
  console.log('Cleared');

  const geo: Record<string, string> = {};
  const existGeo = await client.query('SELECT id,name,type FROM bep.geo_locations');
  for (const r of existGeo.rows) geo[`${r.type}_${r.name}`] = r.id;
  const needThanas: Record<string, string> = { 'Dhaka North City Corporation': 'Dhaka', 'Chattogram City Corporation': 'Chattogram', 'Sylhet City Corporation': 'Sylhet', 'Rajshahi City Corporation': 'Rajshahi', 'Chuadanga': 'Khulna' };
  for (const [thana, dist] of Object.entries(needThanas)) {
    if (!geo[`thana_${thana}`]) {
      if (!geo[`district_${dist}`]) {
        const divId = geo[`division_${dist}`];
        if (divId) { const nid = uuid(); await client.query("INSERT INTO bep.geo_locations(id,name,type,parent_id,\"isActive\") VALUES($1,$2,'district',$3,true)", [nid,dist,divId]); geo[`district_${dist}`] = nid; }
      }
      const distId = geo[`district_${dist}`];
      if (distId) { const nid = uuid(); await client.query("INSERT INTO bep.geo_locations(id,name,type,parent_id,\"isActive\") VALUES($1,$2,'thana',$3,true)", [nid,thana,distId]); geo[`thana_${thana}`] = nid; }
    }
  }
  console.log('Geo done');

  const ur = await client.query('SELECT id FROM bep.users LIMIT 1');
  ADMIN_ID = ur.rows[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const s of SCHOOLS) {
    console.log(`\n--- ${s.name} ---`);
    const sid = uuid();
    const ts = Object.values(s.base).reduce((a, g) => a + g.b + g.g, 0);
    const gm = Math.min(...s.grades.map(Number));
    const gx = Math.max(...s.grades.map(Number));

    await client.query(
      `INSERT INTO bep.dc_schools(id,name,code,address,district,division,upazila,phone,email,principal_name,established_year,school_type,school_category,government_approval,total_teachers,total_students,grade_coverage,created_by_id) VALUES(${q(1)},${q(2)},${q(3)},${q(4)},${q(5)},${q(6)},${q(7)},${q(8)},${q(9)},${q(10)},${q(11)},${q(12)},${q(13)},${q(14)},${q(15)},${q(16)},${q(17)},${q(18)})`,
      [sid,s.name,s.code,s.address,s.district,s.division,s.upazila,s.phone,s.email,s.pname,s.eyr,s.stype,s.scat,true,s.tch,ts,`${gm}-${gx}`,ADMIN_ID]
    );

    // Basic info + infrastructure for both years
    const biRows: any[][] = [];
    const infRows: any[][] = [];
    for (const yr of ['2025','2026']) {
      biRows.push([uuid(),sid,yr,s.scat,'Bangla','Single',s.rm>=10,s.perf!=='average',s.perf==='excellent',s.scat!=='primary',true,s.perf!=='average',true,true,s.rm,s.rm-rand(0,1),ADMIN_ID]);
      const lib = s.perf==='average'?0:1, lab = s.perf==='excellent'?1:0, rtot=s.rm+4;
      const wM=rand(2,4),wF=rand(3,6),oth=rand(5,10);
      const digi=Math.min(s.rm,Math.floor(s.rm*0.6));
      infRows.push([uuid(),sid,yr,pick(['good','satisfactory']),pick(['good','satisfactory','needs_renovation']),1,1,s.rm,0,lib,lab,1,0,1,oth,rtot,wM,wF,true,s.rm>=10,s.perf==='excellent',s.perf==='average',digi,s.rm,s.rm-rand(0,1),s.rm,Math.random()>0.5,s.perf==='average',ADMIN_ID]);
    }
    await batchInsert(client,'dc_basic_information',['id','school_id','academic_year','school_category','medium_of_instruction','shift_system','has_playground','has_library','has_computer_lab','has_science_lab','has_electricity','has_internet','has_drinking_water','has_sanitary_facilities','total_classrooms','operational_classrooms','created_by_id'],biRows);
    await batchInsert(client,'dc_infrastructure',['id','school_id','academic_year','campus_status','building_status','room_head_teachers','room_teachers','room_classroom','room_playroom','room_library','room_lab','room_storeroom','room_kitchen','room_sickbay','room_others','room_total','washroom_male','washroom_female','has_hand_wash_point','has_playground','has_school_garden','infra_renovation_required','digitally_equipped_classrooms','floor_sitting_classrooms','classrooms_with_whiteboard','classrooms_with_blackboard','classroom_new_furniture','classroom_renovation_required','created_by_id'],infRows);
    console.log('  Basic+Infra OK');

    // Teachers info
    const n = s.tch, male=Math.floor(n*rand(40,55)/100), perm=Math.floor(n*rand(60,80)/100), trn=Math.floor(n*rand(70,92)/100);
    await client.query(
      `INSERT INTO bep.dc_teachers_info(id,school_id,total_teachers_male,total_teachers_female,permanent_teachers,contract_teachers,trained_teachers,untrained_teachers,avg_experience_years,teacher_student_ratio,vacant_positions,teachers_with_bed,teachers_with_med,created_by_id) VALUES(${q(1)},${q(2)},${q(3)},${q(4)},${q(5)},${q(6)},${q(7)},${q(8)},${q(9)},${q(10)},${q(11)},${q(12)},${q(13)},${q(14)})`,
      [uuid(),sid,male,n-male,perm,n-perm,trn,n-trn,randF(5,15),Math.round(ts/n),rand(0,3),Math.floor(n*rand(30,50)/100),Math.floor(n*rand(10,25)/100),ADMIN_ID]
    );

    // Teacher individuals
    const subs = s.scat==='primary'?['Bangla','Mathematics','English','Science','Social Science']:['Bangla','Mathematics','English','Physics','Chemistry','Biology','Social Science','ICT','Accounting','Geography'];
    const tiRows: any[][] = [];
    for (let i=0;i<n;i++) {
      const m=i<Math.floor(n*0.5);
      tiRows.push([uuid(),sid,pick(['2025','2026']),m?pick(MALE):pick(FEMALE),pick(DESIG),m?'male':'female',pick(['BSc','BA','BEd','MSc','MA','MEd']),rand(1,25),[pick(subs),pick(subs)].join(', '),pick(['Basic Training','Subject Training','Leadership','ICT Skills']),rand(55,95),ADMIN_ID]);
    }
    await batchInsert(client,'dc_teacher_individual',['id','school_id','academic_year','name','designation','gender','educational_qualification','experience_years','subject_expertise','training_received','assessment_score','created_by_id'],tiRows);
    console.log('  Teachers OK');

    // Revenue + Performance + Pedagogical (annual)
    const revRows: any[][] = [];
    const perfRows: any[][] = [];
    const pedRows: any[][] = [];
    for (const yr of ['2025','2026']) {
      const bf = s.fp>0?s.fp:s.fs;
      const ym=yr==='2026'?1.07:1;
      const tu=Math.round(ts*bf*ym), adm=Math.round(ts*rand(50,200)*ym), ex=Math.round(ts*rand(100,300)*ym);
      const gov=Math.round(tu*rand(1.5,3)), don=rand(50000,300000), oth=rand(20000,100000);
      const tot=tu+adm+ex+gov+don+oth, sal=Math.round(tot*rand(0.65,0.78)), maint=rand(100000,500000);
      revRows.push([uuid(),sid,yr,tu,adm,ex,tot,gov,don,oth,sal+maint,sal,maint,Math.round(tot*rand(0.02,0.08)),randF(85,97),ADMIN_ID]);

      const pb=s.perf==='excellent'?4.2:s.perf==='good'?3.7:3.2, yb=yr==='2026'?0.1:0, po=s.perf==='excellent'?15:s.perf==='good'?8:0;
      perfRows.push([uuid(),sid,yr,randF(72+po,95),randF(pb+yb-0.3,pb+yb+0.3),randF(68+po+3,94),randF(pb+yb-0.2,pb+yb+0.2),rand(5,25),rand(2,12),rand(3,15),rand(2,10),rand(3,12),rand(8,40),pick(['Interactive','Student-Centered','Mixed Method','Activity-Based']),ADMIN_ID]);

      const ym2=yr==='2026'?1.1:1;
      pedRows.push([uuid(),sid,yr,Math.round(rand(30,80)*ym2),Math.round(rand(5,15)*ym2),'Play-based learning',Math.round(rand(150,350)*ym2),Math.round(rand(15,50)*ym2),'Project-based approach',Math.round(rand(100,280)*ym2),Math.round(rand(10,40)*ym2),'Collaborative learning',Math.round(rand(80,200)*ym2),Math.round(rand(8,30)*ym2),'Exam-focused strategy',Math.round(rand(10,30)*ym2),Math.round(rand(2,8)*ym2),'Community engagement',ADMIN_ID]);
    }
    await batchInsert(client,'dc_revenue',['id','school_id','academic_year','monthly_tuition_fee','admission_fee','exam_fee','total_annual_revenue','government_grant','donations_received','other_income','total_expenditure','salary_expenditure','maintenance_expenditure','pending_fee_amount','fee_collection_rate','created_by_id'],revRows);
    await batchInsert(client,'dc_performance',['id','school_id','academic_year','avg_pass_rate','avg_gpa','board_exam_pass_rate','board_exam_avg_gpa','extracurricular_activities','sports_achievements','cultural_activities','science_fair_participation','debate_competitions','total_awards','teaching_methodology','created_by_id'],perfRows);
    await batchInsert(client,'dc_pedagogical_achievement',['id','school_id','year','kg_participated','kg_scholarship','kg_unique_approach','primary_participated','primary_scholarship','primary_unique_approach','jr_participated','jr_scholarship','jr_unique_approach','ssc_participated','ssc_scholarship','ssc_unique_approach','others_participated','others_scholarship','others_unique_approach','created_by_id'],pedRows);
    console.log('  Revenue+Perf OK');

    // Yearly batch inserts
    for (const yr of ['2025','2026']) {
      const ym=yr==='2026'?1.03:1, ym2=yr==='2026'?1.07:1;
      const bf=s.fp>0?s.fp:s.fs;

      // Students info
      const siRows: any[][] = [];
      for (const mo of MONTHS) {
        const mi=MONTHS.indexOf(mo), sf=1-(mi>6?randF(0.01,0.03):0);
        for (const gr of s.grades) {
          const base=s.base[gr]; if(!base) continue;
          const boys=Math.max(0,Math.round(base.b*ym*sf+rand(-2,2)));
          const girls=Math.max(0,Math.round(base.g*ym*sf+rand(-2,2)));
          const tot=boys+girls;
          siRows.push([uuid(),sid,yr,mo,gr,boys,girls,tot,Math.max(0,rand(0,Math.floor(tot*0.03))),Math.max(0,rand(0,Math.floor(tot*0.05))),randF(78,96),randF(1,6),randF(1,4),randF(92,99),rand(0,1),ADMIN_ID]);
        }
      }
      await batchInsert(client,'dc_students_info',['id','school_id','academic_year','month','grade','boys','girls','total','persons_with_disability','ethnic','attendance_rate','dropout_rate','replaced_students_rate','retention_rate','remedial_support','created_by_id'],siRows);

      // Students performance
      const spRows: any[][] = [];
      const pb2=s.perf==='excellent'?0.9:s.perf==='good'?0.82:0.72;
      for (const gr of s.grades) {
        const base=s.base[gr]; if(!base) continue;
        const num=base.b+base.g;
        for (const exam of EXAMS) {
          const app=Math.round(num*randF(0.9,1.0));
          const passed=Math.round(app*randF(pb2-0.05,pb2+0.08));
          const ap=Math.round(passed*randF(0.05,0.12));
          const a=Math.round(passed*randF(0.12,0.22));
          const am=Math.round(passed*randF(0.10,0.18));
          const b=Math.round(passed*randF(0.20,0.30));
          const c=Math.round(passed*randF(0.10,0.18));
          const d=Math.max(0,passed-ap-a-am-b-c);
          const f=Math.max(0,app-passed);
          const pg=Math.round(num*randF(0.3,0.5));
          const ps=Math.round(num*randF(0.25,0.4));
          spRows.push([uuid(),sid,yr,gr,num,exam,Math.round((app/num)*100),ap,a,am,b,c,d,f,pg,ps,Math.max(0,num-pg-ps),ADMIN_ID]);
        }
      }
      await batchInsert(client,'dc_students_performance',['id','school_id','academic_year','grade','number_of_students','exam_name','students_appeared_percent','grade_a_plus','grade_a','grade_a_minus','grade_b','grade_c','grade_d','grade_f','progress_good','progress_satisfactory','progress_need_improve','created_by_id'],spRows);

      // Student performance (pedagogical)
      const domains: Record<string,{code:string;label:string}[]> = {
        'ba-1':[{code:'C1',label:'Reading Comprehension'},{code:'C2',label:'Writing Skills'},{code:'C3',label:'Speaking & Listening'},{code:'C4',label:'Vocabulary'}],
        'ba-2':[{code:'C5',label:'Grammar & Structure'},{code:'C6',label:'Creative Writing'},{code:'C7',label:'Literature Analysis'}],
        'ba-3':[{code:'C8',label:'Critical Thinking'},{code:'C9',label:'Research Skills'},{code:'C10',label:'Presentation'}],
        'bps-1':[{code:'M1',label:'Number Sense'},{code:'M2',label:'Algebraic Thinking'},{code:'M3',label:'Geometry & Measurement'},{code:'M4',label:'Data Handling'}],
        'bps-2':[{code:'S1',label:'Scientific Inquiry'},{code:'S2',label:'Life Science'},{code:'S3',label:'Physical Science'},{code:'S4',label:'Environmental Science'}],
        'bss-1':[{code:'SS1',label:'Historical Understanding'},{code:'SS2',label:'Civic Knowledge'},{code:'SS3',label:'Geographical Awareness'}],
      };
      const dperfRows: any[][] = [];
      for (const fk of FORMS) {
        for (const gr of s.grades) {
          const base=s.base[gr]; if(!base) continue;
          const num=base.b+base.g;
          const items=domains[fk]||domains['ba-1'];
          const rows=items.map(it=>({code:it.code,label:it.label,domain:fk,values:{excellent:Math.round(num*randF(0.15,0.35)),good:Math.round(num*randF(0.30,0.45)),satisfactory:Math.round(num*randF(0.15,0.25)),needs_improvement:Math.round(num*randF(0.05,0.15))}}));
          for (const period of PERIODS) {
            dperfRows.push([uuid(),sid,yr,fk,gr,period,num,randF(88,100),JSON.stringify(rows),ADMIN_ID]);
          }
        }
      }
      await batchInsert(client,'dc_student_performance',['id','school_id','academic_year','form_key','grade','evaluation_period','number_of_students','appeared_percent','rows','created_by_id'],dperfRows);

      // Teachers development
      const tdRows: any[][] = [];
      for (const mo of MONTHS) {
        tdRows.push([uuid(),sid,yr,mo,rand(1,5),rand(2,8),rand(0,3),rand(0,2),rand(1,4),rand(0,2),rand(0,1),randF(0,3),randF(0,1),pick(['good','average','needs_improvement']),ADMIN_ID]);
      }
      await batchInsert(client,'dc_teachers_development',['id','school_id','academic_year','month','online_refresher','offline_refresher','development_forum','basic_training','subject_based_training','leadership_training','others','teacher_dropout_rate','head_teacher_dropout_rate','head_teacher_leadership','created_by_id'],tdRows);

      // Fee structure
      const fsRows: any[][] = [];
      for (const mo of MONTHS) {
        for (const gr of s.grades) {
          const base=Number(gr)<=5?s.fp:s.fs;
          fsRows.push([uuid(),sid,yr,mo,gr,Math.round(base*0.5*ym2),Math.round(base*ym2),Math.round(base*0.2*ym2),Math.round(base*0.1*ym2),Math.round(base*0.05*ym2),Math.round(base*0.08*ym2),Math.round(base*0.03*ym2),Math.round(base*0.04*ym2),Math.round(base*0.1*ym2),rand(0,500),ADMIN_ID]);
        }
      }
      await batchInsert(client,'dc_fee_structure',['id','school_id','academic_year','month','grade','admission_fee','tuition_fee','session_fee','assessment_fee','sports_fee','syllabus_fee','admission_form','testimonial_fee','others_fee','transport_fee','created_by_id'],fsRows);

      // Revenue budget/actual total
      {
        const cats=['admission_fee','session_fee','assessment_fee','sports_fee','syllabus_fee','testimonial_fee','others_fee','transport_fee'];
        const rbtRows: any[][] = [];
        const ratRows: any[][] = [];
        const bvals: any[] = [uuid(),sid,yr,ts];
        const avals: any[] = [uuid(),sid,yr,ts];
        for (const _ of cats) {
          const bt=Math.round(ts*rand(100,500)*ym2); bvals.push(bt,Math.round(bt*randF(0.8,1.0)));
          const at=Math.round(ts*rand(100,500)*ym2); avals.push(at,Math.round(at*randF(0.82,0.98)));
        }
        bvals.push(ADMIN_ID); avals.push(ADMIN_ID);
        const cols=cats.map(c=>`${c}_target,${c}_achievement`).join(',');
        const bph=bvals.map((_,i)=>q(i+1)).join(',');
        const aph=avals.map((_,i)=>q(i+1)).join(',');
        await client.query(`INSERT INTO bep.dc_revenue_budget_total(id,school_id,academic_year,total_students_target,${cols},created_by_id) VALUES(${bph})`,bvals);
        await client.query(`INSERT INTO bep.dc_revenue_actual_total(id,school_id,academic_year,total_students_target,${cols},created_by_id) VALUES(${aph})`,avals);
      }

      // Revenue budget/actual monthly
      const rbmRows: any[][] = [];
      const ramRows: any[][] = [];
      for (const mo of MONTHS) {
        const target=Math.round(ts*bf*ym2);
        const ba=Math.round(target*randF(0.85,1.0)), aa=Math.round(target*randF(0.82,0.98));
        rbmRows.push([uuid(),sid,yr,mo,target,ba,Math.round((ba/target)*100),ADMIN_ID]);
        ramRows.push([uuid(),sid,yr,mo,target,aa,Math.round((aa/target)*100),ADMIN_ID]);
      }
      await batchInsert(client,'dc_revenue_budget_monthly',['id','school_id','academic_year','month','tuition_fee_target','tuition_fee_achievement','collection_pct','created_by_id'],rbmRows);
      await batchInsert(client,'dc_revenue_actual_monthly',['id','school_id','academic_year','month','tuition_fee_target','tuition_fee_achievement','collection_pct','created_by_id'],ramRows);

      // Cocurricular
      const ccRows: any[][] = [];
      for (const mo of MONTHS) {
        for (const gr of s.grades) {
          ccRows.push([uuid(),sid,yr,mo,gr,randF(20,85),randF(15,70),randF(25,80),randF(10,50),randF(15,65),randF(20,75),randF(5,40),randF(30,85),randF(25,80),randF(5,30),ADMIN_ID]);
        }
      }
      await batchInsert(client,'dc_cocurricular',['id','school_id','academic_year','month','grade','song','dance','recitation','acting','debate','quiz','wall_magazine','indoor_game','outdoor_game','others','created_by_id'],ccRows);

      // Activity participation
      const apRows: any[][] = [];
      const items = ['corner','club','lab','library'];
      for (let ai=0; ai<ACTS.length; ai++) {
        const act=ACTS[ai];
        for (const gr of s.grades.slice(0,3)) {
          apRows.push([uuid(),sid,items[ai%items.length],yr,MONTHS[ai%12],gr,act,rand(2,12),randF(40,95),ADMIN_ID]);
        }
      }
      await batchInsert(client,'dc_activity_participation',['id','school_id','item','year','month','grade','activity_name','conducted_count','participation_rate','created_by_id'],apRows);
      console.log(`  ${yr} OK`);
    }

    // Alumni + Events
    const alRows: any[][] = [];
    for (const yr of ['2025','2026']) {
      for (let i=0;i<rand(5,8);i++) {
        alRows.push([uuid(),sid,yr,pick(MALE),rand(s.eyr+20,2024),`${rand(1,100)} ${pick(LOCS)}, ${s.district}`,pick(['Engineer','Doctor','Teacher','Business Owner','Lawyer','Journalist']),pick(['BSc','BA','MA','MSc','MBA']),pick(['University of Dhaka','BUET','University of Chittagong','University of Rajshahi']),`+8801${rand(700000000,899999999)}`,pick(['Gold Medal','Best Teacher Award','Community Service Prize']),true,ADMIN_ID]);
      }
    }
    await batchInsert(client,'dc_alumni',['id','school_id','academic_year','alumni_name','graduation_year','present_address','current_occupation','higher_education','institution','contact_phone','achievements','is_active','created_by_id'],alRows);

    const evRows: any[][] = [];
    for (const yr of ['2025','2026']) {
      for (let i=0;i<rand(4,8);i++) {
        const ev=pick(EVENTS), ml=rand(1,15), fe=rand(1,12);
        evRows.push([uuid(),sid,yr,ev.name,ev.level,ml,fe,ml+fe,ADMIN_ID]);
      }
    }
    await batchInsert(client,'dc_event_participation',['id','school_id','academic_year','event_name','award_level','male_awarded','female_awarded','total_awarded','created_by_id'],evRows);
    console.log('  Alumni+Events OK');
  }

  console.log('\n✅ ALL DEMO DATA SEEDED!');
  await client.end();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
