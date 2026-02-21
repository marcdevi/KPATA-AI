import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatPhone(phone: string): string {
  if (phone.startsWith('+225')) {
    const num = phone.slice(4);
    return `+225 ${num.slice(0, 2)} ${num.slice(2, 4)} ${num.slice(4, 6)} ${num.slice(6)}`;
  }
  return phone;
}
