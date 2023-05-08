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
const openwhisk = require('openwhisk');
const { getAioLogger, updateStatus } = require('../utils');

// This returns the activation ID of the action that it called
function main(args) {
    const logger = getAioLogger();
    let payload;
    const {
        spToken, adminPageUri, projectExcelPath, projectRoot
    } = args;
    const projectPath = `${projectRoot}${projectExcelPath}`;
    try {
        if (!projectRoot || !projectExcelPath) {
            payload = 'Could not determine the project path. Try reloading the page and trigger the action again.';
            logger.error(payload);
        } else if (!spToken || !adminPageUri) {
            payload = 'Required data is not available to proceed with FG Promote action.';
            updateStatus(projectPath, 'Failure');
            logger.error(payload);
        } else {
            updateStatus(projectPath, 'In-Progress');
            const ow = openwhisk();
            return ow.actions.invoke({
                name: 'milo-fg/copy-worker',
                blocking: false, // this is the flag that instructs to execute the worker asynchronous
                result: false,
                params: args
            }).then((result) => {
                logger.info(result);
                //  attaching activation id to the status
                updateStatus(projectPath, `Copy action triggered with activation id ${result.activationId}`);
                return {
                    code: 200,
                    body: { Success: result },
                };
            }).catch((err) => {
                updateStatus(projectPath, 'Failure');
                logger.error('Failed to invoke actions', err);
                return {
                    code: 500,
                    body: { Error: err }
                };
            });
        }
    } catch (err) {
        updateStatus(projectPath, 'Failure');
        logger.error(err);
        payload = err;
    }

    return { payload };
}

exports.main = main;
