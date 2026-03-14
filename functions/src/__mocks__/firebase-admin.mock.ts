/**
 * Mock for firebase-admin module
 * Used in unit tests to avoid real Firebase connections
 */

// Mock Timestamp
class MockTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromDate(date: Date): MockTimestamp {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
  }

  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  static now(): MockTimestamp {
    return MockTimestamp.fromDate(new Date());
  }

  isEqual(other: MockTimestamp): boolean {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }
}

// Mock Firestore
class MockDocumentSnapshot {
  private _data: Record<string, unknown> | null;
  private _exists: boolean;
  id: string;

  constructor(id: string, data: Record<string, unknown> | null) {
    this.id = id;
    this._data = data;
    this._exists = data !== null;
  }

  get exists(): boolean {
    return this._exists;
  }

  data(): Record<string, unknown> | undefined {
    return this._data || undefined;
  }
}

class MockQuerySnapshot {
  docs: MockDocumentSnapshot[];
  empty: boolean;

  constructor(docs: MockDocumentSnapshot[] = []) {
    this.docs = docs;
    this.empty = docs.length === 0;
  }
}

class MockDocumentReference {
  id: string;
  path: string;
  private _data: Record<string, unknown> | null = null;

  constructor(path: string) {
    this.path = path;
    const parts = path.split('/');
    this.id = parts[parts.length - 1];
  }

  async get(): Promise<MockDocumentSnapshot> {
    return new MockDocumentSnapshot(this.id, this._data);
  }

  async set(data: Record<string, unknown>): Promise<void> {
    this._data = { ...data };
  }

  async update(data: Record<string, unknown>): Promise<void> {
    this._data = { ...this._data, ...data } as Record<string, unknown>;
  }

  collection(path: string): MockCollectionReference {
    return new MockCollectionReference(`${this.path}/${path}`);
  }
}

class MockCollectionReference {
  path: string;

  constructor(path: string) {
    this.path = path;
  }

  doc(id?: string): MockDocumentReference {
    const docId = id || `mock-doc-${Date.now()}`;
    return new MockDocumentReference(`${this.path}/${docId}`);
  }

  async get(): Promise<MockQuerySnapshot> {
    return new MockQuerySnapshot([]);
  }

  where(_field: string, _op: string, _value: unknown): MockQuery {
    return new MockQuery(this);
  }

  orderBy(_field: string, _direction?: string): MockQuery {
    return new MockQuery(this);
  }

  limit(_n: number): MockQuery {
    return new MockQuery(this);
  }
}

class MockQuery {
  // @ts-expect-error - Intentionally stored for future use in mock
  private _collection: MockCollectionReference;

  constructor(collection: MockCollectionReference) {
    this._collection = collection;
  }


  where(_field: string, _op: string, _value: unknown): MockQuery {
    return this;
  }

  orderBy(_field: string, _direction?: string): MockQuery {
    return this;
  }

  limit(_n: number): MockQuery {
    return this;
  }

  async get(): Promise<MockQuerySnapshot> {
    return new MockQuerySnapshot([]);
  }
}

class MockFirestore {
  private _collections: Map<string, MockCollectionReference> = new Map();

  collection(path: string): MockCollectionReference {
    if (!this._collections.has(path)) {
      this._collections.set(path, new MockCollectionReference(path));
    }
    return this._collections.get(path)!;
  }

  doc(path: string): MockDocumentReference {
    return new MockDocumentReference(path);
  }

  async runTransaction<T>(callback: (transaction: MockTransaction) => Promise<T>): Promise<T> {
    const transaction = new MockTransaction();
    return callback(transaction);
  }
}

class MockTransaction {
  private _reads: Map<string, MockDocumentSnapshot> = new Map();
  private _writes: Array<{ ref: MockDocumentReference; type: 'set' | 'update'; data: Record<string, unknown> }> = [];

  async get(ref: MockDocumentReference | MockQuery): Promise<MockDocumentSnapshot | MockQuerySnapshot> {
    if (ref instanceof MockDocumentReference) {
      const snapshot = await ref.get();
      this._reads.set(ref.path, snapshot);
      return snapshot;
    }
    return new MockQuerySnapshot([]);
  }

  set(ref: MockDocumentReference, data: Record<string, unknown>): void {
    this._writes.push({ ref, type: 'set', data });
  }

  update(ref: MockDocumentReference, data: Record<string, unknown>): void {
    this._writes.push({ ref, type: 'update', data });
  }
}

// Mock admin module
const mockFirestore = new MockFirestore();

const admin = {
  firestore: () => mockFirestore,
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
};

// Export for direct use
export const firestore = mockFirestore;
export const Timestamp = MockTimestamp;
export { MockFirestore, MockDocumentReference, MockCollectionReference, MockDocumentSnapshot, MockQuerySnapshot };

export default admin;
