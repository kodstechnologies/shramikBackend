/**
 * Script to fix referral data discrepancy
 * This fixes referrals where coins were not properly added to the referrer's balance
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function fixReferralData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'shramik' });
        console.log('✅ Connected to MongoDB - ' + (process.env.DB_NAME || 'shramik'));

        const db = mongoose.connection.db;

        // Get all referrals that are "completed" but not "rewarded"
        const referrals = await db.collection('referrals').find({
            status: { $in: ['completed', 'pending'] },
            referrerCoinsAwarded: { $gt: 0 }
        }).toArray();

        console.log(`\n📋 Found ${referrals.length} referrals to process\n`);

        for (const referral of referrals) {
            console.log('─'.repeat(60));
            console.log(`Processing Referral: ${referral._id}`);
            console.log(`  Referrer Type: ${referral.referrerType}`);
            console.log(`  Coins to Award: ${referral.referrerCoinsAwarded}`);

            // Determine collection based on referrer type
            const referrerCollection = referral.referrerType === 'Recruiter' ? 'recruiters' : 'jobseekers';
            const refereeCollection = referral.refereeType === 'Recruiter' ? 'recruiters' : 'jobseekers';

            // Get referrer
            const referrer = await db.collection(referrerCollection).findOne({ _id: referral.referrer });
            if (!referrer) {
                console.log(`  ❌ Referrer not found!`);
                continue;
            }

            console.log(`  Referrer Phone: ${referrer.phone}`);
            console.log(`  Current coinBalance: ${referrer.coinBalance || 0}`);
            console.log(`  Current totalReferrals: ${referrer.totalReferrals || 0}`);

            // Check if CoinTransaction already exists for this referral
            const existingTransaction = await db.collection('cointransactions').findOne({
                userId: referral.referrer,
                transactionType: 'referral',
                description: { $regex: referral.referralCode, $options: 'i' }
            });

            if (existingTransaction) {
                console.log(`  ⚠️ Transaction already exists, skipping...`);
                continue;
            }

            // Calculate new balance
            const currentBalance = referrer.coinBalance || 0;
            const newBalance = currentBalance + referral.referrerCoinsAwarded;

            // Update referrer's coinBalance and totalReferrals
            await db.collection(referrerCollection).updateOne(
                { _id: referral.referrer },
                {
                    $set: { coinBalance: newBalance },
                    $inc: { totalReferrals: 1 }
                }
            );
            console.log(`  ✅ Updated coinBalance: ${currentBalance} → ${newBalance}`);

            // Create CoinTransaction record
            const userTypeModel = referral.referrerType; // "Recruiter" or "JobSeeker"
            const userType = referral.referrerType === 'Recruiter' ? 'recruiter' : 'job-seeker';

            const transaction = {
                userId: referral.referrer,
                userType: userType,
                userTypeModel: userTypeModel,
                transactionType: 'referral',
                amount: referral.referrerCoinsAwarded,
                price: 0,
                status: 'success',
                description: `Referral reward: User signed up using code ${referral.referralCode}`,
                balanceAfter: newBalance,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await db.collection('cointransactions').insertOne(transaction);
            console.log(`  ✅ Created CoinTransaction record`);

            // Update referee's referredBy if not set
            const referee = await db.collection(refereeCollection).findOne({ _id: referral.referee });
            if (referee && !referee.referredBy) {
                await db.collection(refereeCollection).updateOne(
                    { _id: referral.referee },
                    { $set: { referredBy: referral.referrer } }
                );
                console.log(`  ✅ Updated referee's referredBy`);
            }

            // Update referral status to 'rewarded'
            await db.collection('referrals').updateOne(
                { _id: referral._id },
                { $set: { status: 'rewarded' } }
            );
            console.log(`  ✅ Updated referral status to 'rewarded'`);
        }

        console.log('\n' + '═'.repeat(60));
        console.log('✅ Script completed successfully!');
        console.log('═'.repeat(60));

        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixReferralData();
