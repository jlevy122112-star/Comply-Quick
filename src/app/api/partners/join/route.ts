import { NextResponse } from "next/server";
import { getOrCreatePartner } from "@/lib/partners/service";
import { errorResponse } from "@/services";

/** Joins the partner program (idempotent), returning the caller's referral code. */
export async function POST() {
  try {
    const partner = await getOrCreatePartner();
    return NextResponse.json({ partner: { referralCode: partner.referralCode } });
  } catch (err) {
    return errorResponse(err);
  }
}
