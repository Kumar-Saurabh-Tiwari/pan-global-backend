const mongoose = require('mongoose');

// Benefit Schema
const BenefitSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true }, // Icon name from lucide-react
    category: { type: String, required: true }, // 'networking', 'resources', 'facilities', etc.
    value: { type: String }, // "$2,400/year"
    membershipTiers: [{ 
        type: String, 
        enum: ['standard', 'premium', 'executive'],
        required: true 
    }],
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }, // For sorting
    usageTracking: { type: Boolean, default: false }, // Whether to track usage
    maxUsage: { type: Number }, // Max usage per period (if applicable)
    period: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' }
}, { timestamps: true });

// Membership Tier Schema
const MembershipTierSchema = new mongoose.Schema({
    name: { type: String, required: true }, // standard, premium, executive
    displayName: { type: String, required: true }, // Standard, Premium, Executive
    price: { type: Number, required: true }, // Annual price in cents
    monthlyPrice: { type: Number }, // Monthly price in cents
    description: { type: String, required: true },
    features: [{ type: String }],
    benefits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Benefit' }],
    color: { type: String, default: 'blue' },
    isPopular: { type: Boolean, default: false },
    estimatedValue: { type: Number }, // Total value in cents
    roi: { type: String }, // "400% ROI"
    savings: { type: String }, // "Save $480 vs Standard"
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
}, { timestamps: true });

// User Benefit Usage Schema
const BenefitUsageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    benefit: { type: mongoose.Schema.Types.ObjectId, ref: 'Benefit', required: true },
    usageCount: { type: Number, default: 0 },
    lastUsed: { type: Date },
    period: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed } // Additional usage data
}, { timestamps: true });

// Exclusive Offer Schema
const ExclusiveOfferSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    offerType: { 
        type: String, 
        enum: ['upgrade_discount', 'referral', 'early_renewal', 'team_package'],
        required: true 
    },
    discountType: { 
        type: String, 
        enum: ['percentage', 'fixed_amount', 'months_free'],
        required: true 
    },
    discountValue: { type: Number, required: true }, // 20 for 20%, 480 for $480
    promoCode: { type: String, required: true, unique: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    maxUses: { type: Number, default: null }, // null for unlimited
    currentUses: { type: Number, default: 0 },
    targetMembershipTiers: [{ type: String }], // Which tiers can use this offer
    requirements: {
        minReferrals: { type: Number },
        earlyRenewalMonths: { type: Number },
        teamSize: { type: Number }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ROI Metric Schema
const ROIMetricSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    metricType: { 
        type: String, 
        enum: ['business_deals', 'time_saved', 'knowledge_value', 'travel_savings'],
        required: true 
    },
    label: { type: String, required: true },
    value: { type: String, required: true }, // "$1.2M", "40 hrs/month"
    description: { type: String, required: true },
    icon: { type: String, required: true },
    calculatedAt: { type: Date, default: Date.now },
    period: { type: String, default: 'yearly' }
}, { timestamps: true });

// User Membership Schema (extends User model)
const UserMembershipSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currentTier: { type: String, enum: ['standard', 'premium', 'executive'], required: true },
    membershipStartDate: { type: Date, required: true },
    membershipEndDate: { type: Date, required: true },
    autoRenewal: { type: Boolean, default: true },
    paymentMethod: {
        last4: { type: String },
        brand: { type: String },
        expiresMonth: { type: Number },
        expiresYear: { type: Number }
    },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' },
    totalSpent: { type: Number, default: 0 }, // Total amount spent in cents
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referralCount: { type: Number, default: 0 },
    lastRenewalDate: { type: Date },
    nextRenewalDate: { type: Date },
    membershipHistory: [{
        tier: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        amount: { type: Number }
    }]
}, { timestamps: true });

// Add indexes
BenefitUsageSchema.index({ user: 1, benefit: 1, periodStart: 1 });
UserMembershipSchema.index({ user: 1 });
UserMembershipSchema.index({ referralCode: 1 });
ExclusiveOfferSchema.index({ promoCode: 1 });
ExclusiveOfferSchema.index({ validFrom: 1, validUntil: 1 });

const Benefit = mongoose.model('Benefit', BenefitSchema);
const MembershipTier = mongoose.model('MembershipTier', MembershipTierSchema);
const BenefitUsage = mongoose.model('BenefitUsage', BenefitUsageSchema);
const ExclusiveOffer = mongoose.model('ExclusiveOffer', ExclusiveOfferSchema);
const ROIMetric = mongoose.model('ROIMetric', ROIMetricSchema);
const UserMembership = mongoose.model('UserMembership', UserMembershipSchema);

module.exports = {
    Benefit,
    MembershipTier,
    BenefitUsage,
    ExclusiveOffer,
    ROIMetric,
    UserMembership
};