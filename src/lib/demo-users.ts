export interface DemoAccount {
  id: string;
  email: string;
  fullName: string;
  summary: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    email: "alice@ajaia.demo",
    fullName: "Alice Morgan",
    summary: "Owns Architecture & Launch docs; Viewer on Bob's notes",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    email: "bob@ajaia.demo",
    fullName: "Bob Chen",
    summary: "Editor on Alice's Architecture doc; Owns Sprint Notes",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    email: "carol@ajaia.demo",
    fullName: "Carol Davis",
    summary: "Viewer on Alice's Architecture doc; Owns Private Notes",
  },
] as const;

export const DEMO_EMAILS = [
  "alice@ajaia.demo",
  "bob@ajaia.demo",
  "carol@ajaia.demo",
] as const;

