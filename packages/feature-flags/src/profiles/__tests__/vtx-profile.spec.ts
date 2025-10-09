const getAppConfig = jest.fn();

jest.mock('@aws-lambda-powertools/parameters/appconfig', () => ({
	getAppConfig,
}));

import { getProfile } from '../vtx';

describe('app config configuration', () => {
	it('should use default flags', async () => {
		const expectedFlags = {};

		getAppConfig.mockReturnValue(expectedFlags);

		const flags = await getProfile();

		expect(flags.welshTranslation.enabled).toBe(true);
		expect(flags.welshTranslation.translatePassTestResult).toBe(true);
		expect(flags.welshTranslation.translateFailTestResult).toBe(true);
		expect(flags.welshTranslation.translatePrsTestResult).toBe(true);
		expect(flags.issueDocsCentrally.enabled).toBe(true);
		expect(flags.recallsApi.enabled).toBe(true);
		expect(flags.automatedCt.enabled).toBe(false);
		expect(flags.abandonedCerts.enabled).toBe(true);
		expect(flags.specialistDefects.enabled).toBe(false);
		expect(flags.specialistDefects.adasImNumbers).toEqual([29]);
		expect(flags.skipAutomatedProcesses.enabled).toBe(false);
		expect(flags.skipAutomatedProcesses.atfReportGen).toBe(false);
		expect(flags.skipAutomatedProcesses.centralDocsNotify).toBe(false);
		expect(flags.skipAutomatedProcesses.certGen).toBe(false);
		expect(flags.skipAutomatedProcesses.certGovNotify).toBe(false);
		expect(flags.skipAutomatedProcesses.docGenUpload).toBe(false);
		expect(flags.skipAutomatedProcesses.evlSftpPush).toBe(false);
		expect(flags.skipAutomatedProcesses.exportAnts).toBe(false);
		expect(flags.skipAutomatedProcesses.exportEvl).toBe(false);
		expect(flags.skipAutomatedProcesses.exportProhibition).toBe(false);
		expect(flags.skipAutomatedProcesses.exportTestResults).toBe(false);
		expect(flags.skipAutomatedProcesses.exportTfl).toBe(false);
		expect(flags.skipAutomatedProcesses.putTestStation).toBe(false);
		expect(flags.skipAutomatedProcesses.retroGen).toBe(false);
		expect(flags.skipAutomatedProcesses.scheduledOperations).toBe(false);
		expect(flags.skipAutomatedProcesses.updateStoreTechRecords).toBe(false);
		expect(flags.skipAutomatedProcesses.updateStoreTestResults).toBe(false);
		expect(flags.skipAutomatedProcesses.updateTestStation).toBe(false);
		expect(flags.skipAutomatedProcesses.updateTestVrm).toBe(false);
	});

	it('should override some flags with a partial response', async () => {
		const expectedFlags = {
			welshTranslation: {
				enabled: true,
				translatePassTestResult: true,
			},
			issueDocsCentrally: {
				enabled: false,
			},
			recallsApi: {
				enabled: true,
			},
			automatedCt: {
				enabled: true,
			},
			abandonedCerts: {
				enabled: true,
			},
			specialistDefects: {
				enabled: true,
				adasImNumbers: [29, 99],
			},
			skipAutomatedProcesses: {
				enabled: true,
				certGovNotify: true,
				exportAnts: true,
				updateStoreTechRecords: true,
			},
		};

		getAppConfig.mockReturnValue(expectedFlags);

		const flags = await getProfile();

		expect(flags.welshTranslation.enabled).toBe(true);
		expect(flags.welshTranslation.translatePassTestResult).toBe(true);
		expect(flags.welshTranslation.translateFailTestResult).toBe(true);
		expect(flags.welshTranslation.translatePrsTestResult).toBe(true);
		expect(flags.issueDocsCentrally.enabled).toBe(false);
		expect(flags.recallsApi.enabled).toBe(true);
		expect(flags.automatedCt.enabled).toBe(true);
		expect(flags.abandonedCerts.enabled).toBe(true);
		expect(flags.specialistDefects.enabled).toBe(true);
		expect(flags.specialistDefects.adasImNumbers).toEqual([29, 99]);
		expect(flags.skipAutomatedProcesses.enabled).toBe(true);
		expect(flags.skipAutomatedProcesses.certGovNotify).toBe(true);
		expect(flags.skipAutomatedProcesses.exportAnts).toBe(true);
		expect(flags.skipAutomatedProcesses.updateStoreTechRecords).toBe(true);
		expect(flags.skipAutomatedProcesses.updateStoreTestResults).toBe(false);
	});
});
