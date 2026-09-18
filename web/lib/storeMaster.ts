/**
 * Central Store Master (Single Source of Truth)
 *
 * Authoritative store configuration for ZenZebra Word-File-ZZ-Tool.
 * When a new store is added here once, it automatically becomes available
 * in Brand contracts (DOCX) and Proforma Invoices (XLSX).
 *
 * Store availability is strictly controlled by its openingDate:
 * - Documents dated BEFORE openingDate will NOT include the store.
 * - Documents dated ON or AFTER openingDate WILL include the store.
 */

export interface Store {
  storeCode: string;     // Unique identifier, e.g. "SWN", "KLJ", "HQ27", "CLUB125"
  storeName: string;     // Display/Official name, e.g. "Smartworks Noida", "Club 125"
  openingDate: string;   // ISO format "YYYY-MM-DD"
  active: boolean;       // Operational status flag
  closingDate?: string;  // Optional ISO format "YYYY-MM-DD"
}

export const STORE_MASTER: Store[] = [
  {
    storeCode: 'SWN',
    storeName: 'Smartworks Noida',
    openingDate: '2024-01-01',
    active: true,
  },
  {
    storeCode: 'KLJ',
    storeName: 'KLJ Noida One',
    openingDate: '2024-01-01',
    active: true,
  },
  {
    storeCode: 'HQ27',
    storeName: 'HQ27',
    openingDate: '2024-01-01',
    active: true,
  },
  {
    storeCode: 'CLUB125',
    storeName: 'Club 125',
    openingDate: '2024-01-01',
    active: true,
  },
];

/**
 * Normalizes any supported date representation into an ISO "YYYY-MM-DD" string.
 * Uses Asia/Kolkata (IST) timezone when formatting Date instances.
 */
export function normalizeDateToIso(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(today); // Returns "YYYY-MM-DD"
  }

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      return normalizeDateToIso();
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(dateInput);
  }

  const str = String(dateInput).trim();
  if (!str) return normalizeDateToIso();

  // Match standard YYYY-MM-DD or ISO timestamp
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Match DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return normalizeDateToIso(parsed);
  }

  return normalizeDateToIso();
}

/**
 * Returns the list of active stores applicable for the specified document date.
 * A store is applicable if:
 * 1. store.active is true
 * 2. documentDate >= store.openingDate
 * 3. documentDate <= store.closingDate (if closingDate is defined)
 */
export function getApplicableStores(
  documentDate?: string | Date | null,
  stores: Store[] = STORE_MASTER
): Store[] {
  const docDate = normalizeDateToIso(documentDate);

  return stores.filter((store) => {
    if (!store.active) return false;
    if (!store.openingDate) return false;

    // ISO string comparison is lexicographically safe for YYYY-MM-DD
    const openDate = normalizeDateToIso(store.openingDate);
    if (docDate < openDate) return false;

    if (store.closingDate) {
      const closeDate = normalizeDateToIso(store.closingDate);
      if (docDate > closeDate) return false;
    }

    return true;
  });
}

/**
 * Retrieves a store by its code (case-insensitive).
 */
export function getStoreByCode(code: string, stores: Store[] = STORE_MASTER): Store | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  return stores.find((s) => s.storeCode.toUpperCase() === upper || s.storeName.toUpperCase() === upper);
}

/**
 * Checks whether a given store code is open and applicable for the specified document date.
 */
export function isStoreApplicable(
  code: string,
  documentDate?: string | Date | null,
  stores: Store[] = STORE_MASTER
): boolean {
  const applicable = getApplicableStores(documentDate, stores);
  const upper = code.trim().toUpperCase();
  return applicable.some((s) => s.storeCode.toUpperCase() === upper || s.storeName.toUpperCase() === upper);
}

/**
 * Returns all active store codes from the master list.
 */
export function getAllStoreCodes(stores: Store[] = STORE_MASTER): string[] {
  return stores.map((s) => s.storeCode);
}
