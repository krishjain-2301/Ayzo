import { redirect } from "next/navigation";

// AYZO is a local tool: there is no landing page, the dashboard is the app.
export default function Home() {
  redirect("/dashboard");
}
