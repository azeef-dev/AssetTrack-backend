import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import Asset from '../models/Asset.js';
import Issue from '../models/Issue.js';

const SAFETY_KEYWORDS = ['spark', 'smoke', 'fire', 'burning', 'shock', 'electrocut', 'gas leak', 'exposed wire'];

const CATEGORY_RULES = [
    { keywords: ['leak', 'water', 'drip', 'flood'], category: 'Leakage' },
    { keywords: ['noise', 'sound', 'vibrat', 'rattl'], category: 'Noise / Vibration' },
    { keywords: ['power', 'not turning on', 'no power', "won't start", 'switch'], category: 'Electrical' },
    { keywords: ['hdmi', 'display', 'flicker', 'screen', 'projector', 'monitor'], category: 'Display / AV' },
    { keywords: ['cool', ' ac ', 'temperature', 'hot', 'heating'], category: 'HVAC / Cooling' },
    { keywords: ['crack', 'broken', 'damage', 'physical'], category: 'Physical Damage' },
    { keywords: ['slow', 'lag', 'performance', 'freeze', 'crash'], category: 'Performance' },
    { keywords: ['smell', 'odor', 'burning smell'], category: 'Safety Hazard' },
];

const isCritical = (text) => SAFETY_KEYWORDS.some((k) => text.toLowerCase().includes(k));

const CAUSES_BY_CATEGORY = {
    Leakage: ['Blocked or damaged drain', 'Worn seal or gasket', 'Loose fitting/connection'],
    'Noise / Vibration': ['Loose mounting or component', 'Worn bearing/motor part', 'Debris caught in mechanism'],
    Electrical: ['Faulty power supply or socket', 'Tripped breaker', 'Damaged internal wiring'],
    'Display / AV': ['Loose or damaged cable', 'Faulty port', 'Outdated driver/firmware'],
    'HVAC / Cooling': ['Dirty filter', 'Low refrigerant', 'Faulty thermostat/sensor'],
    'Physical Damage': ['Impact damage', 'Material fatigue', 'Improper handling'],
    Performance: ['Overheating', 'Outdated software', 'Resource overload'],
    'Safety Hazard': ['Overheating component', 'Insulation breakdown', 'Chemical/gas leak'],
    General: ['Normal wear and tear', 'Requires on-site inspection to confirm cause'],
};

const CHECKS_BY_CATEGORY = {
    Leakage: ['Turn off water/power supply near the leak', 'Visually inspect connection points', 'Do not touch if near electrical components'],
    'Noise / Vibration': ['Power off and observe safely', 'Check for loose visible parts', 'Avoid operating until inspected'],
    Electrical: ['Do NOT touch exposed wiring', 'Switch off at the breaker if safe to do so', 'Keep the area dry and clear'],
    'Display / AV': ['Check cable connections', 'Restart the device if safe', 'Note the exact error/behavior for the technician'],
    'HVAC / Cooling': ['Check and clean accessible filters', 'Ensure vents are unblocked', 'Avoid forcing the unit to run continuously'],
    'Physical Damage': ['Avoid using the asset until inspected', 'Photograph the damage', 'Keep the area clear of the damaged asset'],
    Performance: ['Restart if safe to do so', 'Note when the issue started', 'Avoid heavy use until inspected'],
    'Safety Hazard': ['Evacuate the immediate area if smoke/burning smell is present', 'Do not attempt to operate the asset', 'Contact a qualified technician immediately'],
    General: ['Avoid using the asset if it seems unsafe', 'Document the issue with photos if possible', 'Wait for a qualified technician'],
};

const ruleBasedTriage = (description, assetContext = {}) => {
    const text = description.toLowerCase();
    const matched = CATEGORY_RULES.find((rule) => rule.keywords.some((k) => text.includes(k)));
    const category = matched ? matched.category : 'General';
    const critical = isCritical(text);
    const priority = critical ? 'Critical' : (text.includes('urgent') || text.includes('not working') ? 'High' : 'Medium');

    return {
        title: description.length > 60 ? `${description.slice(0, 57)}...` : description,
        category,
        priority,
        possibleCauses: CAUSES_BY_CATEGORY[category] || CAUSES_BY_CATEGORY.General,
        initialChecks: CHECKS_BY_CATEGORY[category] || CHECKS_BY_CATEGORY.General,
        recurringWarning: assetContext.recentIssueCount >= 2
            ? `This asset has had ${assetContext.recentIssueCount} issues reported in the last 90 days — consider a full inspection.`
            : '',
        source: 'fallback',
    };
};

