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

// eslint-disable-next-line import/no-extraneous-dependencies
const { getAioLogger, getStatusFromProjectFile } = require('../utils');

// This returns the activation ID of the action that it called
async function main(args) {
    const logger = getAioLogger();
    let payload;
    try {
        const { projectExcelPath, projectRoot } = args;
        const projectPath = `${projectRoot}${projectExcelPath}`;
        if (!projectExcelPath || !projectRoot) {
            payload = 'Status : Required data is not available to get the status.';
            logger.error(payload);
        } else {
            logger.info(`Project file -- ${projectExcelPath}`);
            payload = await getStatusFromProjectFile(projectPath);
            logger.info(`Status here -- ${payload}`);
        }
    } catch (err) {
        logger.error(err);
        payload = err;
    }

    return {
        body: payload,
    };
}

exports.main = main;
