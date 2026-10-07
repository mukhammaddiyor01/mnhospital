const fs = require('fs'),
	path = require('path');
const root = path.resolve(__dirname, '..');
require(root + '/node_modules/ts-node').register({
	transpileOnly: true,
	compilerOptions: { module: 'commonjs', experimentalDecorators: true, emitDecoratorMetadata: true },
});
require(root + '/node_modules/reflect-metadata');
const { NestFactory } = require(root + '/node_modules/@nestjs/core');
const { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } = require(root + '/node_modules/@nestjs/graphql');
const { printSchema } = require(root + '/node_modules/graphql');
function files(dir) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((f) =>
			f.isDirectory() ? files(path.join(dir, f.name)) : f.name.endsWith('.resolver.ts') ? [path.join(dir, f.name)] : [],
		);
}
(async () => {
	const resolvers = files(root + '/apps/mnhospital-api/src/components').flatMap((file) =>
		Object.values(require(file)).filter((v) => typeof v === 'function'),
	);
	const app = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
	const schema = await app.get(GraphQLSchemaFactory).create(resolvers);
	fs.writeFileSync(process.argv[2] || '/tmp/mn-workspace-schema.graphql', printSchema(schema));
	console.log('Schema generated with ' + resolvers.length + ' resolvers');
	await app.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
