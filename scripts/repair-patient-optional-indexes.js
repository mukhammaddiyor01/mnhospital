const mongoose = require('mongoose');

const fields = ['patientPhone', 'patientMail', 'patientNick', 'patientIdNumber'];
const apply = process.argv.includes('--apply');

async function main() {
	const uri = process.env.MONGO_DEV;
	if (!uri) throw new Error('MONGO_DEV is required');

	await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
	try {
		const database = mongoose.connection.db;
		if (database.databaseName !== 'MNHospital') {
			throw new Error(`Unexpected database: ${database.databaseName}`);
		}

		const patients = database.collection('patients');
		const indexes = await patients.indexes();
		const pending = [];

		for (const field of fields) {
			const name = `${field}_1`;
			const index = indexes.find((item) => item.name === name);
			if (index && (Object.keys(index.key).length !== 1 || index.key[field] !== 1 || index.unique !== true)) {
				throw new Error(`Unexpected index definition: ${name}`);
			}
			if (index?.sparse === true) {
				console.log(`${name}: already unique and sparse`);
				continue;
			}

			const nullCount = await patients.countDocuments({ [field]: { $type: 'null' } });
			if (nullCount > 0) {
				throw new Error(`${name}: ${nullCount} documents contain an explicit null; resolve them before migration`);
			}
			pending.push({ field, name, exists: Boolean(index) });
		}

		for (const { field, name, exists } of pending) {
			console.log(`${name}: ${apply ? 'applying' : 'would apply'} unique sparse index`);
			if (!apply) continue;
			if (exists) await patients.dropIndex(name);
			await patients.createIndex({ [field]: 1 }, { name, unique: true, sparse: true });
		}
	} finally {
		await mongoose.disconnect();
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
