import { createProxyRoute } from "@/lib/createProxyRoute";

export const POST = createProxyRoute(
  "/generate-brag-doc",
  "Brag doc generation failed"
);
