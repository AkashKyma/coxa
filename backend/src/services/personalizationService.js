import { getFanSegments } from "./segmentService.js";
import { getBalance } from "./loyaltyService.js";
import { getFanTraits } from "./traitCalculator.js";
import { Offer } from "../models/Offer.js";

export async function getNextBestOffer(tenantId, fanProfileId) {
  const [segments, balance, traits, offers] = await Promise.all([
    getFanSegments(tenantId, fanProfileId),
    getBalance(tenantId, fanProfileId),
    getFanTraits(tenantId, fanProfileId),
    Offer.find({ tenantId, status: "active" }).sort({ priority: 1 }),
  ]);

  const now = new Date();
  const activeOffers = offers.filter((o) => {
    if (o.validFrom && o.validFrom > now) return false;
    if (o.validUntil && o.validUntil < now) return false;
    if ((o.minPoints ?? 0) > 0 && balance < o.minPoints) return false;
    return true;
  });

  const segmentNames = new Set(segments.map((s) => s.name));
  const segmentIds = new Set(segments.map((s) => (s._id ?? s.id)?.toString()));

  // First pass: find the highest-priority offer whose segment matches the fan
  for (const offer of activeOffers) {
    if (!offer.segmentId) continue; // skip fallback offers in first pass
    const matchByName = offer.segmentName && segmentNames.has(offer.segmentName);
    const matchById = offer.segmentId && segmentIds.has(offer.segmentId.toString());
    if (matchByName || matchById) {
      return {
        offer: offer.toJSON(),
        matchedSegment: offer.segmentName,
        fanContext: { balance, traits, segmentNames: [...segmentNames] },
        fallback: false,
      };
    }
  }

  // Fallback: first active offer with no segment (global/default)
  const defaultOffer = activeOffers.find((o) => !o.segmentId);
  if (defaultOffer) {
    return {
      offer: defaultOffer.toJSON(),
      matchedSegment: null,
      fanContext: { balance, traits, segmentNames: [...segmentNames] },
      fallback: true,
    };
  }

  return {
    offer: null,
    matchedSegment: null,
    fanContext: { balance, traits, segmentNames: [...segmentNames] },
    fallback: true,
  };
}
