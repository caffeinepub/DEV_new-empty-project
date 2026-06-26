import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type SendResult = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export type FriendEmail = string;
export type AuthStatus = {
    __kind__: "notAuthenticated";
    notAuthenticated: null;
} | {
    __kind__: "authenticated";
    authenticated: {
        email: string;
    };
};
export interface backendInterface {
    addFriend(email: FriendEmail): Promise<boolean>;
    getAuthStatus(): Promise<AuthStatus>;
    getFriends(): Promise<Array<FriendEmail>>;
    getOAuthUrl(): Promise<string>;
    handleOAuthCallback(accessToken: string, email: string): Promise<SendResult>;
    removeFriend(email: FriendEmail): Promise<boolean>;
    sendArrivalNotification(place: string, accessToken: string): Promise<Array<SendResult>>;
}
