import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixCoinTransactionIndex() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        console.log('Connecting to MongoDB...');
        console.log('URI:', mongoUri.substring(0, 50) + '...');

        await mongoose.connect(mongoUri, {
            dbName: 'shramik' // Explicitly set database Name
        });
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\n📂 Collections:', collections.map(c => c.name));

        // Check if cointransactions collection exists
        if (!collections.find(c => c.name === 'cointransactions')) {
            console.log('\n⚠️ cointransactions collection does not exist yet');
            await mongoose.disconnect();
            return;
        }

        // Check cointransactions collection indexes
        const collection = db.collection('cointransactions');
        const indexes = await collection.indexes();
        console.log('\n📊 Current cointransactions indexes:');
        indexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''} ${idx.sparse ? '(sparse)' : ''}`);
        });

        // Find and fix the razorpayOrderId index
        const razorpayIndex = indexes.find(idx => idx.key && idx.key.razorpayOrderId);

        if (razorpayIndex) {
            if (razorpayIndex.sparse) {
                console.log('\n✅ razorpayOrderId index is already sparse. No fix needed.');
            } else {
                console.log('\n🔧 Fixing razorpayOrderId index (making it sparse)...');

                // Drop the non-sparse index
                await collection.dropIndex(razorpayIndex.name);
                console.log(`  - Dropped index: ${razorpayIndex.name}`);

                // Create new sparse unique index
                await collection.createIndex(
                    { razorpayOrderId: 1 },
                    { unique: true, sparse: true, name: 'razorpayOrderId_1' }
                );
                console.log('  - Created new sparse unique index: razorpayOrderId_1');

                // Verify
                const newIndexes = await collection.indexes();
                const newRazorpayIndex = newIndexes.find(idx => idx.key && idx.key.razorpayOrderId);
                console.log(`\n✅ Index fixed! Sparse: ${newRazorpayIndex.sparse}`);
            }
        } else {
            console.log('\n⚠️ No razorpayOrderId index found. It may not have been created yet.');
            console.log('🔧 Creating sparse unique index for razorpayOrderId...');

            await collection.createIndex(
                { razorpayOrderId: 1 },
                { unique: true, sparse: true, name: 'razorpayOrderId_1' }
            );
            console.log('✅ Created sparse unique index: razorpayOrderId_1');
        }

        // Also clean up any documents with null razorpayOrderId (optional)
        const nullCount = await collection.countDocuments({
            $or: [
                { razorpayOrderId: null },
                { razorpayOrderId: '' },
                { razorpayOrderId: { $exists: true, $in: [null, ''] } }
            ]
        });
        console.log(`\n📝 Documents with null/empty razorpayOrderId: ${nullCount}`);

        if (nullCount > 0) {
            console.log('🔧 Removing razorpayOrderId field from these documents...');
            const result = await collection.updateMany(
                {
                    $or: [
                        { razorpayOrderId: null },
                        { razorpayOrderId: '' }
                    ]
                },
                { $unset: { razorpayOrderId: '' } }
            );
            console.log(`✅ Updated ${result.modifiedCount} documents (matched ${result.matchedCount})`);
        }
        await mongoose.disconnect();
        console.log('\n✅ Done! Disconnected from MongoDB.');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

fixCoinTransactionIndex();
