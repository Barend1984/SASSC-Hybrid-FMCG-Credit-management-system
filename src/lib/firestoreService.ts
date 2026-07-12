import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  getDoc 
} from 'firebase/firestore';
import { db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves a single item to a Firestore collection.
 * Uses the item's `id` property as the document ID.
 */
export const saveDocToFirestore = async <T extends { id: string }>(
  collectionName: string, 
  item: T
): Promise<void> => {
  if (!item.id) {
    console.warn(`Attempted to save item to ${collectionName} without an ID.`);
    return;
  }
  const docRef = doc(db, collectionName, item.id);
  // Sanitize item to remove any undefined values before saving to Firestore
  const sanitized = JSON.parse(JSON.stringify(item));
  try {
    await setDoc(docRef, sanitized, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${item.id}`);
  }
};

/**
 * Saves a single key-value object (like business settings) to a specific document.
 */
export const saveSettingsToFirestore = async <T>(
  documentName: string,
  data: T
): Promise<void> => {
  const docRef = doc(db, 'system_configs', documentName);
  const sanitized = JSON.parse(JSON.stringify(data));
  try {
    await setDoc(docRef, sanitized, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `system_configs/${documentName}`);
  }
};

/**
 * Loads a single key-value object (like business settings) from a specific document.
 */
export const loadSettingsFromFirestore = async <T>(
  documentName: string
): Promise<T | null> => {
  const docRef = doc(db, 'system_configs', documentName);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as T;
    }
    return null;
  } catch (error) {
    // If it's permission error, escalate it. Otherwise fallback gracefully.
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      handleFirestoreError(error, OperationType.GET, `system_configs/${documentName}`);
    }
    console.error(`Error loading settings from Firestore (${documentName}):`, error);
    return null;
  }
};

/**
 * Fetches all items from a Firestore collection.
 */
export const fetchCollectionFromFirestore = async <T>(
  collectionName: string
): Promise<T[]> => {
  const colRef = collection(db, collectionName);
  try {
    const snapshot = await getDocs(colRef);
    const items: T[] = [];
    snapshot.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() } as T);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
};

/**
 * Deletes a document from a Firestore collection by ID.
 */
export const deleteDocFromFirestore = async (
  collectionName: string,
  id: string
): Promise<void> => {
  const docRef = doc(db, collectionName, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
};

/**
 * Saves a full list of items to Firestore in batch-like fashion
 * (writing each one individually to avoid full array overwrites).
 */
export const syncFullListToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> => {
  try {
    const promises = items.map(item => saveDocToFirestore(collectionName, item));
    await Promise.all(promises);
  } catch (error) {
    console.error(`Error performing batch sync to Firestore (${collectionName}):`, error);
  }
};
