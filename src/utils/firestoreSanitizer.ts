/**
 * Deeply strips `undefined` properties from objects and arrays before passing
 * payloads to Firestore (`setDoc`, `updateDoc`, `addDoc`, `writeBatch`),
 * while preserving Firestore `FieldValue` sentinels (e.g. `serverTimestamp()`),
 * `Date` instances, and typed primitives.
 */
function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value) || value instanceof Date) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const cleanedItems: unknown[] = [];
    for (const item of value) {
      if (item === undefined) continue;
      cleanedItems.push(sanitizeValue(item));
    }
    return cleanedItems;
  }
  if (isPlainObject(value)) {
    const cleanedObj: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      cleanedObj[key] = sanitizeValue(nested);
    }
    return cleanedObj;
  }
  return value;
}

export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  return sanitizeValue(data) as Record<string, any>;
}
