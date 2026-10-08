import banner1 from "@/lib/email-assets/banner-1";
import banner2 from "@/lib/email-assets/banner-2";
import banner3 from "@/lib/email-assets/banner-3";
import banner4 from "@/lib/email-assets/banner-4";
import banner5 from "@/lib/email-assets/banner-5";
import banner6 from "@/lib/email-assets/banner-6";
import banner7 from "@/lib/email-assets/banner-7";
import banner8 from "@/lib/email-assets/banner-8";

export async function GET() {
  const base64 = [banner1,banner2,banner3,banner4,banner5,banner6,banner7,banner8].join("");
  const bytes = Buffer.from(base64, "base64");

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
