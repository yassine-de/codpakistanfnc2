const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WISE_API_BASE = "https://api.wise.com";
const TARGET_CARD_LAST4 = "1252";

const parseAmount = (amountStr: string): { value: number; currency: string } => {
  if (!amountStr || typeof amountStr !== "string") return { value: 0, currency: "USD" };
  const parts = amountStr.trim().split(" ");
  const value = parseFloat(parts[0]?.replace(/,/g, "") || "0");
  const currency = parts[1] || "USD";
  return { value: Math.abs(value), currency };
};

const parseTitle = (title: string): string => {
  if (!title || typeof title !== "string") return "";
  return title.replace(/<\/?strong>/g, "").trim();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const WISE_API_TOKEN = Deno.env.get("WISE_API_TOKEN");
    if (!WISE_API_TOKEN) throw new Error("WISE_API_TOKEN is not configured");
    if (!req.headers.get("authorization")) throw new Error("Missing authorization header");

    const body = await req.json();
    const sinceDate = body.sinceDate;

    const wiseHeaders: Record<string, string> = { Authorization: `Bearer ${WISE_API_TOKEN}` };

    // 1. Get profile
    const profilesRes = await fetch(`${WISE_API_BASE}/v1/profiles`, { headers: wiseHeaders });
    if (!profilesRes.ok) throw new Error(`Failed to fetch profiles [${profilesRes.status}]`);
    const profiles = await profilesRes.json();
    const personalProfile = profiles.find((p: any) => p.type?.toLowerCase() === "personal");
    if (!personalProfile) throw new Error("No personal profile found");
    const profileId = String(personalProfile.id);

    const fromDate = sinceDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    const debugInfo: any = { profileId, fromDate, toDate, method: null, errors: [] };

    // ===== STRATEGY 1: Try card-specific endpoints =====
    let cardTransactions: any[] | null = null;

    try {
      // 1a. List all cards
      const cardsUrl = `${WISE_API_BASE}/v3/spend/profiles/${profileId}/cards`;
      console.log("Trying cards endpoint:", cardsUrl);
      const cardsRes = await fetch(cardsUrl, { headers: wiseHeaders });
      
      if (cardsRes.ok) {
        const cards = await cardsRes.json();
        debugInfo.cardsFound = (cards || []).map((c: any) => ({
          token: c.token,
          lastFourDigits: c.lastFourDigits,
          status: c.status?.value,
          type: c.cardProgram?.cardType,
        }));
        console.log("Cards found:", JSON.stringify(debugInfo.cardsFound));

        // Find the target card
        const targetCard = (cards || []).find((c: any) => c.lastFourDigits === TARGET_CARD_LAST4);
        
        if (targetCard) {
          debugInfo.targetCardToken = targetCard.token;
          
          // 1b. Get transactions for this card
          const txUrl = `${WISE_API_BASE}/v4/spend/profiles/${profileId}/cards/${targetCard.token}/transactions?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&pageSize=100`;
          console.log("Trying card transactions endpoint:", txUrl);
          const txRes = await fetch(txUrl, { headers: wiseHeaders });
          
          if (txRes.ok) {
            const txData = await txRes.json();
            const rawTxs = txData.transactions || txData || [];
            debugInfo.method = "card-transactions";
            
            cardTransactions = (Array.isArray(rawTxs) ? rawTxs : []).map((tx: any) => ({
              wise_id: String(tx.transactionId || tx.id || Math.random()),
              date: tx.transactionDate || tx.createdAt || tx.date,
              amount: Math.abs(tx.amount?.value || tx.transactionAmount?.value || 0),
              currency: tx.amount?.currency || tx.transactionAmount?.currency || "USD",
              description: tx.merchant?.name || tx.description || "",
              type: tx.type || "CARD_PAYMENT",
              status: tx.state || tx.status || "COMPLETED",
              card_last4: TARGET_CARD_LAST4,
              raw: tx,
            }));
          } else {
            const errBody = await txRes.text();
            debugInfo.errors.push({ endpoint: "card-transactions", status: txRes.status, body: errBody });
            console.log(`Card transactions endpoint failed [${txRes.status}]:`, errBody);
          }
        } else {
          debugInfo.errors.push({ endpoint: "cards", note: `Card with last4=${TARGET_CARD_LAST4} not found among ${(cards || []).length} cards` });
        }
      } else {
        const errBody = await cardsRes.text();
        debugInfo.errors.push({ endpoint: "cards-list", status: cardsRes.status, body: errBody });
        console.log(`Cards list endpoint failed [${cardsRes.status}]:`, errBody);
      }
    } catch (e) {
      debugInfo.errors.push({ endpoint: "card-strategy", error: String(e) });
    }

    // ===== STRATEGY 2: Fallback to Activities API =====
    if (!cardTransactions) {
      debugInfo.method = "activities-fallback";
      
      const activitiesUrl = `${WISE_API_BASE}/v1/profiles/${profileId}/activities?since=${encodeURIComponent(fromDate)}&until=${encodeURIComponent(toDate)}&status=COMPLETED&size=100`;
      const activitiesRes = await fetch(activitiesUrl, { headers: wiseHeaders });
      if (!activitiesRes.ok) throw new Error(`Activities API failed [${activitiesRes.status}]`);

      const activitiesData = await activitiesRes.json();
      const activities = activitiesData.activities || activitiesData || [];
      const cardPayments = (Array.isArray(activities) ? activities : []).filter((a: any) => a.type === "CARD_PAYMENT");

      cardTransactions = cardPayments.map((a: any) => {
        const parsed = parseAmount(a.primaryAmount);
        return {
          wise_id: String(a.resource?.id || a.id || Math.random()),
          date: a.createdOn || a.date,
          amount: parsed.value,
          currency: parsed.currency,
          description: parseTitle(a.title) || a.description || "",
          type: a.type,
          status: a.status || "COMPLETED",
          card_last4: null,
          raw: a,
        };
      });
    }

    const isCardFiltered = debugInfo.method === "card-transactions";

    return new Response(
      JSON.stringify({
        success: true,
        profileId,
        source: debugInfo.method,
        cardFilterApplied: isCardFiltered,
        cardFilterNote: isCardFiltered
          ? null
          : `Konnte nicht nach Karte filtern. Zeige alle ${cardTransactions.length} Kartenzahlungen. Details: ${JSON.stringify(debugInfo.errors)}`,
        transactions: cardTransactions,
        debug: debugInfo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Wise API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
