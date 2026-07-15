export interface BrandDraftPayload {
  legalName: string;
  brandCategory: string;
  address: string;
  email: string;
  phone: string;
  contactPerson: string;
  setupLocation?: string;
  totalAmount?: number;
}

export interface BrandDraftResult {
  scopeOfWork: string;
  deliverables: string;
  partnershipSummary: string;
  brandDescription: string;
}

export function generateFallbackBrandDraft(payload: BrandDraftPayload): BrandDraftResult {
  const { legalName, brandCategory, setupLocation, totalAmount } = payload;
  const categoryPart = brandCategory ? ` within the ${brandCategory} category` : '';
  const locationPart = setupLocation ? ` located at ${setupLocation}` : '';
  const valFmt = totalAmount ? ` amounting to ₹${totalAmount.toLocaleString('en-IN')}` : '';

  return {
    scopeOfWork: `ZenZebra will collaborate with ${legalName} to perform joint promotional setups and execution campaigns${categoryPart}${locationPart} in accordance with standard business procedures.`,
    deliverables: `Standard deliverables include setup execution, logistical coordination, branding displays, and final summary reporting for the activation campaign.`,
    partnershipSummary: `This business alliance secures promotional activities between ZenZebra and ${legalName}${valFmt} to drive engagement.`,
    brandDescription: `${legalName} is a commercial brand operating${categoryPart}, establishing this agreement to execute localized marketing campaigns.`
  };
}
