import {
	ADR_TEST,
	ANNUAL_WITH_CERTIFICATE,
	BASIC_IVA_TEST,
	CENTRAL_DOCS_TEST,
	HGV_TRL_RWT_TEST,
	IVA_TEST,
	LEC_TEST,
	MSVA_TEST,
	PROHIBITION_CLEARANCE_TEST,
	TIR_TEST, VOLUNTARY_IVA_TEST,
	VTG_VTP_12_TEST,
} from '../Constants';
import { TestTypeHelper } from '../testTypeHelper';

describe('validateTestTypeIdInList', () => {
	it('should return true if test type id exists in list provided', () => {
		const resultLEC = TestTypeHelper.validateTestTypeIdInList(LEC_TEST, '39');
		const resultADR = TestTypeHelper.validateTestTypeIdInList(ADR_TEST, '50');
		const resultTIR = TestTypeHelper.validateTestTypeIdInList(TIR_TEST, '49');
		const resultRWT = TestTypeHelper.validateTestTypeIdInList(HGV_TRL_RWT_TEST, '62');
		const resultIVA = TestTypeHelper.validateTestTypeIdInList(IVA_TEST, '125');
		const resultMSVA = TestTypeHelper.validateTestTypeIdInList(MSVA_TEST, '133');
		const resultBasicIVA = TestTypeHelper.validateTestTypeIdInList(BASIC_IVA_TEST, '125');
		const resultProhibitionClearance = TestTypeHelper.validateTestTypeIdInList(PROHIBITION_CLEARANCE_TEST, '70');
		const resultAnnualWithCertificate = TestTypeHelper.validateTestTypeIdInList(ANNUAL_WITH_CERTIFICATE, '1');
		const resultCentralDocs = TestTypeHelper.validateTestTypeIdInList(CENTRAL_DOCS_TEST, '50');
		const resultAbandonedTest = TestTypeHelper.validateTestTypeIdInList(VTG_VTP_12_TEST, '1');
		const resultVoluntaryIvaTest = TestTypeHelper.validateTestTypeIdInList(VOLUNTARY_IVA_TEST, '191');

		expect(resultLEC).toBe(true);
		expect(resultADR).toBe(true);
		expect(resultTIR).toBe(true);
		expect(resultRWT).toBe(true);
		expect(resultIVA).toBe(true);
		expect(resultMSVA).toBe(true);
		expect(resultBasicIVA).toBe(true);
		expect(resultProhibitionClearance).toBe(true);
		expect(resultAnnualWithCertificate).toBe(true);
		expect(resultCentralDocs).toBe(true);
		expect(resultAbandonedTest).toBe(true);
		expect(resultVoluntaryIvaTest).toBe(true);
	});

	it('should return false if test type id does not exist in list provided', () => {
		const resultLEC = TestTypeHelper.validateTestTypeIdInList(LEC_TEST, '0');
		const resultADR = TestTypeHelper.validateTestTypeIdInList(ADR_TEST, '0');
		const resultTIR = TestTypeHelper.validateTestTypeIdInList(TIR_TEST, '0');
		const resultRWT = TestTypeHelper.validateTestTypeIdInList(HGV_TRL_RWT_TEST, '0');
		const resultIVA = TestTypeHelper.validateTestTypeIdInList(IVA_TEST, '0');
		const resultMSVA = TestTypeHelper.validateTestTypeIdInList(MSVA_TEST, '0');
		const resultBasicIVA = TestTypeHelper.validateTestTypeIdInList(BASIC_IVA_TEST, '0');
		const resultProhibitionClearance = TestTypeHelper.validateTestTypeIdInList(PROHIBITION_CLEARANCE_TEST, '0');
		const resultAnnualWithCertificate = TestTypeHelper.validateTestTypeIdInList(ANNUAL_WITH_CERTIFICATE, '0');
		const resultCentralDocs = TestTypeHelper.validateTestTypeIdInList(CENTRAL_DOCS_TEST, '0');
		const resultAbandonedTest = TestTypeHelper.validateTestTypeIdInList(VTG_VTP_12_TEST, '0');
		const resultVoluntaryIvaTest = TestTypeHelper.validateTestTypeIdInList(VOLUNTARY_IVA_TEST, '0');

		expect(resultLEC).toBe(false);
		expect(resultADR).toBe(false);
		expect(resultTIR).toBe(false);
		expect(resultRWT).toBe(false);
		expect(resultIVA).toBe(false);
		expect(resultMSVA).toBe(false);
		expect(resultBasicIVA).toBe(false);
		expect(resultProhibitionClearance).toBe(false);
		expect(resultAnnualWithCertificate).toBe(false);
		expect(resultCentralDocs).toBe(false);
		expect(resultAbandonedTest).toBe(false);
		expect(resultVoluntaryIvaTest).toBe(false);
	});
});

describe('validateTestTypeIdInLists', () => {
	it('should return true if test type id exists in any of the list provided', () => {
		const isVehicleApprovalTest = TestTypeHelper.validateTestTypeIdInLists([IVA_TEST, MSVA_TEST], '125');

		expect(isVehicleApprovalTest).toBe(true);
	});

	it('should return false if test type id does not exist in any of the lists provided', () => {
		const isVehicleApprovalTest = TestTypeHelper.validateTestTypeIdInLists([IVA_TEST, MSVA_TEST], '0');

		expect(isVehicleApprovalTest).toBe(false);
	});
});
