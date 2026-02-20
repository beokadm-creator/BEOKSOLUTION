"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
// NOTE: This script assumes you have GOOGLE_APPLICATION_CREDENTIALS set or are running in an environment with access.
// Usage: export GOOGLE_APPLICATION_CREDENTIALS="./service-account.json" && npx ts-node src/scripts/seedSocietyGrades.ts
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const GRADES_DATA = {
    "list": [
        { "code": "member", "name": { "ko": "정회원", "en": "Member" } },
        { "code": "non_member", "name": { "ko": "비회원", "en": "Non-member" } },
        { "code": "Dental hygienist", "name": { "ko": "치과위생사", "en": "Dental hygienist" } }
    ]
};
async function seed() {
    const societyId = 'kadd';
    console.log(`Seeding society grades to 'societies/${societyId}/settings/grades'...`);
    try {
        await db.doc(`societies/${societyId}/settings/grades`).set(GRADES_DATA);
        console.log("✅ Success! Society grades added.");
        console.log(JSON.stringify(GRADES_DATA, null, 2));
    }
    catch (e) {
        console.error("❌ Error adding society grades:", e);
        console.log("Hint: Check your credentials and permissions.");
    }
}
seed();
//# sourceMappingURL=seedSocietyGrades.js.map