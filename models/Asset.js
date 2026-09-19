import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
    {
        assetCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
        name: { type: String, required: [true, 'Asset name is required'], trim: true },
        category: { type: String, required: [true, 'Category is required'], trim: true },
        location: { type: String, required: [true, 'Location is required'], trim: true },
        description: { type: String, trim: true, default: '' },
        model: { type: String, trim: true, default: '' },
        serialNumber: { type: String, trim: true, default: '' },
        manufacturer: { type: String, trim: true, default: '' },
        condition: {
            type: String,
            enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'],
            default: 'Good',
        },
        status: {
            type: String,
            enum: [
                'Operational',
                'Issue Reported',
                'Under Inspection',
                'Under Maintenance',
                'Out of Service',
                'Retired',
            ],
            default: 'Operational',
        },
        purchaseDate: { type: Date },
        warrantyExpiry: { type: Date },
        lastServiceDate: { type: Date },
        nextServiceDate: { type: Date },
        assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        qrCodeDataUrl: { type: String, default: '' },
        image: { type: String, default: '' },
        isRetired: { type: Boolean, default: false },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: { type: String, trim: true, default: '' },
    },
    { timestamps: true }
);

assetSchema.index({ name: 'text', assetCode: 'text', location: 'text', category: 'text' });

export default mongoose.model('Asset', assetSchema);