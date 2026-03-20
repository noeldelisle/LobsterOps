const SUPABASE_URL: string | undefined = process.env.SUPABASE_URL;
const SUPABASE_KEY: string | undefined = process.env.SUPABASE_KEY;

async function logToSupabase(payload: Record<string, any>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("[lobsterops-logger] Missing SUPABASE_URL or SUPABASE_KEY");
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agent_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[lobsterops-logger] Supabase error ${res.status}: ${text}`);
    }
  } catch (err: any) {
    console.error(`[lobsterops-logger] fetch failed: ${err.message}`);
  }
}

const handler = async (event: {
  type: string;
  action: string;
  sessionKey?: string;
  context?: Record<string, any>;
}): Promise<void> => {
  const { type, action } = event;

  const payload: Record<string, any> = {
    type: type,
    agentId: "lobster-actual",
    action: action || null,
    timestamp: new Date().toISOString(),
    storedAt: new Date().toISOString(),
    data: {
      sessionKey: event.sessionKey || null,
      context: event.context || null,
    },
  };

  if (type === "gateway" && action === "startup") {
    // Strip context entirely — contains full config including secrets
    await logToSupabase({ ...payload, action: "gateway-startup", data: { sessionKey: event.sessionKey || null } });
    return;
  }

  if (type === "agent" && action === "bootstrap") {
    await logToSupabase({ ...payload, action: "agent-bootstrap" });
    return;
  }

  if (type === "command" && ["new", "reset", "stop"].includes(action)) {
    await logToSupabase({ ...payload, action: `command-${action}` });
    return;
  }
};

export default handler;
