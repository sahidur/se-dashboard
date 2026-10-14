'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import api, { getErrorMessage } from '@/lib/api';
import { Select, useSchools, useAcademicYears } from '@/components/fee/filters';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

const MAX_ROWS = 1000;

const TEMPLATE_HEADERS = [
  'Name *',
  'Roll No',
  'Gender',
  'Date of Birth (YYYY-MM-DD)',
  'Guardian Name',
  'Guardian Phone',
  'Address',
  'Admission Date (YYYY-MM-DD)',
  'Reference Number',
  'Birth Certificate ID',
  'Religion',
];

const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'studentname', 'fullname'],
  rollNumber: ['rollno', 'rollnumber', 'roll'],
  gender: ['gender', 'sex'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate', 'birthday'],
  guardianName: ['guardianname', 'guardian', 'guardiansname'],
  guardianPhone: [
    'guardianphone',
    'guardianmobile',
    'guardianmobilenumber',
    'guardianphonenumber',
    'phone',
    'mobile',
    'mobileno',
    'phonenumber',
    'contactno',
    'contactnumber',
  ],
  address: ['address', 'residentialaddress'],
  admissionDate: ['admissiondate', 'admission'],
  referenceNumber: ['referencenumber', 'reference', 'refno'],
  birthCertificateId: [
    'birthcertificateid',
    'birthcertificate',
    'birthcertificateno',
    'birthcertificatenumber',
  ],
  religion: ['religion'],
};

const HEADER_TO_FIELD: Record<string, string> = Object.entries(
  FIELD_ALIASES,
).reduce<Record<string, string>>((map, [field, aliases]) => {
  for (const alias of aliases) map[alias] = field;
  return map;
}, {});

const normalizeHeader = (header: unknown) =>
  String(header ?? '')
    .replace(/\(.*?\)/g, '')
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

interface ParsedStudent {
  name: string;
  [key: string]: string | undefined;
}

interface RowIssue {
  row: number;
  name: string;
  error: string;
}

interface BulkUploadResult {
  total: number;
  inserted: number;
  failed: RowIssue[];
  errors: RowIssue[];
}

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string; isActive: boolean }[];
}

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSchoolId: string;
  onUploaded: () => void;
}

const isEmptyValue = (value: unknown) =>
  value == null || (typeof value === 'string' && value.trim() === '');

const textValue = (value: unknown): string | null => {
  if (isEmptyValue(value)) return null;
  return String(value).trim();
};

