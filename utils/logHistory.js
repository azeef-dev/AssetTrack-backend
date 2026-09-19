import History from '../models/History.js';

const logHistory = async ({ asset, issue = null, actor = null, actorName = '', action, details = '', meta = {} }) => {
    try {
        await History.create({ asset, issue, actor, actorName, action, details, meta });
    } catch (err) {
        console.error('Failed to log history:', err.message);
    }
};

export default logHistory;