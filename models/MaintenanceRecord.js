import mongoose from 'mongoose';

const partSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        quantity: { type: Number, default: 1, min: 1 },
        cost: { type: Number, default: 0, min: [0, 'Part cost cannot be negative'] },
    },
    { _id: false }
);

const maintenanceSchema = new mongoose.Schema(
    {
        issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
        asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
        technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        inspectionFindings: { type: String, trim: true, default: '' },
        actionsPerformed: { type: String, trim: true, default: '' },
        partsUsed: [partSchema],
        totalCost: { type: Number, default: 0, min: [0, 'Total cost cannot be negative'] },
        timeSpentMinutes: { type: Number, default: 0, min: 0 },
        evidence: [{ type: String }],
        conditionAfter: {
            type: String,
            enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'],
        },
        nextServiceDate: { type: Date },
        notes: { type: String, trim: true, default: '' },
        aiSummary: { type: String, trim: true, default: '' },
    },
    { timestamps: true }
);

maintenanceSchema.pre('validate', function (next) {
    if (this.partsUsed && this.partsUsed.length) {
        this.totalCost = this.partsUsed.reduce((sum, p) => sum + (p.cost || 0) * (p.quantity || 1), 0);
    }
    const completionDate = this.createdAt || new Date();
    if (this.nextServiceDate && this.nextServiceDate < completionDate) {
        return next(new Error('Next service date cannot be before the maintenance completion date'));
    }
    next();
});

export default mongoose.model('MaintenanceRecord', maintenanceSchema);