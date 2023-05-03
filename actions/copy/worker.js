/* ************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2023 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
************************************************************************* */

const { getProjectDetails, updateProjectWithDocs } = require('../project');
const {
    updateExcelTable, getFile, saveFile, copyFile
} = require('../sharepoint');
const { getAioLogger, simulatePreview, handleExtension, updateStatus } = require('../utils');

async function main(params) {
    const logger = getAioLogger();
    let payload;
    const { spToken, adminPageUri, projectExcelPath, projectRoot } = params;
    const projectPath = `${projectRoot}${projectExcelPath}`;
    try {
        if (!spToken || !adminPageUri || !projectExcelPath || !projectRoot) {
            payload = 'Required data is not available to proceed with FG Copy action.';
            updateStatus(projectPath, payload);
            logger.error(payload);
        } else {
            updateStatus(projectPath, 'In-Progress');
            logger.info('Getting all files to be floodgated from the project excel file');
            const projectDetail = await getProjectDetails(adminPageUri, projectExcelPath);

            logger.info('Injecting sharepoint data');
            await updateProjectWithDocs(spToken, adminPageUri, projectDetail);

            logger.info('Start floodgating content');
            payload = await floodgateContent(spToken, adminPageUri, projectExcelPath, projectDetail);
            updateStatus(projectPath, 'Success');
        }
    } catch (err) {
        logger.error(err);
        payload = err;
        updateStatus(projectPath, 'Failure');
    }

    return {
        body: payload,
    };
}

async function floodgateContent(spToken, adminPageUri, projectExcelPath, projectDetail) {
    const logger = getAioLogger();
    logger.info('Floodgating content started.');

    async function copyFilesToFloodgateTree(urlInfo) {
        const status = { success: false };
        if (!urlInfo?.doc) return status;

        try {
            const srcPath = urlInfo.doc.filePath;
            logger.info(`Copying ${srcPath} to pink folder`);

            let copySuccess = false;
            if (urlInfo.doc.fg?.sp?.status !== 200) {
                const destinationFolder = `${srcPath.substring(0, srcPath.lastIndexOf('/'))}`;
                copySuccess = await copyFile(spToken, adminPageUri, srcPath, destinationFolder, undefined, true);
            } else {
                // Get the source file
                const file = await getFile(urlInfo.doc);
                if (file) {
                    const destination = urlInfo.doc.filePath;
                    if (destination) {
                        // Save the file in the floodgate destination location
                        const saveStatus = await saveFile(spToken, adminPageUri, file, destination, true);
                        if (saveStatus.success) {
                            copySuccess = true;
                        }
                    }
                }
            }
            status.success = copySuccess;
            status.srcPath = srcPath;
            status.url = urlInfo.doc.url;
        } catch (error) {
            logger.error(`Error occurred when trying to copy files to floodgated content folder ${error.message}`);
            throw new Error(`Error occurred when trying to copy files to floodgated content folder : ${error}`);
        }
        return status;
    }

    const startCopy = new Date();
    const copyStatuses = await Promise.all(
        [...projectDetail.urls].map((valueArray) => copyFilesToFloodgateTree(valueArray[1])),
    );
    const endCopy = new Date();
    logger.info('Completed floodgating documents listed in the project excel');

    const previewStatuses = await Promise.all(
        copyStatuses
            .filter((status) => status.success)
            .map((status) => simulatePreview(handleExtension(status.srcPath), 1, true, adminPageUri)),
    );
    logger.info('Completed generating Preview for floodgated files.');
    const failedCopies = copyStatuses.filter((status) => !status.success)
        .map((status) => status.srcPath || 'Path Info Not available');
    const failedPreviews = previewStatuses.filter((status) => !status.success)
        .map((status) => status.path);

    const excelValues = [['COPY', startCopy, endCopy, failedCopies.join('\n'), failedPreviews.join('\n')]];
    await updateExcelTable(spToken, adminPageUri, projectExcelPath, 'COPY_STATUS', excelValues);
    logger.info('Project excel file updated with copy status.');

    if (failedCopies.length > 0 || failedPreviews.length > 0) {
        logger.info('Error occurred when floodgating content. Check project excel sheet for additional information.');
        throw new Error('Error occurred when floodgating content. Check project excel sheet for additional information.');
    } else {
        logger.info('Copied content to floodgate tree successfully.');
    }

    return 'All tasks for Floodgate Copy completed';
}

exports.main = main;
