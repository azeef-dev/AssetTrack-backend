import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
    {
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
        issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue' },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorName: { type: String, trim: true, default: '' },
        action: { type: String, required: true, trim: true },
        details: { type: String, trim: true, default: '' },
        meta: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

export default mongoose.model('History', historySchema);