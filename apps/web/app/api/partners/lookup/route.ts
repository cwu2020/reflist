import { NextResponse } from "next/server";
import { getOrCreatePartnerByPhone } from "@/lib/api/partners/get-or-create-partner-by-phone";

// GET /api/partners/lookup?phone=+1234567890
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");
    
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Missing phone parameter" },
        { status: 400 }
      );
    }
    
    console.log(`Looking up partner for phone: ${phone}`);
    
    // Use the existing utility function to get or create a partner by phone
    const partner = await getOrCreatePartnerByPhone(phone);
    
    if (!partner) {
      return NextResponse.json(
        { success: false, error: "Failed to find or create partner" },
        { status: 500 }
      );
    }
    
    // Determine if we found an existing partner or created a new one
    const wasCreated = partner.createdAt && 
      (new Date().getTime() - new Date(partner.createdAt).getTime() < 5000); // Created in the last 5 seconds
    
    console.log(`${wasCreated ? 'Created new' : 'Found existing'} partner: ${partner.id} for phone: ${phone}`);
    
    return NextResponse.json({
      success: true,
      partnerId: partner.id,
      created: wasCreated,
      name: partner.name
    });
  } catch (error) {
    console.error("Error looking up partner:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
} 