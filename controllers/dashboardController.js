import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import Asset from '../models/Asset.js';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';

export const getAdminStats = asyncHandler(async (req, res) => {
    const [
        totalAssets, operationalAssets, outOfServiceAssets, retiredAssets,
        openIssues, criticalIssues, resolvedThisMonth, totalTechnicians, totalUsers,
        assetsByStatus, issuesByPriority, topFailingAssets, costAgg,
    ] = await Promise.all([
        Asset.countDocuments(),
        Asset.countDocuments({ status: 'Operational' }),
        Asset.countDocuments({ status: 'Out of Service' }),
        Asset.countDocuments({ status: 'Retired' }),
        Issue.countDocuments({ status: { $nin: ['Resolved', 'Closed'] } }),
        Issue.countDocuments({ priority: 'Critical', status: { $nin: ['Resolved', 'Closed'] } }),
        Issue.countDocuments({ status: 'Resolved', resolvedAt: { $gte: new Date(new Date().setDate(1)) } }),
        User.countDocuments({ role: 'technician', isActive: true }),
        User.countDocuments({ role: 'user', isActive: true }),
        Asset.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Issue.aggregate([
            { $match: { status: { $nin: ['Resolved', 'Closed'] } } },
            { $group: { _id: '$priority', count: { $sum: 1 } } },
        ]),
        Issue.aggregate([
            { $group: { _id: '$asset', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'assets', localField: '_id', foreignField: '_id', as: 'asset' } },
            { $unwind: '$asset' },
            { $project: { count: 1, name: '$asset.name', assetCode: '$asset.assetCode' } },
        ]),
        MaintenanceRecord.aggregate([{ $group: { _id: null, total: { $sum: '$totalCost' } } }]),
    ]);

    res.status(200).json(new ApiResponse(200, {
        totalAssets, operationalAssets, outOfServiceAssets, retiredAssets,
        openIssues, criticalIssues, resolvedThisMonth, totalTechnicians, totalUsers,
        assetsByStatus, issuesByPriority, topFailingAssets,
        totalMaintenanceCost: costAgg[0]?.total || 0,
    }));
});

export const getTechnicianStats = asyncHandler(async (req, res) => {
    const technicianId = req.user._id;
    const [assigned, inProgress, resolvedByMe, criticalAssigned] = await Promise.all([
        Issue.countDocuments({ assignedTo: technicianId, status: { $nin: ['Resolved', 'Closed'] } }),
        Issue.countDocuments({ assignedTo: technicianId, status: { $in: ['Inspection Started', 'Maintenance In Progress', 'Waiting for Parts'] } }),
        Issue.countDocuments({ assignedTo: technicianId, status: 'Resolved' }),
        Issue.countDocuments({ assignedTo: technicianId, priority: 'Critical', status: { $nin: ['Resolved', 'Closed'] } }),
    ]);
    const recentIssues = await Issue.find({ assignedTo: technicianId })
        .populate('asset', 'name assetCode location')
        .sort('-updatedAt').limit(10);

    res.status(200).json(new ApiResponse(200, { assigned, inProgress, resolvedByMe, criticalAssigned, recentIssues }));
});