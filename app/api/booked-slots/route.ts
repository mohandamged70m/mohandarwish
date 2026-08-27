import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase.from("bookings").select("date,time");
    if (error) throw error;
    return NextResponse.json({ slots: data ?? [] });
  } catch {
    return NextResponse.json({ slots: [] });
  }
}
