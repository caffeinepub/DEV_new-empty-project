import type { backendInterface } from "../backend";

export const mockBackend: backendInterface = {
  getOAuthUrl: async () =>
    "https://accounts.google.com/o/oauth2/v2/auth?client_id=mock&redirect_uri=http%3A%2F%2F127.0.0.1%3A8000%2F&response_type=code&access_type=offline&scope=https://www.googleapis.com/auth/gmail.send",
  handleOAuthCallback: async (_accessToken: string, _email: string) => ({
    __kind__: "ok" as const,
    ok: "authenticated",
  }),
  getAuthStatus: async () => ({
    __kind__: "authenticated" as const,
    authenticated: { email: "ggreif@gmail.com" },
  }),
  getFriends: async () => [
    "alice@example.com",
    "bob@example.com",
    "carol@example.com",
  ],
  addFriend: async (_email: string) => true,
  removeFriend: async (_email: string) => true,
  sendArrivalNotification: async (_place: string, _accessToken: string) => [
    { __kind__: "ok" as const, ok: "Message sent to alice@example.com" },
    { __kind__: "ok" as const, ok: "Message sent to bob@example.com" },
    { __kind__: "ok" as const, ok: "Message sent to carol@example.com" },
  ],
};
