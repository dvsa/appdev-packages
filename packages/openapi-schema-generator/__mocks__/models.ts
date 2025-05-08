export interface Model1 {
	prop1: string;
	prop2: number;
	prop3: boolean;
	propMod3: Model3;
	decConst: DecConst;
	optionalProp?: Model6 | undefined;
}

export interface Model2 {
	prop4: string;
	prop5: number;
	prop6: boolean;
}

export interface Model3 {
	prop7: string;
	prop8: number;
	prop9: boolean;
	propMod4: Model4;
}

export interface Model4 {
	prop10: string;
	prop11: number;
	prop12: boolean;
	propMod5: Model5;
}

export interface Model5 {
	prop13: string;
	prop14: number;
	prop15: boolean;
}

export interface Model6 {
	prop16: string;
	prop17: number;
	prop18: boolean;
}

export declare const DecConst: {
	readonly A: 'A';
	readonly B: 'B';
};

export type DecConst = (typeof DecConst)[keyof typeof DecConst];

enum Test {
	one = 'one',
	two = 'two',
	three = 'three',
}

interface TestInterface {
	test: Test;
}

export interface Model19 extends TestInterface {
	prop19: string;
}
