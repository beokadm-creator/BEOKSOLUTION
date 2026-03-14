"use strict";
/**
 * Mock for firebase-admin module
 * Used in unit tests to avoid real Firebase connections
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockQuerySnapshot = exports.MockDocumentSnapshot = exports.MockCollectionReference = exports.MockDocumentReference = exports.MockFirestore = exports.Timestamp = exports.firestore = void 0;
// Mock Timestamp
class MockTimestamp {
    constructor(seconds, nanoseconds = 0) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
    }
    static fromDate(date) {
        return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
    }
    toDate() {
        return new Date(this.seconds * 1000);
    }
    static now() {
        return MockTimestamp.fromDate(new Date());
    }
    isEqual(other) {
        return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
    }
}
// Mock Firestore
class MockDocumentSnapshot {
    constructor(id, data) {
        this.id = id;
        this._data = data;
        this._exists = data !== null;
    }
    get exists() {
        return this._exists;
    }
    data() {
        return this._data || undefined;
    }
}
exports.MockDocumentSnapshot = MockDocumentSnapshot;
class MockQuerySnapshot {
    constructor(docs = []) {
        this.docs = docs;
        this.empty = docs.length === 0;
    }
}
exports.MockQuerySnapshot = MockQuerySnapshot;
class MockDocumentReference {
    constructor(path) {
        this._data = null;
        this.path = path;
        const parts = path.split('/');
        this.id = parts[parts.length - 1];
    }
    async get() {
        return new MockDocumentSnapshot(this.id, this._data);
    }
    async set(data) {
        this._data = { ...data };
    }
    async update(data) {
        this._data = { ...this._data, ...data };
    }
    collection(path) {
        return new MockCollectionReference(`${this.path}/${path}`);
    }
}
exports.MockDocumentReference = MockDocumentReference;
class MockCollectionReference {
    constructor(path) {
        this.path = path;
    }
    doc(id) {
        const docId = id || `mock-doc-${Date.now()}`;
        return new MockDocumentReference(`${this.path}/${docId}`);
    }
    async get() {
        return new MockQuerySnapshot([]);
    }
    where(_field, _op, _value) {
        return new MockQuery(this);
    }
    orderBy(_field, _direction) {
        return new MockQuery(this);
    }
    limit(_n) {
        return new MockQuery(this);
    }
}
exports.MockCollectionReference = MockCollectionReference;
class MockQuery {
    constructor(collection) {
        this._collection = collection;
    }
    where(_field, _op, _value) {
        return this;
    }
    orderBy(_field, _direction) {
        return this;
    }
    limit(_n) {
        return this;
    }
    async get() {
        return new MockQuerySnapshot([]);
    }
}
class MockFirestore {
    constructor() {
        this._collections = new Map();
    }
    collection(path) {
        if (!this._collections.has(path)) {
            this._collections.set(path, new MockCollectionReference(path));
        }
        return this._collections.get(path);
    }
    doc(path) {
        return new MockDocumentReference(path);
    }
    async runTransaction(callback) {
        const transaction = new MockTransaction();
        return callback(transaction);
    }
}
exports.MockFirestore = MockFirestore;
class MockTransaction {
    constructor() {
        this._reads = new Map();
        this._writes = [];
    }
    async get(ref) {
        if (ref instanceof MockDocumentReference) {
            const snapshot = await ref.get();
            this._reads.set(ref.path, snapshot);
            return snapshot;
        }
        return new MockQuerySnapshot([]);
    }
    set(ref, data) {
        this._writes.push({ ref, type: 'set', data });
    }
    update(ref, data) {
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
exports.firestore = mockFirestore;
exports.Timestamp = MockTimestamp;
exports.default = admin;
//# sourceMappingURL=firebase-admin.mock.js.map