const callOpenAI = async (description, assetContext) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const systemPrompt = `You are a maintenance triage assistant for MaintainIQ, a facility asset management platform.
Given an asset's context and a user's natural-language complaint, respond ONLY with valid JSON (no markdown, no extra text) in this exact shape:
{
  "title": "short professional issue title",
  "category": "short category name",
  "priority": "Low | Medium | High | Critical",
  "possibleCauses": ["cause 1", "cause 2", "cause 3"],
  "initialChecks": ["safe check 1", "safe check 2", "safe check 3"],
  "recurringWarning": "short warning if relevant, else empty string"
}
Never suggest unsafe actions involving electricity, fire, gas, or structural risk. If the complaint describes a safety hazard (sparks, smoke, gas smell, exposed wiring, structural failure), set priority to "Critical" and recommend contacting a qualified technician immediately instead of self-diagnosis steps.`;

    const userPrompt = `Asset: ${assetContext.name || 'Unknown'} (${assetContext.category || 'Unknown category'})
Location: ${assetContext.location || 'Unknown'}
Current condition: ${assetContext.condition || 'Unknown'}
Recent issues on this asset (last 90 days): ${assetContext.recentIssueCount ?? 0}
Complaint: "${description}"`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                response_format: { type: 'json_object' },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.error('OpenAI API error:', response.status, await response.text());
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;

        const parsed = JSON.parse(content);
        if (!parsed.title || !parsed.category || !parsed.priority) return null;

        return {
            title: parsed.title,
            category: parsed.category,
            priority: ['Low', 'Medium', 'High', 'Critical'].includes(parsed.priority) ? parsed.priority : 'Medium',
            possibleCauses: Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses : [],
            initialChecks: Array.isArray(parsed.initialChecks) ? parsed.initialChecks : [],
            recurringWarning: parsed.recurringWarning || '',
            source: 'ai',
        };
    } catch (err) {
        clearTimeout(timeout);
        console.error('AI triage call failed, using fallback:', err.message);
        return null;
    }
};

export const triageIssue = asyncHandler(async (req, res) => {
    const { description, assetId, assetCode } = req.body;
    if (!description || description.trim().length < 5) {
        throw new ApiError(400, 'Please provide a more detailed description of the problem');
    }

    let assetContext = {};
    if (assetId || assetCode) {
        const asset = assetId
            ? await Asset.findById(assetId)
            : await Asset.findOne({ assetCode: assetCode.toUpperCase() });
        if (asset) {
            const recentIssueCount = await Issue.countDocuments({
                asset: asset._id,
                createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            });
            assetContext = { name: asset.name, category: asset.category, location: asset.location, condition: asset.condition, recentIssueCount };
        }
    }

    let result = await callOpenAI(description, assetContext);
    if (!result) result = ruleBasedTriage(description, assetContext);

    if (isCritical(description) && result.priority !== 'Critical') {
        result.priority = 'Critical';
        result.recurringWarning = result.recurringWarning || 'Safety-related keywords detected — treated as critical priority.';
    }

    res.status(200).json(new ApiResponse(
        200,
        result,
        result.source === 'ai' ? 'AI triage generated' : 'Triage generated using built-in rules (AI service unavailable)'
    ));
});

export const generateMaintenanceSummary = asyncHandler(async (req, res) => {
    const { notes, actionsPerformed, partsUsed } = req.body;
    if (!notes && !actionsPerformed) throw new ApiError(400, 'notes or actionsPerformed is required');

    const apiKey = process.env.OPENAI_API_KEY;
    const partsText = Array.isArray(partsUsed) && partsUsed.length
        ? partsUsed.map((p) => `${p.name} (x${p.quantity || 1})`).join(', ')
        : 'None';

    const fallbackSummary = `Maintenance Summary: ${actionsPerformed || notes}. Parts used: ${partsText}. Technician notes: ${notes || 'N/A'}.`;

    if (!apiKey) {
        return res.status(200).json(new ApiResponse(200, { summary: fallbackSummary, source: 'fallback' }, 'Summary generated using built-in template (AI service unavailable)'));
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You turn rough maintenance technician notes into a short, professional service report paragraph (3-5 sentences). Be factual, do not invent details not present in the notes.' },
                    { role: 'user', content: `Actions performed: ${actionsPerformed || 'N/A'}\nParts used: ${partsText}\nTechnician notes: ${notes || 'N/A'}` },
                ],
                temperature: 0.4,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) throw new Error('AI service returned an error');
        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content?.trim();
        if (!summary) throw new Error('Empty AI response');
        res.status(200).json(new ApiResponse(200, { summary, source: 'ai' }, 'AI summary generated'));
    } catch (err) {
        res.status(200).json(new ApiResponse(200, { summary: fallbackSummary, source: 'fallback' }, 'Summary generated using built-in template (AI service unavailable)'));
    }
});