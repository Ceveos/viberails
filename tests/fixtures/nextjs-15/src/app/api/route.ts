import { NextResponse } from "next/server";

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  return NextResponse.json({ received: true, data: body });
}
