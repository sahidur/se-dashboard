import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  single_choice: 'Single Choice',
  multiple_choice: 'Multiple Choice',
  dropdown: 'Dropdown',
  number: 'Number',
  single_select_searchable: 'Searchable Dropdown',
  multi_select_searchable: 'Multi-Select Searchable',
  true_false: 'Yes / No',
  location: 'Location',
  file_upload: 'File Upload',
  date: 'Date',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
};
