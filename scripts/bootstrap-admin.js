const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { Writable } = require('stream');

const apply = process.argv.includes('--apply');
const output = new Writable({
	write(chunk, encoding, callback) {
		if (!output.muted) process.stdout.write(chunk);
		callback();
	},
});
output.muted = false;

async function main() {
	const uri = process.env.NODE_ENV === 'production' ? process.env.MONGO_PROD : process.env.MONGO_DEV;
	if (!uri) throw new Error('MongoDB connection is not configured');

	await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
	try {
		const database = mongoose.connection.db;
		if (database.databaseName !== 'MNHospital') throw new Error(`Unexpected database: ${database.databaseName}`);
		const admins = database.collection('admin');
		const count = await admins.countDocuments({});
		if (count) throw new Error(`Admin bootstrap stopped: ${count} admin record(s) already exist`);
		if (!apply) {
			console.log('No admin records found. Run npm run db:bootstrap-admin -- --apply to create the first admin.');
			return;
		}
		if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal');

		const prompt = readline.createInterface({ input: process.stdin, output, terminal: true });
		const ask = (label, secret = false) => new Promise((resolve) => {
			process.stdout.write(label);
			output.muted = secret;
			prompt.question('', (answer) => {
				output.muted = false;
				if (secret) process.stdout.write('\n');
				resolve(answer.trim());
			});
		});

		try {
			const adminNick = await ask('Admin nickname (3-30 characters): ');
			const adminPhone = await ask('Admin phone: ');
			const adminMail = (await ask('Admin email: ')).toLowerCase();
			const password = await ask('Password (8-32 characters): ', true);
			const repeatPassword = await ask('Repeat password: ', true);
			if (adminNick.length < 3 || adminNick.length > 30) throw new Error('Admin nickname must be 3-30 characters');
			if (!adminPhone) throw new Error('Admin phone is required');
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminMail)) throw new Error('A valid admin email is required');
			if (password.length < 8 || password.length > 32) throw new Error('Password must be 8-32 characters');
			if (password !== repeatPassword) throw new Error('Passwords do not match');
			if ((await ask(`Create the first admin "${adminNick}"? Type CREATE to confirm: `)) !== 'CREATE') {
				console.log('Cancelled. No admin was created.');
				return;
			}

			// Recheck before insertion if another setup process has already completed.
			if (await admins.countDocuments({})) throw new Error('An admin was created by another process');
			const adminPassword = await bcrypt.hash(password, await bcrypt.genSalt());
			const now = new Date();
			await admins.insertOne({
				memberType: 'ADMIN',
				adminNick,
				adminPassword,
				adminPhone,
				adminMail,
				adminImage: '/img/mn-logo-mark.png',
				adminDesc: 'Hospital administrator',
				createdAt: now,
				updatedAt: now,
			});
			console.log(`Admin "${adminNick}" created. You can now sign in on /account/admin-signin.`);
		} finally {
			prompt.close();
		}
	} finally {
		await mongoose.disconnect();
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