const dateValue = (value: unknown): string | null | undefined => {
  if (isEmptyValue(value)) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 61) return undefined;
    return new Date(Math.round((value - 25569) * 86400000))
      .toISOString()
      .slice(0, 10);
  }
  const text = String(value).trim();
  const ymd = text.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymd) {
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${ymd[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return undefined;
  }
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${dmy[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return undefined;
  }
  return undefined;
};

const genderValue = (value: unknown): string | null | undefined => {
  if (isEmptyValue(value)) return null;
  const text = String(value).trim().toLowerCase();
  if (['male', 'm', 'boy'].includes(text)) return 'male';
  if (['female', 'f', 'girl'].includes(text)) return 'female';
  if (text === 'other') return 'other';
  return undefined;
};

const rollValue = (value: unknown): string | null | undefined => {
  if (isEmptyValue(value)) return null;
  const num =
    typeof value === 'number' ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
    return undefined;
  }
  return String(num);
};

const EXAMPLE_ROW = [
  'Rahim Ahmed',
  '1',
  'Male',
  '2012-05-14',
  'Karim Ahmed',
  '01712345678',
  'Village, Upazila, District',
  '2026-01-05',
  'REF-001',
  '2012456789',
  'Islam',
];

export function BulkUploadModal({
  isOpen,
  onClose,
  defaultSchoolId,
  onUploaded,
}: BulkUploadModalProps) {
  const { data: schools = [] } = useSchools();
  const { data: years = [] } = useAcademicYears();

  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [classes, setClasses] = useState<ClassRow[]>([]);

  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [students, setStudents] = useState<ParsedStudent[]>([]);
  const [issues, setIssues] = useState<RowIssue[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [result, setResult] = useState<BulkUploadResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Deferred to a microtask so the reset is not a synchronous setState in
    // the effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (!isOpen) return;
      setSchoolId(defaultSchoolId);
      setAcademicYearId('');
      setClassId('');
      setSectionId('');
      setClasses([]);
      setFileName('');
      setParseError('');
      setStudents([]);
      setIssues([]);
      setResult(null);
      setUploadError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  }, [isOpen, defaultSchoolId]);

  useEffect(() => {
    if (!schoolId) {
      // Deferred so the clear is not a synchronous setState in the effect
      // (react-hooks/set-state-in-effect).
      void Promise.resolve().then(() => setClasses([]));
      return;
    }
    let cancelled = false;
    api
      .get(`/students/classes?schoolId=${schoolId}&activeOnly=true`)
      .then(({ data }) => {
        if (!cancelled) setClasses(data);
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const [lastSchoolId, setLastSchoolId] = useState(schoolId);
  if (lastSchoolId !== schoolId) {
    setLastSchoolId(schoolId);
    setClassId('');
    setSectionId('');
  }

  const sectionOptions = useMemo(() => {
    const cls = classes.find((c) => c.id === classId);
    return (cls?.sections ?? [])
      .filter((s) => s.isActive)
      .map((s) => ({ value: s.id, label: s.name }));
  }, [classes, classId]);

  const clearFile = () => {
    setFileName('');
    setParseError('');
    setStudents([]);
    setIssues([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    sheet['!cols'] = TEMPLATE_HEADERS.map((header) => ({
      wch: Math.max(14, header.length + 2),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');

    const instructions = [
      ['How to fill this template'],
      ['1. Fill the "Students" sheet with one student per row. Keep the header row unchanged.'],
      ['2. Only the Name column is required — every other column is optional.'],
      ['3. Gender accepts: Male, Female or Other.'],
      ['4. Dates accept YYYY-MM-DD, DD/MM/YYYY or a real Excel date cell.'],
      ['5. School, academic year, class and section are chosen in the upload dialog — do not add them as columns.'],
      ['6. Admission numbers are generated automatically — do not add an admission number column.'],
      ['7. Save as .xlsx or .csv, then upload it in the Bulk Upload dialog.'],
      [],
      ['Example values (each column, in order):'],
      TEMPLATE_HEADERS.map((header) => header.replace(' *', '')),
      EXAMPLE_ROW,
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionSheet['!cols'] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

    XLSX.writeFile(workbook, 'student-bulk-upload-template.xlsx');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResult(null);
    setUploadError('');
    if (!file) {
      setFileName('');
      setParseError('');
      setStudents([]);
      setIssues([]);
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setParseError('');
    setStudents([]);
    setIssues([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        throw new Error('The file does not contain any readable sheet.');
      }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });
      if (rows.length < 2) {
        throw new Error('No student rows found below the header row.');
      }
      const fieldByColumn: (string | undefined)[] = (rows[0] as unknown[]).map(
        (header) => HEADER_TO_FIELD[normalizeHeader(header)],
      );
      if (!fieldByColumn.includes('name')) {
        throw new Error(
          'No "Name" column found. Download the template and keep its header row unchanged.',
        );
      }
      const dataRows = (rows.slice(1) as unknown[][]).slice(0, MAX_ROWS);
      if (rows.length - 1 > MAX_ROWS) {
        throw new Error(
          `The file has ${rows.length - 1} rows. Split it into batches of up to ${MAX_ROWS} students.`,
        );
      }
      const parsed: ParsedStudent[] = [];
      const rowIssues: RowIssue[] = [];
      dataRows.forEach((cells, index) => {
        const rowNo = index + 2;
        const mapped: Record<string, unknown> = {};
        fieldByColumn.forEach((field, column) => {
          if (field && !isEmptyValue(cells[column])) mapped[field] = cells[column];
        });
        if (Object.keys(mapped).length === 0) return;
        const fail = (error: string) =>
          rowIssues.push({
            row: rowNo,
            name: textValue(mapped.name) ?? '',
            error,
          });
        const name = textValue(mapped.name);
        if (!name) {
          fail('Name is required');
          return;
        }
        const student: ParsedStudent = { name };
        const roll = rollValue(mapped.rollNumber);
        if (roll === undefined) {
          fail('Roll number must be a positive whole number');
          return;
        }
        if (roll !== null) student.rollNumber = roll;
        const gender = genderValue(mapped.gender);
        if (gender === undefined) {
          fail(
            `Unknown gender "${String(mapped.gender).trim()}" — use Male, Female or Other`,
          );
          return;
        }
        if (gender !== null) student.gender = gender;
        for (const [field, label] of [
          ['dateOfBirth', 'Date of birth'],
          ['admissionDate', 'Admission date'],
        ] as const) {
          const iso = dateValue(mapped[field]);
          if (iso === undefined) {
            fail(
              `${label} is not a valid date — use YYYY-MM-DD, DD/MM/YYYY or a date cell`,
            );
            return;
          }
          if (iso !== null) student[field] = iso;
        }
        for (const field of [
          'guardianName',
          'guardianPhone',
          'address',
          'referenceNumber',
          'birthCertificateId',
          'religion',
        ] as const) {
          const value = textValue(mapped[field]);
          if (value !== null) student[field] = value;
        }
        parsed.push(student);
      });
      setStudents(parsed);
      setIssues(rowIssues);
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : 'Could not read the file. Make sure it is a valid Excel or CSV file.',
      );
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!schoolId || !classId || !academicYearId || students.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      const { data } = await api.post<BulkUploadResult>('/students/bulk-upload', {
        schoolId,
        academicYearId: academicYearId || null,
        classId: classId || null,
        sectionId: sectionId || null,
        students,
      });
      setResult(data);
      if (data.inserted > 0) onUploaded();
    } catch (error) {
      setUploadError(getErrorMessage(error, 'Bulk upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const canUpload =
    !!schoolId &&
    !!academicYearId &&
    !!classId &&
    students.length > 0 &&
    issues.length === 0 &&
    !parsing &&
    !uploading &&
    !result;

  const unresolved = result ? result.errors.length + result.failed.length : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Students" size="lg">
      {result ? (
        <div className="space-y-3">
          {result.inserted > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>
                <strong>
                  {result.inserted} of {result.total}
                </strong>{' '}
                student(s) imported successfully. Admission numbers were generated
                automatically.
              </span>
            </div>
          )}
          {unresolved > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <span>
                  {result.inserted === 0
                    ? 'No students were imported. Fix the issues below and upload the corrected file.'
                    : `${unresolved} student(s) could not be saved:`}
                </span>
              </div>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 text-xs">
                {[...result.errors, ...result.failed].map((item, index) => (
                  <li key={index} className="rounded-lg bg-white/70 px-2.5 py-1.5">
                    <strong>Row {item.row}</strong>
                    {item.name ? ` — ${item.name}` : ''}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="School *"
                value={schoolId}
                onChange={setSchoolId}
                placeholder="Select school"
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select
                label="Academic Year *"
                value={academicYearId}
                onChange={setAcademicYearId}
                placeholder="Select academic year"
                options={years.map((y) => ({ value: y.id, label: y.name }))}
              />
              <Select
                label="Class *"
                value={classId}
                onChange={setClassId}
                placeholder={schoolId ? 'Select class' : 'Select a school first'}
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Section"
                value={sectionId}
                onChange={setSectionId}
                placeholder="Optional — no section"
                options={sectionOptions}
              />
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-brand-100 bg-brand-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-800">Step 1 — Get the template</p>
                <p className="text-xs">
                  One student per row, keep the header row unchanged. Only Name is
                  required.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download size={14} className="mr-1" /> Download Template
              </Button>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-800">
                Step 2 — Upload the filled file
              </p>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/30 ${
                  students.length > 0 ? 'border-brand-400 bg-brand-50/30' : 'border-gray-300'
                }`}
              >
                <FileSpreadsheet
                  size={28}
                  className={`mb-2 ${students.length > 0 ? 'text-brand-500' : 'text-gray-400'}`}
                />
                <span className="text-sm font-medium text-gray-700">
                  {parsing ? 'Reading file…' : fileName || 'Click to choose an Excel or CSV file'}
                </span>
                <span className="mt-0.5 text-xs text-gray-400">
                  .xlsx, .xls or .csv — up to {MAX_ROWS} students per upload
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={parsing || uploading}
                />
              </label>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {students.length > 0 && issues.length === 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>
                  Found <strong>{students.length}</strong> student(s) ready to import
                  into the selected class/section.
                </span>
              </div>
            )}

            {issues.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{issues.length}</strong> row(s) have problems — fix them
                    in the file and choose it again to re-check.
                  </span>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-xs">
                  {issues.map((issue, index) => (
                    <li key={index} className="rounded-lg bg-white/70 px-2.5 py-1.5">
                      <strong>Row {issue.row}</strong>
                      {issue.name ? ` — ${issue.name}` : ''}: {issue.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {uploadError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!canUpload}>
              <Upload size={14} className="mr-1" />
              {uploading
                ? 'Uploading…'
                : `Upload ${students.length} Student${students.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}