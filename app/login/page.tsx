import { isAuthConfigured } from "@/lib/access";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return <LoginClient authReady={isAuthConfigured()} />;
}
