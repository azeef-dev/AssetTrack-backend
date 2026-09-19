import { getNextSequence } from '../models/Counter.js';

export const generateAssetCode = async () => {
    const seq = await getNextSequence('assetCode');
    return `AST-${String(seq).padStart(4, '0')}`;
};

export const generateIssueNumber = async () => {
    const seq = await getNextSequence('issueNumber');
    return `ISS-${String(seq).padStart(5, '0')}`;
};