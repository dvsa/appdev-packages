import {
	type Config,
	createFormatter,
	createParser,
	createProgram,
	DEFAULT_CONFIG,
	RootlessError,
	SchemaGenerator,
	type ts,
} from 'ts-json-schema-generator';

class IndexedSchemaGenerator extends SchemaGenerator {
	private projectTypes?: Map<string, ts.Node>;
	private externalTypes?: Map<string, ts.Node>;
	private externalFiles: ts.SourceFile[] = [];

	protected override findNamedNode(fullName: string): ts.Node {
		const checker = this.program.getTypeChecker();
		if (!this.projectTypes) {
			const { projectFiles, externalFiles } = this.partitionFiles();
			const types = new Map<string, ts.Node>();
			this.appendTypes(projectFiles, checker, types);
			this.projectTypes = types;
			this.externalFiles = externalFiles;
		}

		// Keep project declarations authoritative even after an external lookup.
		const projectType = this.projectTypes.get(fullName);
		if (projectType) {
			return projectType;
		}

		if (!this.externalTypes) {
			const types = new Map<string, ts.Node>();
			this.appendTypes(this.externalFiles, checker, types);
			this.externalTypes = types;
		}

		const externalType = this.externalTypes.get(fullName);
		if (externalType) {
			return externalType;
		}

		throw new RootlessError(fullName);
	}
}

export function createIndexedGenerator(config: Config) {
	// Match the upstream factory, replacing only named-root lookup. Each instance
	// owns one program and its indexes; nothing is cached across generation runs.
	const completedConfig = { ...DEFAULT_CONFIG, ...config };
	const program = config.tsProgram || createProgram(completedConfig);
	return new IndexedSchemaGenerator(
		program,
		createParser(program, completedConfig),
		createFormatter(completedConfig),
		completedConfig
	);
}
