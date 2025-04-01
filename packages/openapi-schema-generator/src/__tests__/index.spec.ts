import { TypescriptToOpenApiSpec } from '../index';

jest.mock('fs');
jest.mock('typescript', () => ({
	createProgram: jest.fn(),
	forEachChild: jest.fn(),
	isInterfaceDeclaration: jest.fn(),
	isPropertySignature: jest.fn(),
}));

describe('TypescriptToOpenApiSpec', () => {
	const mockFilePath = '/path/to/mock/file.ts';

	afterEach(() => {
		jest.resetAllMocks();
		jest.resetModules();
		jest.doMock('typescript', () => ({
			createProgram: jest.fn(),
			forEachChild: jest.fn(),
			isInterfaceDeclaration: jest.fn(),
			isPropertySignature: jest.fn(),
		}));
	});

	describe('generateMany', () => {
		it('should generate OpenAPI schema from TypeScript interfaces', async () => {
			// Mock the extractDefinitions method
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			jest.spyOn(TypescriptToOpenApiSpec as any, 'extractDefinitions').mockReturnValue({
				User: {
					id: 'number',
					name: 'string',
					isActive: 'boolean',
					roles: 'string[]',
				},
			});

			const result = await TypescriptToOpenApiSpec.generateMany(mockFilePath);

			expect(result).toEqual({
				User: {
					properties: {
						id: { type: 'number' },
						isActive: { type: 'boolean' },
						name: { type: 'string' },
						roles: { items: { type: 'string' }, type: 'array' },
					},
					required: ['id', 'name', 'isActive', 'roles'],
					type: 'object',
				},
			});
		});
	});

	describe('dereferenceArrays', () => {
		it('should dereference array types', () => {
			const input = {
				Users: { $ref: 'User[]' },
				User: {
					type: 'object',
					properties: {
						id: { type: 'number' },
						name: { type: 'string' },
					},
				},
			};

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const result = (TypescriptToOpenApiSpec as any).dereferenceArrays(input);

			expect(result).toEqual({
				Users: {
					type: 'array',
					items: { $ref: 'User' },
				},
				User: {
					type: 'object',
					properties: {
						id: { type: 'number' },
						name: { type: 'string' },
					},
				},
			});
		});
	});

	describe('dictToOpenAPI', () => {
		it('should convert TypeScript interface to OpenAPI schema', () => {
			const input = {
				id: 'number',
				name: 'string',
				'email?': 'string',
			};

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const result = (TypescriptToOpenApiSpec as any).dictToOpenAPI(input);

			expect(result).toEqual({
				type: 'object',
				properties: {
					id: { type: 'number' },
					name: { type: 'string' },
					email: { type: 'string' },
				},
				required: ['id', 'name'],
			});
		});
	});

	describe('typeToSchemaObject', () => {
		it('should convert TypeScript types to OpenAPI schema objects', () => {
			const testCases = [
				{ input: 'string', expected: { type: 'string' } },
				{ input: 'number', expected: { type: 'number' } },
				{ input: 'boolean', expected: { type: 'boolean' } },
				{ input: 'User', expected: { $ref: '#/components/schemas/User' } },
				{ input: 'string[]', expected: { type: 'array', items: { type: 'string' } } },
			];

			for (const { input, expected } of testCases) {
				// biome-ignore lint/suspicious/noExplicitAny: ignoring for spec
				const result = (TypescriptToOpenApiSpec as any).typeToSchemaObject(input);
				expect(result).toEqual(expected);
			}
		});
	});

	xdescribe('extractDefinitions', () => {
		it('should extract definitions from TypeScript file', () => {
			// Create mocks
			const mockSourceFile = {};
			const mockTypeChecker = {};
			const mockProgram = {
				getSourceFile: jest.fn().mockReturnValue(mockSourceFile),
				getTypeChecker: jest.fn().mockReturnValue(mockTypeChecker),
			};

			const tsMock = require('typescript');
			tsMock.createProgram.mockReturnValue(mockProgram);

			const tsOpen = (TypescriptToOpenApiSpec as any);

			// Mock the visitNode method
			const visitNodeSpy = jest.spyOn(tsOpen, 'visitNode').mockImplementation();

			// Call the method under test
			const result = tsOpen.extractDefinitions(mockFilePath);

			// Verify that createProgram was called correctly
			expect(tsMock.createProgram).toHaveBeenCalledWith([mockFilePath], {});

			// Now check if getSourceFile was called with the correct argument
			expect(mockProgram.getSourceFile).toHaveBeenCalledWith(mockFilePath);
			expect(mockProgram.getTypeChecker).toHaveBeenCalled();
			expect(visitNodeSpy).toHaveBeenCalledWith(
				mockSourceFile,
				mockTypeChecker,
				{}
			);
		});
	});
});
