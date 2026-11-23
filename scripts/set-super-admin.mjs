#!/usr/bin/env node
/**
 * Script: set-super-admin.mjs
 * Securely assigns the `superAdmin: true` Firebase Custom Claim to a designated user email.
 *
 * Requirements:
 * - Environment variable: FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS
 *   pointing to the private Firebase service account JSON. (Never committed to repo!)
 *
 * Usage:
 *   node scripts/set-super-admin.mjs <user-email>
 *
 * Example:
 *   $env:FIREBASE_SERVICE_ACCOUNT_KEY="C:\path\to\service-account.json"
 *   node scripts/set-super-admin.mjs admin@pakedu.com
 */

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const targetEmail = process.argv[2]?.trim().toLowerCase();

if (!targetEmail) {
  console.error('\n❌ Error: Missing user email argument.');
  console.error('Usage: node scripts/set-super-admin.mjs <user-email>\n');
  process.exit(1);
}

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  console.error('\n❌ Error: Missing service account configuration.');
  console.error('Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS environment variable.\n');
  console.error('Example (PowerShell):');
  console.error('  $env:FIREBASE_SERVICE_ACCOUNT_KEY="C:\\secrets\\firebase-adminsdk.json"');
  console.error(`  node scripts/set-super-admin.mjs ${targetEmail}\n`);
  process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`\n❌ Error: Service account JSON file not found at: ${resolvedPath}\n`);
  process.exit(1);
}

let serviceAccount;
try {
  const content = fs.readFileSync(resolvedPath, 'utf8');
  serviceAccount = JSON.parse(content);
} catch (err) {
  console.error(`\n❌ Error parsing service account JSON: ${err.message}\n`);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const auth = getAuth();
const firestore = getFirestore();

async function setSuperAdmin() {
  console.log(`\n🔍 Looking up Firebase user for email: ${targetEmail}...`);
  let user;
  try {
    user = await auth.getUserByEmail(targetEmail);
  } catch (err) {
    console.error(`\n❌ Could not find user with email "${targetEmail}": ${err.message}`);
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.uid} (${user.email || targetEmail})`);

  // Merge custom claims
  const currentClaims = user.customClaims || {};
  const newClaims = {
    ...currentClaims,
    superAdmin: true,
  };

  await auth.setCustomUserClaims(user.uid, newClaims);
  console.log('✅ Successfully assigned custom claim: { superAdmin: true }');

  // Also synchronize user profile in Firestore if available
  try {
    const userRef = firestore.collection('users').doc(user.uid);
    const snap = await userRef.get();
    if (snap.exists) {
      await userRef.update({
        role: 'super-admin',
        isSuperAdmin: true,
        status: 'active',
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Synchronized Firestore users/${user.uid} profile with role: super-admin, status: active.`);
    } else {
      await userRef.set({
        uid: user.uid,
        email: user.email || targetEmail,
        fullName: user.displayName || 'Portal Super Admin',
        role: 'super-admin',
        isSuperAdmin: true,
        status: 'active',
        assignedClassIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Created Firestore users/${user.uid} profile with role: super-admin, status: active.`);
    }
  } catch (dbErr) {
    console.warn('⚠️  Notice: Could not sync Firestore profile doc directly:', dbErr.message);
  }

  console.log('\n🎉 PROVISIONING COMPLETE!');
  console.log(`User ${targetEmail} is now verified as Super Admin.`);
  console.log('Note: The user must sign out and sign in again (or call getIdTokenResult(true)) for the new custom claim to take effect in active client sessions.\n');
}

setSuperAdmin().catch((err) => {
  console.error('\n❌ Fatal error during provisioning:', err);
  process.exit(1);
});
