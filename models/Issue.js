import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
    {
        issueNumber: { type: String, required: true, unique: true },
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
        title: { type: String, required: [true, 'Title is required'], trim: true },
        description: { type: String, required: [true, 'Description is required'], trim: true },
        category: { type: String, trim: true, default: 'General' },
        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Critical'],
            default: 'Medium',
        },
        status: {
            type: String,
            enum: [
                'Reported',
                'Assigned',
                'Inspection Started',
                'Maintenance In Progress',
                'Waiting for Parts',
                'Resolved',
                'Closed',
                'Reopened',
            ],
            default: 'Reported',
        },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        guestReporter: {
            name: { type: String, trim: true },
            email: { type: String, trim: true },
            phone: { type: String, trim: true },
        },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        evidence: [{ type: String }],
        aiSuggestion: {
            title: String,
            category: String,
            priority: String,
            possibleCauses: [String],
            initialChecks: [String],
            recurringWarning: String,
            source: { type: String, enum: ['ai', 'fallback'], default: 'fallback' },
        },
        aiWasEdited: { type: Boolean, default: false },
        resolvedAt: { type: Date },
        closedAt: { type: Date },
        reopenCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

issueSchema.index({ title: 'text', description: 'text', issueNumber: 'text' });

export default mongoose.model('Issue', issueSchema);